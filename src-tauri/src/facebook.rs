use chrono::{DateTime, Utc};
use reqwest::Client;
use serde_json::Value;

pub fn validate_schedule_time(scheduled: DateTime<Utc>) -> Result<(), String> {
  let now = Utc::now();
  if scheduled < now + chrono::Duration::minutes(10) {
    return Err("เวลาตั้งโพสต์ต้องล่วงหน้าอย่างน้อย 10 นาที".into());
  }
  if scheduled > now + chrono::Duration::days(30) {
    return Err("เวลาตั้งโพสต์ต้องไม่เกิน 30 วัน".into());
  }
  Ok(())
}

pub async fn test_token(token: &str) -> Result<Value, String> {
  let res = Client::new()
    .get("https://graph.facebook.com/v25.0/me")
    .query(&[("fields", "id,name"), ("access_token", token)])
    .send()
    .await
    .map_err(|e| format!("เชื่อมต่อ Facebook ไม่ได้: {}", e))?;

  if !res.status().is_success() {
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    return Err(format!("Facebook API ตอบ {}: {}", status, body));
  }

  res.json::<Value>().await.map_err(|e| format!("อ่านข้อมูลไม่สำเร็จ: {}", e))
}

pub async fn get_accounts(user_token: &str) -> Result<Value, String> {
  let res = Client::new()
    .get("https://graph.facebook.com/v25.0/me/accounts")
    .query(&[
      ("fields", "id,name,access_token,tasks"),
      ("access_token", user_token),
    ])
    .send()
    .await
    .map_err(|e| format!("เชื่อมต่อ Facebook ไม่ได้: {}", e))?;

  if !res.status().is_success() {
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    return Err(format!("Facebook API ตอบ {}: {}", status, body));
  }

  res.json::<Value>().await.map_err(|e| format!("อ่านข้อมูลเพจไม่สำเร็จ: {}", e))
}

pub async fn post_feed(
  page_id: &str,
  token: &str,
  message: &str,
  published: bool,
  scheduled_publish_time: Option<i64>,
) -> Result<Value, String> {
  let client = Client::new();
  let mut form = vec![
    ("message", message.to_string()),
    ("published", published.to_string()),
    ("access_token", token.to_string()),
  ];
  if let Some(ts) = scheduled_publish_time {
    form.push(("scheduled_publish_time", ts.to_string()));
  }
  let res = client
    .post(format!("https://graph.facebook.com/v25.0/{page_id}/feed"))
    .form(&form)
    .send()
    .await
    .map_err(|e| format!("ส่งโพสต์ไม่สำเร็จ: {}", e))?;

  if !res.status().is_success() {
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    return Err(format!("Facebook API ตอบ {}: {}", status, body));
  }

  res.json::<Value>().await.map_err(|e| format!("อ่านผลลัพธ์ไม่สำเร็จ: {}", e))
}

pub async fn post_feed_with_attached_photo(
  page_id: &str,
  token: &str,
  message: &str,
  media_fbid: &str,
  scheduled_publish_time: i64,
) -> Result<Value, String> {
  let attached_media = serde_json::json!({ "media_fbid": media_fbid }).to_string();
  let form = vec![
    ("message", message.to_string()),
    ("published", "false".to_string()),
    ("scheduled_publish_time", scheduled_publish_time.to_string()),
    ("attached_media[0]", attached_media),
    ("access_token", token.to_string()),
  ];

  let res = Client::new()
    .post(format!("https://graph.facebook.com/v25.0/{page_id}/feed"))
    .form(&form)
    .send()
    .await
    .map_err(|e| format!("ส่งโพสต์รูปไม่สำเร็จ: {}", e))?;

  if !res.status().is_success() {
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    return Err(format!("Facebook API ตอบ {}: {}", status, body));
  }

  res.json::<Value>().await.map_err(|e| format!("อ่านผลลัพธ์ไม่สำเร็จ: {}", e))
}

pub async fn post_photo(
  page_id: &str,
  token: &str,
  image_url: &str,
  caption: &str,
  published: bool,
  scheduled_publish_time: Option<i64>,
) -> Result<Value, String> {
  let client = Client::new();
  let mut form = vec![
    ("url", image_url.to_string()),
    ("caption", caption.to_string()),
    ("published", published.to_string()),
    ("access_token", token.to_string()),
  ];
  if let Some(ts) = scheduled_publish_time {
    form.push(("scheduled_publish_time", ts.to_string()));
  }

  let res = client
    .post(format!("https://graph.facebook.com/v25.0/{page_id}/photos"))
    .form(&form)
    .send()
    .await
    .map_err(|e| format!("ส่งรูปไม่สำเร็จ: {}", e))?;

  if !res.status().is_success() {
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    return Err(format!("Facebook API ตอบ {}: {}", status, body));
  }

  res.json::<Value>().await.map_err(|e| format!("อ่านผลลัพธ์ไม่สำเร็จ: {}", e))
}

pub async fn post_photo_file(
  page_id: &str,
  token: &str,
  file_path: &str,
  message: &str,
  published: bool,
  scheduled_publish_time: Option<i64>,
) -> Result<Value, String> {
  let image_bytes = tokio::fs::read(file_path)
    .await
    .map_err(|e| format!("อ่านไฟล์รูปไม่สำเร็จ: {}", e))?;
  let path = std::path::Path::new(file_path);
  let filename = path
    .file_name()
    .and_then(|s| s.to_str())
    .unwrap_or("photo.png")
    .to_string();
  let ext = path
    .extension()
    .and_then(|e| e.to_str())
    .unwrap_or("png")
    .to_ascii_lowercase();
  let mime = match ext.as_str() {
    "jpg" | "jpeg" => "image/jpeg",
    "png" => "image/png",
    "gif" => "image/gif",
    "webp" => "image/webp",
    "bmp" => "image/bmp",
    _ => "application/octet-stream",
  };

  let part = reqwest::multipart::Part::bytes(image_bytes)
    .file_name(filename)
    .mime_str(mime)
    .map_err(|e| format!("สร้าง multipart ไม่สำเร็จ: {}", e))?;

  let mut form = reqwest::multipart::Form::new()
    .text("caption", message.to_string())
    .text("access_token", token.to_string())
    .text("published", published.to_string());
  if let Some(ts) = scheduled_publish_time {
    form = form.text("scheduled_publish_time", ts.to_string());
  }
  let form = form.part("source", part);

  let res = Client::new()
    .post(format!("https://graph.facebook.com/v25.0/{page_id}/photos"))
    .multipart(form)
    .send()
    .await
    .map_err(|e| format!("ส่งรูปไม่สำเร็จ: {}", e))?;

  if !res.status().is_success() {
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    return Err(format!("Facebook API ตอบ {}: {}", status, body));
  }

  res.json::<Value>().await.map_err(|e| format!("อ่านผลลัพธ์ไม่สำเร็จ: {}", e))
}
