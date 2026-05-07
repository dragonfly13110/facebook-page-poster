export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

export type PageRow = {
  id: number;
  page_id: string;
  page_name: string;
  access_token: string;
  created_at: string;
  updated_at: string;
};

export type PostRow = {
  id: number;
  local_image_path: string | null;
  public_image_url: string | null;
  ai_analysis: string | null;
  caption: string;
  hashtags: string | null;
  page_id: string;
  scheduled_time: string | null;
  facebook_post_id: string | null;
  status: PostStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type AiResult = {
  raw_text: string;
  captions_json: string;
  caption: string;
  hashtags: string;
  analysis_json: string;
};

export type EnvSettings = {
  fb_page_id: string;
  fb_page_name: string;
  fb_page_access_token: string;
  fb_user_access_token: string;
  ai_api_key: string;
  ai_model: string;
};
