mod ai;
mod db;
mod facebook;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Default)]
struct AppState {
  db_path: Mutex<Option<String>>,
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

#[tauri::command]
fn init_db(state: State<AppState>) -> Result<(), String> {
  let path = db::init().map_err(|e| e.to_string())?;
  *state.db_path.lock().map_err(|_| "lock".to_string())? = Some(path);
  Ok(())
}

#[tauri::command]
fn save_settings(input: SaveSettingsInput, state: State<AppState>) -> Result<(), String> {
  let db_path = state.db_path.lock().map_err(|_| "lock".to_string())?.clone().ok_or("db not ready")?;
  db::save_page(&db_path, &input.page_id, &input.page_name, &input.access_token).map_err(|e| e.to_string())?;
  std::env::set_var("AI_API_KEY", input.ai_api_key);
  std::env::set_var("AI_MODEL", input.ai_model);
  Ok(())
}

#[tauri::command]
async fn analyze_image(input: AnalyzeImageInput) -> Result<ai::AiResult, String> {
  ai::analyze_image(&input.api_key, &input.model, &input.image_data_url).await
}

#[tauri::command]
fn create_post(input: CreatePostInput, state: State<AppState>) -> Result<i64, String> {
  let db_path = state.db_path.lock().map_err(|_| "lock".to_string())?.clone().ok_or("db not ready")?;
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
  .map_err(|e| e.to_string())?;
  Ok(id)
}

#[tauri::command]
fn list_pages(state: State<AppState>) -> Result<Vec<db::PageRow>, String> {
  let db_path = state.db_path.lock().map_err(|_| "lock".to_string())?.clone().ok_or("db not ready")?;
  db::list_pages(&db_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_posts(state: State<AppState>) -> Result<Vec<db::PostRow>, String> {
  let db_path = state.db_path.lock().map_err(|_| "lock".to_string())?.clone().ok_or("db not ready")?;
  db::list_posts(&db_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn test_facebook(token: String) -> Result<serde_json::Value, String> {
  facebook::get_accounts(&token).await
}

#[tauri::command]
async fn publish_post(input: PublishInput, state: State<AppState>) -> Result<serde_json::Value, String> {
  let db_path = state.db_path.lock().map_err(|_| "lock".to_string())?.clone().ok_or("db not ready")?;
  let scheduled_ts = match input.scheduled_time {
    Some(ref raw) => {
      let dt = DateTime::parse_from_rfc3339(raw).map_err(|e| e.to_string())?.with_timezone(&Utc);
      facebook::validate_schedule_time(dt)?;
      Some(dt.timestamp())
    }
    None => None,
  };

  let published = scheduled_ts.is_none();
  let result = if let Some(url) = input.public_image_url.as_deref() {
    facebook::post_photo(&input.page_id, &input.page_access_token, url, &input.caption).await
  } else {
    facebook::post_feed(&input.page_id, &input.page_access_token, &input.caption, published, scheduled_ts).await
  }?;

  let fb_id = result["id"].as_str().map(|s| s.to_string());
  db::update_post_status(&db_path, input.post_id, if published { "published" } else { "scheduled" }, fb_id.as_deref(), None).map_err(|e| e.to_string())?;
  Ok(result)
}

fn main() {
  tauri::Builder::default()
    .manage(AppState::default())
    .invoke_handler(tauri::generate_handler![
      init_db,
      save_settings,
      analyze_image,
      create_post,
      list_pages,
      list_posts,
      test_facebook,
      publish_post
    ])
    .run(tauri::generate_context!())
    .expect("error");
}

