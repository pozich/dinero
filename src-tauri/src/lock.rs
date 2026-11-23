use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// No heartbeat for this long means the process that held the lock is gone
/// (crashed, force-quit) — SPEC-2.md 2.1 calls this "протухший", and we take
/// it over automatically instead of asking, since there's nothing left to
/// protect against.
const STALE_MINUTES: i64 = 5;

#[derive(Serialize, Deserialize, Clone)]
pub struct LockInfo {
    pub device: String,
    pub pid: u32,
    pub started_at: String,
    pub heartbeat_at: String,
}

fn lock_file(vault_path: &Path) -> PathBuf {
    vault_path.join("dinero.lock")
}

fn current_device() -> String {
    gethostname::gethostname().to_string_lossy().into_owned()
}

fn read_lock(vault_path: &Path) -> Option<LockInfo> {
    let text = fs::read_to_string(lock_file(vault_path)).ok()?;
    serde_json::from_str(&text).ok()
}

fn write_lock(vault_path: &Path, info: &LockInfo) {
    if let Ok(json) = serde_json::to_string_pretty(info) {
        let _ = fs::write(lock_file(vault_path), json);
    }
}

fn is_stale(info: &LockInfo) -> bool {
    match DateTime::parse_from_rfc3339(&info.heartbeat_at) {
        Ok(heartbeat) => {
            Utc::now()
                .signed_duration_since(heartbeat.with_timezone(&Utc))
                .num_minutes()
                > STALE_MINUTES
        }
        // A lock file we can't parse can't tell us anything useful — treat
        // it as stale rather than blocking the user over a corrupt file.
        Err(_) => true,
    }
}

fn claim(vault_path: &Path) {
    let now = Utc::now().to_rfc3339();
    write_lock(
        vault_path,
        &LockInfo {
            device: current_device(),
            pid: std::process::id(),
            started_at: now.clone(),
            heartbeat_at: now,
        },
    );
}

/// Called once at startup, before we write our own lock. Returns the
/// previous lock only if it was still fresh — the frontend decides what to
/// do with that (SPEC-2.md 2.1: readonly / open anyway / exit). We claim the
/// lock either way, since from this point on *we* are the live process and
/// other instances starting up need to see that.
pub fn check_and_claim(vault_path: &Path) -> Option<LockInfo> {
    let previous = read_lock(vault_path).filter(|info| !is_stale(info));
    claim(vault_path);
    previous
}

/// Re-writes the heartbeat timestamp, but only if this process still owns
/// the lock — guards against clobbering a fresher claim in the unlikely case
/// two processes raced at startup.
pub fn heartbeat(vault_path: &Path) {
    if let Some(mut info) = read_lock(vault_path) {
        if info.pid == std::process::id() && info.device == current_device() {
            info.heartbeat_at = Utc::now().to_rfc3339();
            write_lock(vault_path, &info);
        }
    }
}

pub fn release(vault_path: &Path) {
    let _ = fs::remove_file(lock_file(vault_path));
}

/// Used when the user picks "Выйти" on the conflict dialog — put the other
/// device's claim back so it doesn't look like we're still the active writer.
pub fn restore(vault_path: &Path, info: &LockInfo) {
    write_lock(vault_path, info);
}
