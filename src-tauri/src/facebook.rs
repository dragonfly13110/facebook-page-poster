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
