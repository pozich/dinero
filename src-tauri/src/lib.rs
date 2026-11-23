mod vault;

use std::path::PathBuf;
use tauri_plugin_sql::{Migration, MigrationKind};

struct VaultState {
    db_url: String,
}

#[tauri::command]
fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_db_url(state: tauri::State<'_, VaultState>) -> String {
    state.db_url.clone()
}

/// Persists the chosen vault folder for the *next* launch — the JS side
/// picks the folder (the dialog plugin, with the app's own window already
/// running) and tells the user to restart afterward; this process's open
/// database connection is left alone.
#[tauri::command]
fn set_vault_path(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    if !path.is_dir() {
        return Err("not a directory".into());
    }
    vault::write_pointer(&path);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let vault_path = vault::resolve_vault_path();
    let db_url = vault::db_url_for(&vault_path);

    let migrations = vec![
        Migration {
            version: 1,
            description: "init_schema",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "category_rules",
            sql: include_str!("../migrations/0002_category_rules.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&db_url, migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .manage(VaultState { db_url })
        .invoke_handler(tauri::generate_handler![
            read_file_bytes,
            get_db_url,
            set_vault_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
