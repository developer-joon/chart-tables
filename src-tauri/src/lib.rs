use std::fs;
use std::path::Path;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

#[tauri::command]
fn save_file(path: String, contents: String) {
    fs::write(path, contents).unwrap();
}

#[tauri::command]
fn save_image(path: String, contents: Vec<u8>) -> Result<(), String> {
    // 경로가 유효한지 확인하고 디렉토리 생성
    let path_obj = Path::new(&path);
    if let Some(parent) = path_obj.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            return Err(format!("Failed to create directories: {}", e));
        }
    }

    // 바이너리 데이터를 파일에 저장
    fs::write(&path, &contents).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![save_file, save_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
