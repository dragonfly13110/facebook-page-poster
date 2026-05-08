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
    .map_err(|e| format!("เน€เธเธทเนเธญเธกเธ•เนเธญ Facebook เนเธกเนเนเธ”เน: {}", e))?;

  if !res.status().is_success() {
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    return Err(format!("Facebook API เธ•เธญเธ {}: {}", status, body));
  }

  res.json::<Value>().await.map_err(|e| format!("เธญเนเธฒเธเธเนเธญเธกเธนเธฅเนเธกเนเธชเธณเน€เธฃเนเธ: {}", e))
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

pub async fn post_photo(
  page_id: &str,
  token: &str,
  public_image_url: &str,
  caption: &str,
) -> Result<Value, String> {
  let res = Client::new()
    .post(format!("https://graph.facebook.com/v25.0/{page_id}/photos"))
    .form(&[
      ("url", public_image_url),
      ("caption", caption),
      ("access_token", token),
      ("published", "true"),
    ])
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
  caption: &str,
  published: bool,
  scheduled_publish_time: Option<i64>,
) -> Result<Value, String> {
  let file_bytes = tokio::fs::read(file_path)
    .await
    .map_err(|e| format!("เธญเนเธฒเธเนเธเธฅเนเธฃเธนเธเนเธกเนเธชเธณเน€เธฃเนเธ: {}", e))?;

  let ext = std::path::Path::new(file_path)
    .extension()
    .and_then(|e| e.to_str())
    .unwrap_or("jpg");
  let mime = match ext {
    "png" => "image/png",
    "gif" => "image/gif",
    "webp" => "image/webp",
    "bmp" => "image/bmp",
    _ => "image/jpeg",
  };

  let part = reqwest::multipart::Part::bytes(file_bytes)
    .file_name(format!("photo.{}", ext))
    .mime_str(mime)
    .map_err(|e| format!("เธชเธฃเนเธฒเธ multipart เนเธกเนเธชเธณเน€เธฃเนเธ: {}", e))?;

  let mut form = reqwest::multipart::Form::new()
    .text("caption", caption.to_string())
    .text("access_token", token.to_string())
    .text("published", published.to_string());
  if let Some(ts) = scheduled_publish_time {
    form = form.text("scheduled_publish_time", ts.to_string());
  }
  let form = form.part("source", part);

  let res = Client::new()
    .post(format!("https://graph.facebook.com/v25.0/{}/photos", page_id))
    .multipart(form)
    .send()
    .await
    .map_err(|e| format!("เธชเนเธเธฃเธนเธเนเธกเนเธชเธณเน€เธฃเนเธ: {}", e))?;

  if !res.status().is_success() {
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    return Err(format!("Facebook API เธ•เธญเธ {}: {}", status, body));
  }

  res.json::<Value>().await.map_err(|e| format!("เธญเนเธฒเธเธเธฅเธฅเธฑเธเธเนเนเธกเนเธชเธณเน€เธฃเนเธ: {}", e))
}
