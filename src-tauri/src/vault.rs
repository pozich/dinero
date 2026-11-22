use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize)]
struct VaultPointer {
    vault_path: String,
}

/// The one thing that lives outside the vault itself — otherwise there's
/// nowhere to look on startup to find it (SPEC.md 2).
fn pointer_file() -> PathBuf {
    let config_dir = dirs::config_dir().expect("no OS config directory found");
    config_dir.join("dinero").join("vault.json")
}

fn read_pointer() -> Option<PathBuf> {
    let text = fs::read_to_string(pointer_file()).ok()?;
    let pointer: VaultPointer = serde_json::from_str(&text).ok()?;
    let path = PathBuf::from(pointer.vault_path);
    path.is_dir().then_some(path)
}

pub fn write_pointer(path: &Path) {
    let file = pointer_file();
    if let Some(parent) = file.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let pointer = VaultPointer {
        vault_path: path.to_string_lossy().into_owned(),
    };
    if let Ok(json) = serde_json::to_string_pretty(&pointer) {
        let _ = fs::write(file, json);
    }
}

fn default_vault_path() -> PathBuf {
    let base = dirs::document_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(std::env::temp_dir);
    base.join("Dinero")
}

/// Resolves the vault folder for this run: the one remembered from last
/// time, or a sensible default on first run (no dialog — showing one here
/// would fight Tauri's own GTK main loop before it exists). The user can
/// move to a different folder later, from inside the running app, via the
/// "Данные" tab — SPEC.md 2.
pub fn resolve_vault_path() -> PathBuf {
    let path = read_pointer().unwrap_or_else(default_vault_path);
    fs::create_dir_all(&path).expect("could not create the vault directory");
    write_pointer(&path);
    path
}

pub fn db_url_for(vault_path: &Path) -> String {
    format!("sqlite:{}", vault_path.join("dinero.db").to_string_lossy())
}
