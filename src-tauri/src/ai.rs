use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiResult {
  pub raw_text: String,
  pub caption: String,
  pub hashtags: String,
  pub analysis_json: String,
}

pub fn vision_prompt() -> &'static str {
  "วิเคราะห์ภาพนี้อย่างละเอียด แล้วสร้างข้อความโพสต์ Facebook ภาษาไทยที่เหมาะกับงานส่งเสริมการเกษตร ใช้ภาษาคนทั่วไป อ่านง่าย ไม่ขายของเกินไป ไม่ใช้ประโยคเว่อร์ ไม่ใช้คำว่า ไม่ใช่แค่, ไม่เพียงแต่, ยกระดับ, ขับเคลื่อน, พัฒนาอย่างยั่งยืน, พลาดไม่ได้ และอย่าใช้เครื่องหมาย — ให้สร้าง 3 แบบ ได้แก่ แบบให้ความรู้ แบบเล่าสั้นๆ และแบบราชการอ่านง่าย พร้อม hashtag 5-8 คำ"
}

pub async fn analyze_image(api_key: &str, model: &str, image_data_url: &str) -> Result<AiResult, String> {
  let body = json!({
    "model": model,
    "messages": [
      {
        "role": "user",
        "content": [
          { "type": "text", "text": vision_prompt() },
          { "type": "image_url", "image_url": { "url": image_data_url } }
        ]
      }
    ]
  });

  let res = Client::new()
    .post("https://api.openai.com/v1/chat/completions")
    .bearer_auth(api_key)
    .json(&body)
    .send()
    .await
    .map_err(|e| e.to_string())?;

  let value: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
  let text = value["choices"][0]["message"]["content"]
    .as_str()
    .unwrap_or("")
    .to_string();

  Ok(AiResult {
    raw_text: text.clone(),
    caption: text.clone(),
    hashtags: "#เกษตรไทย #ภาพข่าว #ชุมชน #พัฒนา #ลงพื้นที่".to_string(),
    analysis_json: json!({ "raw": text }).to_string(),
  })
}

