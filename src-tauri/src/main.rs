mod ai;
mod db;
mod facebook;
mod scheduler;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

struct AppState {
  db_path: Mutex<Option<String>>,
  scheduler: Mutex<Option<scheduler::SchedulerHandle>>,
}

impl Default for AppState {
  fn default() -> Self {
    AppState {
      db_path: Mutex::new(None),
      scheduler: Mutex::new(None),
    }
  }
}

#[derive(Debug, Deserialize, Serialize)]
struct SaveSettingsInput {
  page_id: String,
  page_name: String,
  access_token: String,
  ai_api_key: String,
  ai_model: String,
}

#[derive(Debug, Deserialize)]
struct AnalyzeImageInput {
  api_key: String,
  model: String,
  image_data_url: String,
}

#[derive(Debug, Deserialize)]
struct CreatePostInput {
  local_image_path: Option<String>,
  public_image_url: Option<String>,
  ai_analysis: Option<String>,
  caption: String,
  hashtags: Option<String>,
  page_id: String,
  scheduled_time: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PublishInput {
  post_id: i64,
  page_id: String,
  page_access_token: String,
  caption: String,
  public_image_url: Option<String>,
  scheduled_time: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DeleteInput {
  post_id: i64,
}

#[derive(Debug, Deserialize)]
struct RetryInput {
  post_id: i64,
  page_id: String,
  page_access_token: String,
}

#[derive(Debug, Deserialize)]
struct EditPostInput {
  post_id: i64,
  caption: String,
  hashtags: Option<String>,
  scheduled_time: Option<String>,
  public_image_url: Option<String>,
}

fn db_lock(state: &State<AppState>) -> Result<String, String> {
  state
    .db_path
    .lock()
    .map_err(|_| "ไม่สามารถเข้าถึงฐานข้อมูลได้".to_string())?
    .clone()
    .ok_or("ยังไม่ได้เริ่มฐานข้อมูล กรุณาเปิดแอปใหม่".to_string())
}

#[tauri::command]
fn get_env_settings() -> Result<serde_json::Value, String> {
  Ok(serde_json::json!({
    "fb_page_id": std::env::var("FB_PAGE_ID").unwrap_or_default(),
    "fb_page_name": std::env::var("FB_PAGE_NAME").unwrap_or_default(),
    "fb_page_access_token": std::env::var("FB_PAGE_ACCESS_TOKEN").unwrap_or_default(),
    "fb_user_access_token": std::env::var("FB_USER_ACCESS_TOKEN").unwrap_or_default(),
    "ai_api_key": std::env::var("AI_API_KEY").unwrap_or_default(),
    "ai_model": std::env::var("AI_MODEL").unwrap_or_default(),
  }))
}

#[tauri::command]
fn init_db(state: State<AppState>) -> Result<(), String> {
  let path = db::init().map_err(|e| format!("สร้างฐานข้อมูลไม่สำเร็จ: {}", e))?;
  *state.db_path.lock().map_err(|_| "lock error".to_string())? = Some(path.clone());

  let handle = scheduler::start(path);
  *state.scheduler.lock().map_err(|_| "lock error".to_string())? = Some(handle);

  Ok(())
}

#[tauri::command]
fn save_settings(input: SaveSettingsInput, state: State<AppState>) -> Result<(), String> {
  let db_path = db_lock(&state)?;
  if input.page_id.is_empty() || input.access_token.is_empty() {
    return Err("กรุณากรอก Page ID และ Access Token".to_string());
  }
  db::save_page(&db_path, &input.page_id, &input.page_name, &input.access_token)
    .map_err(|e| format!("บันทึกตั้งค่าไม่สำเร็จ: {}", e))?;
  db::insert_log(&db_path, "info", "บันทึกตั้งค่าสำเร็จ", None)
    .map_err(|e| format!("บันทึก log ไม่สำเร็จ: {}", e))?;
  Ok(())
}

#[tauri::command]
async fn analyze_image(input: AnalyzeImageInput) -> Result<ai::AiResult, String> {
  ai::analyze_image(&input.api_key, &input.model, &input.image_data_url).await
}

#[tauri::command]
fn create_post(input: CreatePostInput, state: State<AppState>) -> Result<i64, String> {
  let db_path = db_lock(&state)?;
  if input.caption.is_empty() {
    return Err("กรุณากรอกแคปชัน".to_string());
  }
  let id = db::insert_post(
    &db_path,
    input.local_image_path.as_deref(),
    input.public_image_url.as_deref(),
    input.ai_analysis.as_deref(),
    &input.caption,
    input.hashtags.as_deref(),
    &input.page_id,
    input.scheduled_time.as_deref(),
    if input.scheduled_time.is_some() { "scheduled" } else { "draft" },
  )
  .map_err(|e| format!("สร้างโพสต์ไม่สำเร็จ: {}", e))?;

  db::insert_log(
    &db_path,
    "info",
    &format!("สร้างโพสต์ #{}, สถานะ: {}", id, if input.scheduled_time.is_some() { "scheduled" } else { "draft" }),
    None,
  ).ok();
  Ok(id)
}

#[tauri::command]
fn edit_post(input: EditPostInput, state: State<AppState>) -> Result<(), String> {
  let db_path = db_lock(&state)?;
  if input.caption.is_empty() {
    return Err("กรุณากรอกแคปชัน".to_string());
  }
  db::edit_post(
    &db_path,
    input.post_id,
    &input.caption,
    input.hashtags.as_deref(),
    input.scheduled_time.as_deref(),
    input.public_image_url.as_deref(),
  )
  .map_err(|e| format!("แก้ไขโพสต์ไม่สำเร็จ: {}", e))?;
  db::insert_log(&db_path, "info", &format!("แก้ไขโพสต์ #{}", input.post_id), None).ok();
  Ok(())
}

#[tauri::command]
fn delete_post(input: DeleteInput, state: State<AppState>) -> Result<(), String> {
  let db_path = db_lock(&state)?;
  db::delete_post(&db_path, input.post_id)
    .map_err(|e| format!("ลบโพสต์ไม่สำเร็จ: {}", e))?;
  db::insert_log(&db_path, "info", &format!("ลบโพสต์ #{}", input.post_id), None).ok();
  Ok(())
}

#[tauri::command]
fn list_pages(state: State<AppState>) -> Result<Vec<db::PageRow>, String> {
  let db_path = db_lock(&state)?;
  db::list_pages(&db_path).map_err(|e| format!("อ่านรายการเพจไม่สำเร็จ: {}", e))
}

#[tauri::command]
fn list_posts(state: State<AppState>) -> Result<Vec<db::PostRow>, String> {
  let db_path = db_lock(&state)?;
  db::list_posts(&db_path).map_err(|e| format!("อ่านรายการโพสต์ไม่สำเร็จ: {}", e))
}

#[tauri::command]
fn get_post(post_id: i64, state: State<AppState>) -> Result<db::PostRow, String> {
  let db_path = db_lock(&state)?;
  db::get_post(&db_path, post_id).map_err(|e| format!("อ่านโพสต์ไม่สำเร็จ: {}", e))
}

#[tauri::command]
async fn test_facebook(token: String) -> Result<serde_json::Value, String> {
  facebook::get_accounts(&token).await
}

#[tauri::command]
async fn publish_post(input: PublishInput, state: State<AppState>) -> Result<serde_json::Value, String> {
  let db_path = db_lock(&state)?;

  let scheduled_ts = match input.scheduled_time {
    Some(ref raw) => {
      let dt = DateTime::parse_from_rfc3339(raw)
        .map_err(|e| format!("รูปแบบเวลาไม่ถูกต้อง: {}", e))?
        .with_timezone(&Utc);
      facebook::validate_schedule_time(dt)?;
      Some(dt.timestamp())
    }
    None => None,
  };

  let published = scheduled_ts.is_none();
  let result = if let Some(url) = input.public_image_url.as_deref() {
    if !url.starts_with("https://") && !url.starts_with("http://") {
      return Err("public_image_url ต้องเป็น URL จริงเท่านั้น (ไม่ใช่ data URL)".to_string());
    }
    facebook::post_photo(&input.page_id, &input.page_access_token, url, &input.caption).await
  } else {
    facebook::post_feed(
      &input.page_id, &input.page_access_token, &input.caption,
      published, scheduled_ts,
    ).await
  };

  match &result {
    Ok(res) => {
      let fb_id = res["id"].as_str().map(|s| s.to_string());
      db::update_post_status(&db_path, input.post_id, if published { "published" } else { "scheduled" }, fb_id.as_deref(), None)
        .map_err(|e| format!("อัปเดตสถานะไม่สำเร็จ: {}", e))?;
      db::insert_log(&db_path, "info", &format!("โพสต์ #{} สำเร็จ", input.post_id), None).ok();
    }
    Err(e) => {
      db::update_post_status(&db_path, input.post_id, "failed", None, Some(e)).map_err(|_| ())?;
      db::insert_log(&db_path, "error", &format!("โพสต์ #{} ล้มเหลว: {}", input.post_id, e), None).ok();
    }
  }

  result
}

#[tauri::command]
async fn retry_post(input: RetryInput, state: State<AppState>) -> Result<serde_json::Value, String> {
  let db_path = db_lock(&state)?;
  let post = db::get_post(&db_path, input.post_id).map_err(|e| format!("อ่านโพสต์ไม่สำเร็จ: {}", e))?;

  if post.status != "failed" {
    return Err("โพสต์นี้ไม่ได้อยู่ในสถานะ failed".to_string());
  }

  let result = if let Some(ref url) = post.public_image_url {
    facebook::post_photo(&input.page_id, &input.page_access_token, url, &post.caption).await
  } else {
    facebook::post_feed(&input.page_id, &input.page_access_token, &post.caption, true, None).await
  };

  match &result {
    Ok(res) => {
      let fb_id = res["id"].as_str().map(|s| s.to_string());
      db::update_post_status(&db_path, input.post_id, "published", fb_id.as_deref(), None)
        .map_err(|e| format!("อัปเดตสถานะไม่สำเร็จ: {}", e))?;
      db::insert_log(&db_path, "info", &format!("retry โพสต์ #{} สำเร็จ", input.post_id), None).ok();
    }
    Err(e) => {
      db::update_post_status(&db_path, input.post_id, "failed", None, Some(e)).map_err(|_| ())?;
      db::insert_log(&db_path, "error", &format!("retry โพสต์ #{} ล้มเหลว: {}", input.post_id, e), None).ok();
    }
  }

  result
}

fn main() {
  tauri::Builder::default()
    .manage(AppState::default())
    .invoke_handler(tauri::generate_handler![
      init_db,
      get_env_settings,
      save_settings,
      analyze_image,
      create_post,
      edit_post,
      delete_post,
      get_post,
      list_pages,
      list_posts,
      test_facebook,
      publish_post,
      retry_post,
    ])
    .run(tauri::generate_context!())
    .expect("error");
}
