#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::time::Duration;

use serde::Deserialize;
use tauri::{Manager, Window};

#[derive(Debug, Deserialize)]
struct GlassSettings {
    #[allow(dead_code)]
    blur: Option<f64>,
    #[allow(dead_code)]
    opacity: Option<f64>,
}

#[tauri::command]
fn window_control(window: Window, action: String) -> Result<(), String> {
    match action.as_str() {
        "minimize" => window.minimize().map_err(|e| e.to_string()),
        "maximize" => {
            if window.is_maximized().map_err(|e| e.to_string())? {
                window.unmaximize().map_err(|e| e.to_string())
            } else {
                window.maximize().map_err(|e| e.to_string())
            }
        }
        "close" => window.close().map_err(|e| e.to_string()),
        _ => Ok(()),
    }
}

#[tauri::command]
fn is_window_maximized(window: Window) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}

#[tauri::command]
fn start_window_drag(window: Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn move_window_drag() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn end_window_drag() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn set_glass_settings(_window: Window, _settings: GlassSettings) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn fetch_json(url: String) -> Result<serde_json::Value, String> {
    let parsed = reqwest::Url::parse(&url).map_err(|e| e.to_string())?;
    let allowed = [
        "api.deezer.com",
        "itunes.apple.com",
        "en.wikipedia.org",
        "www.theaudiodb.com",
        "www.wikidata.org",
        "commons.wikimedia.org",
    ];
    let host = parsed.host_str().unwrap_or_default();
    if !allowed.contains(&host) {
        return Err(format!("Blocked API host: {host}"));
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get(parsed)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }
    response.json::<serde_json::Value>().await.map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_shadow(false);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            window_control,
            is_window_maximized,
            start_window_drag,
            move_window_drag,
            end_window_drag,
            set_glass_settings,
            fetch_json
        ])
        .run(tauri::generate_context!())
        .expect("error while running Wavely");
}
