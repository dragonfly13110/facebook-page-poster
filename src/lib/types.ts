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
