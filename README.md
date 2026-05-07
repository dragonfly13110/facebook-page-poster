# Facebook Page Poster

แอพเดสก์ท็อป Tauri + React + TypeScript สำหรับร่างโพสต์, วิเคราะห์ภาพด้วย AI, และตั้งเวลาโพสต์ลง Facebook Page ผ่าน Graph API.

## ฟีเจอร์

- Dashboard
- สร้างโพสต์ใหม่จากรูป
- Queue
- Settings
- SQLite สำหรับเก็บเพจ, โพสต์, log

## วิธีรัน

1. ติดตั้ง Node.js และ Rust
2. ติดตั้ง deps
3. สร้าง `src-tauri/.env`
4. รัน frontend + Tauri

## ตัวแปรแวดล้อม

- `AI_API_KEY`
- `AI_MODEL`
- `FB_APP_ID`
- `FB_APP_SECRET`

## หมายเหตุ

- ห้าม hardcode token
- ใช้ Page Access Token เท่านั้น
- schedule ต้องล่วงหน้าอย่างน้อย 10 นาที และไม่เกิน 30 วัน
