use crate::db;
use crate::facebook;
use chrono::Utc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

pub struct SchedulerHandle {
  stop_flag: Arc<AtomicBool>,
}

impl SchedulerHandle {
  pub fn stop(&self) {
    self.stop_flag.store(true, Ordering::Relaxed);
  }
}

pub fn start(db_path: String) -> SchedulerHandle {
  let stop_flag = Arc::new(AtomicBool::new(false));
  let flag = stop_flag.clone();

  tauri::async_runtime::spawn(async move {
    run(db_path, flag).await;
  });

  SchedulerHandle { stop_flag }
}

async fn run(db_path: String, stop_flag: Arc<AtomicBool>) {
  loop {
    if stop_flag.load(Ordering::Relaxed) {
      break;
    }

    let scheduled_posts = match db::list_posts_by_status(&db_path, "scheduled") {
      Ok(posts) => posts,
      Err(_) => {
        tokio::time::sleep(Duration::from_secs(30)).await;
        continue;
      }
    };

    if !scheduled_posts.is_empty() {
      let now = Utc::now();
      for post in &scheduled_posts {
        if stop_flag.load(Ordering::Relaxed) {
          break;
        }

        let post_time = match post.scheduled_time.as_deref().and_then(|t| {
          chrono::DateTime::parse_from_rfc3339(t)
            .ok()
            .map(|dt| dt.with_timezone(&Utc))
        }) {
          Some(t) => t,
          None => continue,
        };

        if post_time > now {
          continue;
        }

        let page = match db::get_page_by_id(&db_path, &post.page_id) {
          Ok(Some(p)) => p,
          _ => {
            let _ = db::update_post_status(
              &db_path,
              post.id,
              "failed",
              None,
              Some(&format!("ไม่พบเพจ {} ในฐานข้อมูล", post.page_id)),
            );
            let _ = db::insert_log(
              &db_path,
              "error",
              &format!("Scheduler: ไม่พบเพจ {} สำหรับโพสต์ #{}", post.page_id, post.id),
              None,
            );
            continue;
          }
        };

        let result = if let Some(ref url) = post.public_image_url {
          facebook::post_photo(&post.page_id, &page.access_token, url, &post.caption, true, None).await
        } else {
          facebook::post_feed(
            &post.page_id,
            &page.access_token,
            &post.caption,
            true,
            None,
          )
          .await
        };

        match &result {
          Ok(res) => {
            let fb_id = res["id"].as_str().map(|s| s.to_string());
            let _ = db::update_post_status(&db_path, post.id, "published", fb_id.as_deref(), None);
            let _ = db::insert_log(
              &db_path,
              "info",
              &format!("Scheduler: โพสต์ #{} อัตโนมัติสำเร็จ", post.id),
              None,
            );
          }
          Err(e) => {
            let _ = db::update_post_status(&db_path, post.id, "failed", None, Some(e));
            let _ = db::insert_log(
              &db_path,
              "error",
              &format!("Scheduler: โพสต์ #{} ล้มเหลว — {}", post.id, e),
              None,
            );
          }
        }
      }
    }

    tokio::time::sleep(Duration::from_secs(30)).await;
  }
}
