import { invoke } from './mock';
import type { AiResult, EnvSettings } from './types';

export const api = {
  initDb: () => invoke<void>('init_db'),

  getEnvSettings: () => invoke<EnvSettings>('get_env_settings'),

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
  }) => invoke<AiResult>('analyze_image', { input }),

  createPost: (input: {
    local_image_path?: string;
    public_image_url?: string;
    ai_analysis?: string;
    caption: string;
    hashtags?: string;
    page_id: string;
    scheduled_time?: string;
  }) => invoke<number>('create_post', { input }),

  deletePost: (postId: number) => invoke<void>('delete_post', { input: { post_id: postId } }),

  listPages: () =>
    invoke<Array<{ id: number; page_id: string; page_name: string; access_token: string }>>('list_pages'),

  listPosts: () =>
    invoke<
      Array<{
        id: number;
        caption: string;
        hashtags: string | null;
        page_id: string;
        scheduled_time: string | null;
        status: string;
        public_image_url: string | null;
        error_message: string | null;
        facebook_post_id: string | null;
      }>
    >('list_posts'),

  testFacebook: (token: string) => invoke<unknown>('test_facebook', { token }),

  publishPost: (input: {
    post_id: number;
    page_id: string;
    page_access_token: string;
    caption: string;
    public_image_url?: string;
    scheduled_time?: string;
  }) => invoke<unknown>('publish_post', { input }),

  getPost: (postId: number) =>
    invoke<{
      id: number;
      caption: string;
      hashtags: string | null;
      page_id: string;
      scheduled_time: string | null;
      public_image_url: string | null;
      status: string;
    }>('get_post', { postId }),

  editPost: (input: {
    post_id: number;
    caption: string;
    hashtags?: string;
    scheduled_time?: string;
    public_image_url?: string;
  }) => invoke<void>('edit_post', { input }),

  retryPost: (input: {
    post_id: number;
    page_id: string;
    page_access_token: string;
  }) => invoke<unknown>('retry_post', { input }),
};
