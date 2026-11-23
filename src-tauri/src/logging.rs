use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

const MAX_LOG_BYTES: u64 = 1_000_000;
const MAX_ROTATED: u32 = 5;

pub fn logs_dir(vault_path: &Path) -> PathBuf {
    vault_path.join("logs")
}

fn log_file(vault_path: &Path) -> PathBuf {
    logs_dir(vault_path).join("dinero.log")
}

fn rotate_if_needed(vault_path: &Path) {
    let path = log_file(vault_path);
    let Ok(meta) = fs::metadata(&path) else {
        return;
    };
    if meta.len() < MAX_LOG_BYTES {
        return;
    }
    let dir = logs_dir(vault_path);
    for i in (1..MAX_ROTATED).rev() {
        let from = dir.join(format!("dinero.log.{i}"));
        let to = dir.join(format!("dinero.log.{}", i + 1));
        let _ = fs::rename(from, to);
    }
    let _ = fs::rename(&path, dir.join("dinero.log.1"));
}

/// Appends one structural line: timestamp, error kind, location, optional
/// id. SPEC-2.md 2.4 is explicit that this file must never contain
/// transaction descriptions, names, IINs or account numbers — callers are
/// responsible for only ever passing structural identifiers, never user data.
pub fn log_error(vault_path: &Path, kind: &str, location: &str, detail: Option<&str>) {
    let dir = logs_dir(vault_path);
    if fs::create_dir_all(&dir).is_err() {
        return;
    }
    rotate_if_needed(vault_path);

    let timestamp = chrono::Utc::now().to_rfc3339();
    let line = match detail {
        Some(d) => format!("{timestamp} {kind} {location} {d}\n"),
        None => format!("{timestamp} {kind} {location}\n"),
    };
    if let Ok(mut file) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_file(vault_path))
    {
        let _ = file.write_all(line.as_bytes());
    }
}
