import { invoke } from '@tauri-apps/api/core';

export const api = {
  initDb: () => invoke<void>('init_db'),
  saveSettings: (input: {
    page_id: string;
    page_name: string;
    access_token: string;
    ai_api_key: string;
    ai_model: string;
  }) => invoke<void>('save_settings', { input }),
  analyzeImage: (input: {
    api_key: string;
    model: string;
    image_data_url: string;
  }) => invoke<{ raw_text: string; caption: string; hashtags: string; analysis_json: string }>('analyze_image', { input }),
  createPost: (input: {
    local_image_path?: string;
    public_image_url?: string;
    ai_analysis?: string;
    caption: string;
    hashtags?: string;
    page_id: string;
    scheduled_time?: string;
  }) => invoke<number>('create_post', { input }),
  listPages: () => invoke<Array<{ id: number; page_id: string; page_name: string; access_token: string }>>('list_pages'),
  listPosts: () => invoke<Array<{ id: number; caption: string; page_id: string; scheduled_time: string | null; status: string; public_image_url: string | null; error_message: string | null }>>('list_posts'),
  testFacebook: (token: string) => invoke<any>('test_facebook', { token }),
  publishPost: (input: {
    post_id: number;
    page_id: string;
    page_access_token: string;
    caption: string;
    public_image_url?: string;
    scheduled_time?: string;
  }) => invoke<any>('publish_post', { input }),
};

