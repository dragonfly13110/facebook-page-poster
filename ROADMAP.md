# แผนพัฒนาต่อ Facebook Page Poster

เอกสารนี้สรุปลำดับงานที่ควรทำต่อ เพื่อให้แอพจาก MVP กลายเป็นเครื่องมือที่ใช้งานจริงได้อย่างมั่นใจสำหรับจัดการโพสต์ Facebook Page ในเครื่อง

## ภาพรวมสถานะปัจจุบัน

แอพมีโครงหลักแล้ว ได้แก่ React UI, Tauri command, SQLite schema, หน้า Dashboard, หน้าเพิ่มโพสต์, หน้า Queue, หน้า Settings, การรับรูปแบบ drag and drop, การเรียก AI Vision เบื้องต้น และโครงเรียก Meta Graph API

จุดที่ยังเป็น MVP คือการจัดเก็บ token ยังไม่ปลอดภัยพอสำหรับงานจริง, การโพสต์รูปยังต้องมี public image URL, ระบบ queue ยังไม่มี worker ที่คอยปล่อยโพสต์ตามเวลาอัตโนมัติ, และ error handling ยังควรทำให้อ่านง่ายขึ้น

## ลำดับที่ควรทำต่อ

1. ทำระบบเก็บความลับให้ปลอดภัย

ควรย้าย `Page Access Token` และ `AI API Key` ออกจาก `localStorage` และฐานข้อมูลแบบ plaintext ไปเก็บใน secure storage ของเครื่อง เช่น Windows Credential Manager ผ่าน Tauri plugin หรือ secret storage library ที่เหมาะสม

เหตุผล: token ของ Facebook และ AI key เป็นข้อมูลลับ ถ้าหลุดสามารถถูกนำไปโพสต์หรือเรียก API แทนผู้ใช้ได้

2. ทำระบบอัปโหลดรูปให้กลายเป็น public URL

Facebook Graph API สำหรับ `/photos` ใช้งานง่ายที่สุดเมื่อมี `public_image_url` จึงควรเพิ่ม storage สำหรับอัปโหลดรูป เช่น Cloudflare R2, Supabase Storage, S3-compatible storage หรือ server เล็ก ๆ ของเราเอง

ผลลัพธ์ที่ต้องได้: ผู้ใช้ลากรูปเข้าแอพ แล้วแอพอัปโหลดรูปให้อัตโนมัติ จากนั้นนำ URL ที่ได้ไปใช้โพสต์ผ่าน Graph API

3. ทำ worker สำหรับโพสต์ตามเวลา

ควรมี background scheduler ในฝั่ง Tauri ที่เช็กโพสต์สถานะ `scheduled` ทุกระยะ เช่น ทุก 30-60 วินาที แล้วโพสต์เมื่อถึงเวลา

เงื่อนไขสำคัญ:
- เวลาโพสต์ต้องมากกว่าปัจจุบันอย่างน้อย 10 นาที
- เวลาโพสต์ต้องไม่เกิน 30 วัน
- ถ้าโพสต์สำเร็จ ให้เปลี่ยนสถานะเป็น `published`
- ถ้าล้มเหลว ให้เปลี่ยนสถานะเป็น `failed` และบันทึก error

4. ทำ Queue ให้จัดการได้ครบ

หน้า Queue ควรเพิ่มปุ่มและ modal สำหรับ:
- แก้ไขโพสต์
- ลบโพสต์
- retry เฉพาะโพสต์ที่ `failed`
- ดู error ล่าสุด
- filter ตามสถานะ
- search จากข้อความโพสต์หรือชื่อเพจ

5. ทำ Facebook API workflow ให้ครบทุกกรณี

ควรแยก service สำหรับ Facebook ให้ชัดเจน:
- ทดสอบ Page Access Token
- ดึงข้อมูลเพจจาก token
- โพสต์ข้อความอย่างเดียว
- โพสต์รูปทันที
- ตั้งเวลาโพสต์ข้อความ
- ตั้งเวลาโพสต์รูปผ่านวิธีที่ Graph API รองรับ
- fallback ด้วย unpublished photo และ `attached_media` ถ้า `/photos` ไม่รองรับ schedule โดยตรง

6. ทำ AI workflow ให้ใช้งานดีขึ้น

ควรแยกผลลัพธ์ AI เป็นโครงสร้าง เช่น:
- วิเคราะห์ภาพ
- caption แบบให้ความรู้
- caption แบบเล่าสั้น ๆ
- caption แบบราชการอ่านง่าย
- hashtags

จากนั้นให้ผู้ใช้เลือก 1 แบบ แล้วแก้ไขต่อได้

7. ทำ logging และ audit trail

ทุกครั้งที่เรียก API ควรบันทึกลง `app_logs`:
- เวลา
- action
- success หรือ failed
- error message แบบอ่านง่าย
- metadata ที่ไม่มี token

ห้าม log token หรือ API key

8. ทำ UI ให้เหมาะกับงานจริง

ควรปรับ UI ให้เป็นเครื่องมือทำงานประจำวันมากขึ้น:
- dashboard เห็นสถานะวันนี้และสัปดาห์นี้
- queue table อ่านง่าย
- ปุ่มหลักชัดเจน
- error แสดงเป็นภาษาไทยที่แก้ต่อได้
- settings มีปุ่มทดสอบแต่ละระบบ
- มี empty state และ loading state

9. ทำระบบ build และติดตั้ง

ควรเพิ่มคู่มือและ workflow สำหรับ:
- `npm install`
- `npm run dev`
- `npm run build`
- `cargo` และ Tauri prerequisites
- build installer สำหรับ Windows

10. ทำ security checklist ก่อนใช้งานจริง

ก่อนใช้กับเพจจริงควรตรวจ:
- ไม่มี token ใน source code
- ไม่มี token ใน git history
- `.env` และ database ถูก ignore
- log ไม่มีข้อมูลลับ
- ใช้ HTTPS สำหรับ public image URL
- จำกัด permission ของ Meta App เท่าที่จำเป็น
- token ที่เคยหลุดในแชตต้อง revoke แล้วสร้างใหม่

## Milestone แนะนำ

### Milestone 1: ใช้ในเครื่องแบบปลอดภัยขึ้น

- secure storage
- settings validation
- error handling ภาษาไทย
- Queue edit/delete/retry

### Milestone 2: โพสต์รูปได้จริง

- image upload storage
- post photo ผ่าน Graph API
- log ทุก API call
- retry failed post

### Milestone 3: ตั้งเวลาแบบอัตโนมัติ

- background scheduler
- schedule validation
- status transition
- notification เมื่อโพสต์สำเร็จหรือล้มเหลว

### Milestone 4: พร้อมใช้งานจริง

- installer Windows
- README สมบูรณ์
- security checklist
- smoke test กับ Facebook Page ทดสอบ

## งานที่ควรทำถัดไปทันที

งานถัดไปที่คุ้มที่สุดคือทำ `Queue edit/delete/retry` และทำ `secure storage` เพราะช่วยให้แอพใช้งานต่อได้ง่ายและลดความเสี่ยงเรื่อง token ก่อนเริ่มเชื่อมระบบโพสต์จริง
