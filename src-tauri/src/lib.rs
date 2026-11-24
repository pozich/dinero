mod backup;
mod lock;
mod logging;
mod vault;

use lock::LockInfo;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_sql::{Migration, MigrationKind};

struct VaultState {
    db_url: String,
    vault_path: PathBuf,
}

/// The lock that was already on disk when we started, if it was still
/// fresh — stashed so the frontend can show the conflict dialog once the
/// window exists (we can't show UI this early, same reason the vault folder
/// picker had to move to the frontend — see vault.rs).
struct LockConflict(Mutex<Option<LockInfo>>);

#[tauri::command]
fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file_bytes(path: String, contents: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
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

#[tauri::command]
fn get_lock_conflict(state: tauri::State<'_, LockConflict>) -> Option<LockInfo> {
    state.0.lock().unwrap().clone()
}

/// "exit" hands the other device's claim back so the lock file doesn't keep
/// pointing at us after we quit; "readonly"/"anyway" need nothing here, the
/// frontend just remembers its own choice for the read-only banner/buttons.
#[tauri::command]
fn resolve_lock_conflict(
    choice: String,
    vault: tauri::State<'_, VaultState>,
    conflict: tauri::State<'_, LockConflict>,
) {
    if choice == "exit" {
        if let Some(previous) = conflict.0.lock().unwrap().take() {
            lock::restore(&vault.vault_path, &previous);
        }
    }
}

#[tauri::command]
fn detect_sync_conflicts(state: tauri::State<'_, VaultState>) -> Vec<String> {
    vault::detect_sync_conflicts(&state.vault_path)
}

#[tauri::command]
fn make_backup(reason: String, state: tauri::State<'_, VaultState>) -> Result<Option<String>, String> {
    backup::make_backup(&state.vault_path, &reason).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_backups(state: tauri::State<'_, VaultState>) -> Result<Vec<backup::BackupMeta>, String> {
    backup::list_backups(&state.vault_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn restore_backup(name: String, state: tauri::State<'_, VaultState>) -> Result<(), String> {
    backup::restore_backup(&state.vault_path, &name).map_err(|e| e.to_string())
}

#[tauri::command]
fn log_error(
    kind: String,
    location: String,
    detail: Option<String>,
    state: tauri::State<'_, VaultState>,
) {
    logging::log_error(&state.vault_path, &kind, &location, detail.as_deref());
}

#[tauri::command]
fn open_logs_folder(app: tauri::AppHandle, state: tauri::State<'_, VaultState>) -> Result<(), String> {
    let path = logging::logs_dir(&state.vault_path);
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    app.opener()
        .open_path(path.to_string_lossy().to_string(), None::<String>)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let vault_path = vault::resolve_vault_path();
    let db_url = vault::db_url_for(&vault_path);

    // Read whatever lock was already there *before* claiming it as ours —
    // the frontend needs the "before" picture to show the conflict dialog.
    let previous_lock = lock::check_and_claim(&vault_path);

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
        Migration {
            version: 3,
            description: "transfer_status",
            sql: include_str!("../migrations/0003_transfer_status.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "manual_categories_rules",
            sql: include_str!("../migrations/0004_manual_categories_rules.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "ledger",
            sql: include_str!("../migrations/0005_ledger.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "recurring_series",
            sql: include_str!("../migrations/0006_recurring_series.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "dashboard_presets",
            sql: include_str!("../migrations/0007_dashboard_presets.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "debts",
            sql: include_str!("../migrations/0008_debts.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "investments",
            sql: include_str!("../migrations/0009_investments.sql"),
            kind: MigrationKind::Up,
        },
    ];

    let heartbeat_vault_path = vault_path.clone();
    let release_vault_path = vault_path.clone();

    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(60));
        lock::heartbeat(&heartbeat_vault_path);
    });

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&db_url, migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .manage(VaultState { db_url, vault_path })
        .manage(LockConflict(Mutex::new(previous_lock)))
        .on_window_event(move |_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                lock::release(&release_vault_path);
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_file_bytes,
            write_file_bytes,
            get_db_url,
            set_vault_path,
            get_lock_conflict,
            resolve_lock_conflict,
            detect_sync_conflicts,
            make_backup,
            list_backups,
            restore_backup,
            log_error,
            open_logs_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
