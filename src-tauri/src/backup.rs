use chrono::{DateTime, Datelike, NaiveDate, Utc};
use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

const EVENT_KEEP: usize = 10;
const DAILY_KEEP: usize = 7;
const WEEKLY_KEEP: usize = 4;

#[derive(Serialize, Clone)]
pub struct BackupMeta {
    pub name: String,
    pub reason: String,
    pub created_at: String,
    pub size_bytes: u64,
}

fn backups_dir(vault_path: &Path) -> PathBuf {
    vault_path.join("backups")
}

fn db_path(vault_path: &Path) -> PathBuf {
    vault_path.join("dinero.db")
}

fn format_name(created_at: &DateTime<Utc>, reason: &str) -> String {
    format!("dinero-{}-{}.db", created_at.format("%Y%m%dT%H%M%SZ"), reason)
}

/// Parses `dinero-<compact utc timestamp>-<reason>.db` back into its parts.
/// The timestamp segment has no hyphens (`T`/`Z` only), so the first
/// remaining `-` after the fixed prefix is always the boundary with `reason`.
fn parse_name(name: &str) -> Option<(DateTime<Utc>, String)> {
    let stripped = name.strip_prefix("dinero-")?.strip_suffix(".db")?;
    let (ts, reason) = stripped.split_once('-')?;
    let naive = chrono::NaiveDateTime::parse_from_str(ts, "%Y%m%dT%H%M%SZ").ok()?;
    Some((
        DateTime::from_naive_utc_and_offset(naive, Utc),
        reason.to_string(),
    ))
}

pub fn list_backups(vault_path: &Path) -> io::Result<Vec<BackupMeta>> {
    let dir = backups_dir(vault_path);
    fs::create_dir_all(&dir)?;
    let mut metas = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if let Some((created_at, reason)) = parse_name(&name) {
            let size_bytes = entry.metadata()?.len();
            metas.push(BackupMeta {
                name,
                reason,
                created_at: created_at.to_rfc3339(),
                size_bytes,
            });
        }
    }
    metas.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(metas)
}

/// Pure (no filesystem) check used to cap `reason = "startup"` at once a day
/// (SPEC-2.md 2.2) — separate from the rotation below, which decides what to
/// keep *after* a backup already exists.
fn already_backed_up_today(backups: &[BackupMeta], reason: &str, today: NaiveDate) -> bool {
    backups.iter().any(|b| {
        b.reason == reason
            && DateTime::parse_from_rfc3339(&b.created_at)
                .map(|d| d.with_timezone(&Utc).date_naive() == today)
                .unwrap_or(false)
    })
}

/// Copies the live db into `vault/backups/` and prunes old ones by the GFS
/// rotation. Returns `None` when nothing was written (no db yet, or a
/// `"startup"` backup already exists for today).
pub fn make_backup(vault_path: &Path, reason: &str) -> io::Result<Option<String>> {
    let source = db_path(vault_path);
    if !source.exists() {
        return Ok(None);
    }

    let existing = list_backups(vault_path)?;
    let today = Utc::now().date_naive();
    if reason == "startup" && already_backed_up_today(&existing, "startup", today) {
        return Ok(None);
    }

    let dir = backups_dir(vault_path);
    let now = Utc::now();
    let name = format_name(&now, reason);
    fs::copy(&source, dir.join(&name))?;

    prune_backups(vault_path)?;
    Ok(Some(name))
}

/// Backs up the current db first (a restore you can't undo is exactly the
/// mistake this feature exists to prevent), then overwrites it with the
/// chosen backup. Mirrors the existing "change vault folder" UX: the caller
/// tells the user to restart rather than us hot-swapping the open connection.
pub fn restore_backup(vault_path: &Path, name: &str) -> io::Result<()> {
    make_backup(vault_path, "before_restore")?;
    let source = backups_dir(vault_path).join(name);
    fs::copy(&source, db_path(vault_path))?;
    Ok(())
}

/// Three independent "keep" buckets — most-recent N overall, one per day for
/// the last N days, one per week for the last N weeks — unioned together.
/// Anything in none of them gets pruned. Kept separate from the filesystem
/// so it has a plain unit test below (this project's first Rust test).
fn backups_to_keep(now: DateTime<Utc>, backups: &[BackupMeta]) -> HashSet<String> {
    let mut parsed: Vec<(String, DateTime<Utc>)> = backups
        .iter()
        .filter_map(|b| {
            DateTime::parse_from_rfc3339(&b.created_at)
                .ok()
                .map(|d| (b.name.clone(), d.with_timezone(&Utc)))
        })
        .collect();
    parsed.sort_by(|a, b| b.1.cmp(&a.1)); // newest first

    let mut keep = HashSet::new();

    for (name, _) in parsed.iter().take(EVENT_KEEP) {
        keep.insert(name.clone());
    }

    // One per day: newest backup of each of the most recent DAILY_KEEP
    // distinct days that have one — "newest of the day" is a more useful
    // representative than an arbitrary older one.
    let mut seen_days = HashSet::new();
    for (name, created_at) in &parsed {
        let day = created_at.date_naive();
        if (now.date_naive() - day).num_days() > DAILY_KEEP as i64 {
            continue;
        }
        if seen_days.insert(day) {
            keep.insert(name.clone());
        }
        if seen_days.len() >= DAILY_KEEP {
            break;
        }
    }

    // Same idea, one per ISO week, for the most recent WEEKLY_KEEP weeks.
    let mut seen_weeks = HashSet::new();
    for (name, created_at) in &parsed {
        let age_days = (now.date_naive() - created_at.date_naive()).num_days();
        if age_days > (WEEKLY_KEEP as i64) * 7 {
            continue;
        }
        let week = created_at.iso_week();
        if seen_weeks.insert((week.year(), week.week())) {
            keep.insert(name.clone());
        }
        if seen_weeks.len() >= WEEKLY_KEEP {
            break;
        }
    }

    keep
}

pub fn prune_backups(vault_path: &Path) -> io::Result<()> {
    let backups = list_backups(vault_path)?;
    let keep = backups_to_keep(Utc::now(), &backups);
    let dir = backups_dir(vault_path);
    for backup in &backups {
        if !keep.contains(&backup.name) {
            let _ = fs::remove_file(dir.join(&backup.name));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn meta(name: &str, reason: &str, created_at: DateTime<Utc>) -> BackupMeta {
        BackupMeta {
            name: format!("{name}.db"),
            reason: reason.to_string(),
            created_at: created_at.to_rfc3339(),
            size_bytes: 0,
        }
    }

    #[test]
    fn name_roundtrips_through_parse() {
        let now = Utc.with_ymd_and_hms(2026, 11, 24, 15, 30, 0).unwrap();
        let name = format_name(&now, "import");
        let (parsed_at, reason) = parse_name(&name).expect("should parse back");
        assert_eq!(reason, "import");
        assert_eq!(parsed_at, now);
    }

    #[test]
    fn startup_backup_is_capped_at_once_a_day() {
        let today = NaiveDate::from_ymd_opt(2026, 11, 24).unwrap();
        let existing = vec![meta(
            "dinero-20261124T080000Z-startup",
            "startup",
            Utc.with_ymd_and_hms(2026, 11, 24, 8, 0, 0).unwrap(),
        )];
        assert!(already_backed_up_today(&existing, "startup", today));
        assert!(!already_backed_up_today(&existing, "import", today));

        let yesterday_only = vec![meta(
            "dinero-20261123T080000Z-startup",
            "startup",
            Utc.with_ymd_and_hms(2026, 11, 23, 8, 0, 0).unwrap(),
        )];
        assert!(!already_backed_up_today(&yesterday_only, "startup", today));
    }

    #[test]
    fn rotation_keeps_recent_daily_and_weekly_but_drops_the_rest() {
        // Anchored late in the day so all 15 "today" backups below (up to
        // 14 hours apart) stay on this same calendar date, not spilling
        // into "yesterday" and confusing the daily bucket.
        let now = Utc.with_ymd_and_hms(2026, 11, 24, 23, 59, 0).unwrap();
        let mut backups = Vec::new();

        // 15 same-day backups, 1 hour apart — only the newest 10 should
        // survive by the event bucket; the day already has a representative
        // among those 10, so the daily bucket adds nothing extra here.
        for hour in 0..15 {
            let name = format!("today-{hour}");
            backups.push(meta(
                &format!("dinero-x-{name}"),
                "event",
                now - chrono::Duration::hours(hour),
            ));
        }

        // One backup each on days 1..6 ago — distinct days, within the
        // 7-day daily window, each too old to be reachable by the event
        // bucket once the 15 same-day ones exist.
        for day in 1..=6 {
            let name = format!("day-{day}");
            backups.push(meta(
                &format!("dinero-x-{name}"),
                "event",
                now - chrono::Duration::days(day),
            ));
        }

        // 10 days ago: too old for the daily bucket (>7 days), but within
        // the 28-day weekly window and in a different ISO week.
        let weekly_rescued = "week-10";
        backups.push(meta(
            &format!("dinero-x-{weekly_rescued}"),
            "event",
            now - chrono::Duration::days(10),
        ));

        // 40 days ago: outside every bucket — must be dropped.
        let too_old = "ancient-40";
        backups.push(meta(
            &format!("dinero-x-{too_old}"),
            "event",
            now - chrono::Duration::days(40),
        ));

        let keep = backups_to_keep(now, &backups);

        for hour in 0..10 {
            let name = format!("dinero-x-today-{hour}.db");
            assert!(keep.contains(&name), "hour {hour} should survive (top 10 by recency)");
        }
        for hour in 10..15 {
            let name = format!("dinero-x-today-{hour}.db");
            assert!(!keep.contains(&name), "hour {hour} is same-day but outside the top 10 — should be pruned");
        }
        for day in 1..=6 {
            let name = format!("dinero-x-day-{day}.db");
            assert!(keep.contains(&name), "day {day} should be rescued by the daily bucket");
        }
        assert!(keep.contains(&format!("dinero-x-{weekly_rescued}.db")));
        assert!(!keep.contains(&format!("dinero-x-{too_old}.db")));
    }
}
