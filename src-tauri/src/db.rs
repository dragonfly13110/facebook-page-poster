use chrono::Utc;
use rusqlite::{params, Connection};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct PageRow {
  pub id: i64,
  pub page_id: String,
  pub page_name: String,
  pub access_token: String,
  pub created_at: String,
  pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct PostRow {
  pub id: i64,
  pub local_image_path: Option<String>,
  pub public_image_url: Option<String>,
  pub ai_analysis: Option<String>,
  pub caption: String,
  pub hashtags: Option<String>,
  pub page_id: String,
  pub scheduled_time: Option<String>,
  pub facebook_post_id: Option<String>,
  pub status: String,
  pub error_message: Option<String>,
  pub created_at: String,
  pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct LogRow {
  pub id: i64,
  pub level: String,
  pub message: String,
  pub metadata_json: Option<String>,
  pub created_at: String,
}

pub fn init() -> Result<String, rusqlite::Error> {
  let path = std::env::var("APP_DB_PATH").unwrap_or_else(|_| "facebook_poster.db".to_string());
  let conn = Connection::open(&path)?;
  conn.execute_batch(
    r#"
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id TEXT NOT NULL UNIQUE,
      page_name TEXT NOT NULL,
      access_token TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      local_image_path TEXT,
      public_image_url TEXT,
      ai_analysis TEXT,
      caption TEXT NOT NULL,
      hashtags TEXT,
      page_id TEXT NOT NULL,
      scheduled_time TEXT,
      facebook_post_id TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );
    "#,
  )?;
  Ok(path)
}

pub fn insert_log(db_path: &str, level: &str, message: &str, metadata_json: Option<&str>) -> Result<(), rusqlite::Error> {
  let conn = Connection::open(db_path)?;
  let now = Utc::now().to_rfc3339();
  conn.execute(
    "INSERT INTO app_logs (level, message, metadata_json, created_at) VALUES (?1, ?2, ?3, ?4)",
    params![level, message, metadata_json, now],
  )?;
  Ok(())
}

pub fn save_page(db_path: &str, page_id: &str, page_name: &str, access_token: &str) -> Result<(), rusqlite::Error> {
  let conn = Connection::open(db_path)?;
  let now = Utc::now().to_rfc3339();
  conn.execute(
    "INSERT INTO pages (page_id, page_name, access_token, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(page_id) DO UPDATE SET page_name=excluded.page_name, access_token=excluded.access_token, updated_at=excluded.updated_at",
    params![page_id, page_name, access_token, now, now],
  )?;
  Ok(())
}

pub fn insert_post(
  db_path: &str,
  local_image_path: Option<&str>,
  public_image_url: Option<&str>,
  ai_analysis: Option<&str>,
  caption: &str,
  hashtags: Option<&str>,
  page_id: &str,
  scheduled_time: Option<&str>,
  status: &str,
) -> Result<i64, rusqlite::Error> {
  let conn = Connection::open(db_path)?;
  let now = Utc::now().to_rfc3339();
  conn.execute(
    "INSERT INTO posts (local_image_path, public_image_url, ai_analysis, caption, hashtags, page_id, scheduled_time, status, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
    params![local_image_path, public_image_url, ai_analysis, caption, hashtags, page_id, scheduled_time, status, now, now],
  )?;
  Ok(conn.last_insert_rowid())
}

pub fn update_post_status(
  db_path: &str,
  post_id: i64,
  status: &str,
  facebook_post_id: Option<&str>,
  error_message: Option<&str>,
) -> Result<(), rusqlite::Error> {
  let conn = Connection::open(db_path)?;
  let now = Utc::now().to_rfc3339();
  conn.execute(
    "UPDATE posts SET status=?1, facebook_post_id=?2, error_message=?3, updated_at=?4 WHERE id=?5",
    params![status, facebook_post_id, error_message, now, post_id],
  )?;
  Ok(())
}

pub fn delete_post(db_path: &str, post_id: i64) -> Result<(), rusqlite::Error> {
  let conn = Connection::open(db_path)?;
  conn.execute("DELETE FROM posts WHERE id=?1", params![post_id])?;
  Ok(())
}

pub fn edit_post(
  db_path: &str,
  post_id: i64,
  caption: &str,
  hashtags: Option<&str>,
  scheduled_time: Option<&str>,
  public_image_url: Option<&str>,
) -> Result<(), rusqlite::Error> {
  let conn = Connection::open(db_path)?;
  let now = Utc::now().to_rfc3339();
  conn.execute(
    "UPDATE posts SET caption=?1, hashtags=?2, scheduled_time=?3, public_image_url=?4, updated_at=?5 WHERE id=?6",
    params![caption, hashtags, scheduled_time, public_image_url, now, post_id],
  )?;
  Ok(())
}

pub fn get_post(db_path: &str, post_id: i64) -> Result<PostRow, rusqlite::Error> {
  let conn = Connection::open(db_path)?;
  conn.query_row(
    "SELECT id, local_image_path, public_image_url, ai_analysis, caption, hashtags, page_id, scheduled_time, facebook_post_id, status, error_message, created_at, updated_at FROM posts WHERE id=?1",
    params![post_id],
    |row| {
      Ok(PostRow {
        id: row.get(0)?,
        local_image_path: row.get(1)?,
        public_image_url: row.get(2)?,
        ai_analysis: row.get(3)?,
        caption: row.get(4)?,
        hashtags: row.get(5)?,
        page_id: row.get(6)?,
        scheduled_time: row.get(7)?,
        facebook_post_id: row.get(8)?,
        status: row.get(9)?,
        error_message: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
      })
    },
  )
}

pub fn list_pages(db_path: &str) -> Result<Vec<PageRow>, rusqlite::Error> {
  let conn = Connection::open(db_path)?;
  let mut stmt = conn.prepare("SELECT id, page_id, page_name, access_token, created_at, updated_at FROM pages ORDER BY updated_at DESC")?;
  let rows = stmt.query_map([], |row| {
    Ok(PageRow {
      id: row.get(0)?,
      page_id: row.get(1)?,
      page_name: row.get(2)?,
      access_token: row.get(3)?,
      created_at: row.get(4)?,
      updated_at: row.get(5)?,
    })
  })?;
  rows.collect()
}

pub fn list_posts(db_path: &str) -> Result<Vec<PostRow>, rusqlite::Error> {
  let conn = Connection::open(db_path)?;
  let mut stmt = conn.prepare("SELECT id, local_image_path, public_image_url, ai_analysis, caption, hashtags, page_id, scheduled_time, facebook_post_id, status, error_message, created_at, updated_at FROM posts ORDER BY created_at DESC")?;
  let rows = stmt.query_map([], |row| {
    Ok(PostRow {
      id: row.get(0)?,
      local_image_path: row.get(1)?,
      public_image_url: row.get(2)?,
      ai_analysis: row.get(3)?,
      caption: row.get(4)?,
      hashtags: row.get(5)?,
      page_id: row.get(6)?,
      scheduled_time: row.get(7)?,
      facebook_post_id: row.get(8)?,
      status: row.get(9)?,
      error_message: row.get(10)?,
      created_at: row.get(11)?,
      updated_at: row.get(12)?,
    })
  })?;
  rows.collect()
}

pub fn list_posts_by_status(db_path: &str, status: &str) -> Result<Vec<PostRow>, rusqlite::Error> {
  let conn = Connection::open(db_path)?;
  let mut stmt = conn.prepare("SELECT id, local_image_path, public_image_url, ai_analysis, caption, hashtags, page_id, scheduled_time, facebook_post_id, status, error_message, created_at, updated_at FROM posts WHERE status=?1 ORDER BY scheduled_time ASC")?;
  let rows = stmt.query_map(params![status], |row| {
    Ok(PostRow {
      id: row.get(0)?,
      local_image_path: row.get(1)?,
      public_image_url: row.get(2)?,
      ai_analysis: row.get(3)?,
      caption: row.get(4)?,
      hashtags: row.get(5)?,
      page_id: row.get(6)?,
      scheduled_time: row.get(7)?,
      facebook_post_id: row.get(8)?,
      status: row.get(9)?,
      error_message: row.get(10)?,
      created_at: row.get(11)?,
      updated_at: row.get(12)?,
    })
  })?;
  rows.collect()
}

pub fn get_page_by_id(db_path: &str, page_id: &str) -> Result<Option<PageRow>, rusqlite::Error> {
  let conn = Connection::open(db_path)?;
  let mut stmt = conn.prepare("SELECT id, page_id, page_name, access_token, created_at, updated_at FROM pages WHERE page_id=?1")?;
  let mut rows = stmt.query_map(params![page_id], |row| {
    Ok(PageRow {
      id: row.get(0)?,
      page_id: row.get(1)?,
      page_name: row.get(2)?,
      access_token: row.get(3)?,
      created_at: row.get(4)?,
      updated_at: row.get(5)?,
    })
  })?;
  Ok(rows.next().transpose()?)
}
