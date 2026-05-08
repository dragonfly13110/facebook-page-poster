use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiResult {
  pub raw_text: String,
  pub captions_json: String,
  pub caption: String,
  pub hashtags: String,
  pub analysis_json: String,
}

pub fn vision_prompt() -> &'static str {
  "วิเคราะห์ภาพนี้อย่างละเอียด แล้วสร้างข้อความโพสต์ Facebook ภาษาไทยสำหรับเพจเกษตร\n\
   เขียนเหมือนเล่าเรื่องให้เกษตรกรฟัง ใช้ภาษาคนทั่วไป สั้น ตรงประเด็น อ่านแล้วรู้สึกเหมือนเพื่อนคุยกัน\n\
   \n\
   สิ่งที่ต้องหลีกเลี่ยงโดยเด็ดขาด:\n\
   - ห้ามใช้ประโยคสำเร็จรูป เช่น \"ไม่ใช่แค่...แต่ยัง...\" \"ไม่เพียงแต่...แต่ยัง...\"\n\
   - ห้ามใช้คำขายของเกินจริง เช่น \"ชัดสุด\" \"สรุปชัด\" \"จบในโพสต์เดียว\" \"รู้แล้วชีวิตเปลี่ยน\" \"เกษตรกรต้องรู้\" \"ฮีโร่พิทักษ์\"\n\
   - ห้ามเขียนเหมือน AI หรือบทความราชการ ต้องเป็นธรรมชาติ\n\
   \n\
   รูปแบบการเขียน:\n\
   - ใส่ emoticon 🎯🌱💧🌾 แทรกในเนื้อหาตามบริบท\n\
   - ถ้าต้องการลำดับหัวข้อ ให้ใช้อีโมจิตัวเลข เช่น 1️⃣2️⃣3️⃣\n\
   - คำสำคัญให้ใส่ # ไว้ข้างหน้า เช่น #ดินดี #น้ำเพียงพอ\n\
   - หลีกเลี่ยงการทำตัวหนา ใช้ \"\" คร่อมคำที่ต้องการเน้นแทน\n\
   - อย่าใส่ชื่อผู้เขียน\n\
   - ปิดท้ายด้วย hashtags 3-5 ตัว\n\
   \n\
   ให้ตอบกลับในรูปแบบ JSON เท่านั้น:\n\
   {\n  \"captions\": [\n    {\"style\": \"ให้ความรู้\", \"text\": \"...\"},\n    {\"style\": \"เล่าสั้นๆ\", \"text\": \"...\"},\n    {\"style\": \"เป็นกันเอง\", \"text\": \"...\"}\n  ],\n  \"hashtags\": [\"#tag1\", \"#tag2\"]\n}"
}

fn parse_data_url(data_url: &str) -> Option<(String, String)> {
  let after_comma = data_url.split(',').nth(1)?;
  let mime = data_url.split(':').nth(1)?.split(';').next()?;
  Some((mime.to_string(), after_comma.to_string()))
}

fn parse_caption(text: &str) -> String {
  if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(text) {
    if let Some(captions) = json_val["captions"].as_array() {
      if let Some(first) = captions.first() {
        return first["text"].as_str().unwrap_or(text).to_string();
      }
    }
  }
  text.to_string()
}

fn parse_hashtags(text: &str) -> String {
  if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(text) {
    if let Some(tags) = json_val["hashtags"].as_array() {
      return tags
        .iter()
        .filter_map(|t| t.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    }
  }
  String::new()
}

pub async fn analyze_image(api_key: &str, model: &str, image_data_url: &str) -> Result<AiResult, String> {
  let (mime_type, base64_data) =
    parse_data_url(image_data_url).ok_or("ไม่สามารถอ่านข้อมูลรูปได้")?;

  let body = json!({
    "contents": [{
      "parts": [
        { "text": vision_prompt() },
        { "inline_data": { "mime_type": mime_type, "data": base64_data } }
      ]
    }],
    "generationConfig": {
      "response_mime_type": "application/json "
    }
  });

  let url = format!(
    "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
    model, api_key
  );

  let res = Client::new()
    .post(&url)
    .json(&body)
    .send()
    .await
    .map_err(|e| format!("เรียก Gemini API ไม่สำเร็จ: {}", e))?;

  if !res.status().is_success() {
    let status = res.status();
    let err_body = res.text().await.unwrap_or_default();
    return Err(format!("Gemini API ตอบ {}: {}", status, err_body));
  }

  let value: serde_json::Value =
    res.json().await.map_err(|e| format!("อ่านผลลัพธ์ AI ไม่ได้: {}", e))?;

  let text = value["candidates"][0]["content"]["parts"][0]["text"]
    .as_str()
    .unwrap_or("")
    .to_string();

  if text.is_empty() {
    return Err("AI ไม่ได้ส่งข้อความกลับมา".to_string());
  }

  let captions = value["candidates"][0]["content"]["parts"][0]["text"]
    .as_str()
    .unwrap_or("")
    .to_string();

  let caption = parse_caption(&text);
  let hashtags = parse_hashtags(&text);

  Ok(AiResult {
    caption,
    hashtags,
    raw_text: text.clone(),
    captions_json: captions,
    analysis_json: json!({ "raw": text }).to_string(),
  })
}
