const mockPages = [
  { id: 1, page_id: '115878958064956', page_name: 'Farmerworld1101', access_token: 'mock-token-xxx', created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-01T00:00:00Z' },
];

type MockPost = {
  id: number;
  caption: string;
  hashtags: string | null;
  page_id: string;
  scheduled_time: string | null;
  status: string;
  public_image_url: string | null;
  error_message: string | null;
  facebook_post_id: string | null;
};

const mockPosts: MockPost[] = [
  { id: 1, caption: '🌾 ฤดูทำนาปีนี้เริ่มแล้ว! ชาวนาบ้านเรากำลังเตรียมแปลงกันอย่างขะมักเขม้น', hashtags: '#เกษตร #ทำนา #ฤดูนาปี', page_id: '115878958064956', scheduled_time: null, status: 'draft', public_image_url: null, error_message: null, facebook_post_id: null },
  { id: 2, caption: '🥬 ผักสวนครัวปลอดสารพิษ เก็บสดจากแปลงทุกเช้า ส่งตรงถึงมือคุณ', hashtags: '#ผักสวนครัว #ปลอดสารพิษ #เกษตรอินทรีย์', page_id: '115878958064956', scheduled_time: '2026-05-08T08:00:00Z', status: 'scheduled', public_image_url: null, error_message: null, facebook_post_id: null },
  { id: 3, caption: '🐓 เลี้ยงไก่ไข่อารมณ์ดี ไข่แดงสวยทุกฟอง ไม่ใช้ฮอร์โมนเร่ง', hashtags: '#ไก่ไข่ #เลี้ยงไก่ #ไข่ไก่อารมณ์ดี', page_id: '115878958064956', scheduled_time: null, status: 'published', public_image_url: null, error_message: null, facebook_post_id: '12345_67890' },
  { id: 4, caption: 'ทดสอบโพสต์ที่ล้มเหลว', hashtags: null, page_id: '115878958064956', scheduled_time: null, status: 'failed', public_image_url: null, error_message: 'Permission denied: invalid access token', facebook_post_id: null },
];

const mockEnv = {
  fb_page_id: '115878958064956',
  fb_page_name: 'Farmerworld1101',
  fb_page_access_token: 'EAAOOS...',
  fb_user_access_token: 'EAAOOS...',
  ai_api_key: 'AIzaSyB...',
  ai_model: 'gemini-3.1-flash-lite-preview',
};

const mockAiResult = {
  raw_text: 'นี่คือผลการวิเคราะห์ภาพจาก AI (ตัวอย่างในโหมดพรีวิว)',
  captions_json: JSON.stringify({
    captions: [
      { style: 'ให้ความรู้', text: '🌱 ต้นกล้าข้าวในภาพนี้อยู่ในระยะกล้าอายุประมาณ 15-20 วัน สังเกตจากใบเขียวเข้ม แข็งแรง แสดงถึงการได้รับธาตุอาหารที่เพียงพอ พื้นที่แปลงนามีน้ำขังระดับพอดี ไม่ล้นคันนา เป็นสัญญาณของการเตรียมพื้นที่ที่ดี การปลูกข้าวในฤดูนาปีแบบนี้ ควรระวังเรื่องเพลี้ยกระโดดสีน้ำตาลที่จะเริ่มระบาดช่วงนี้ด้วยนะครับ' },
      { style: 'เล่าสั้นๆ', text: '🌾 ต้นกล้าข้าวของเราพร้อมลงแปลงแล้วจ้า เขียว สด แข็งแรง ฤดูทำนาปีนี้ต้องดีแน่นอน ติดตามไปด้วยกันนะครับ' },
      { style: 'ราชการอ่านง่าย', text: 'ขอรายงานความก้าวหน้าการเตรียมแปลงนาสาธิตประจำฤดูนาปี 2569 ขณะนี้ต้นกล้าข้าวอยู่ในระยะกล้าอายุ 15-20 วัน มีความสมบูรณ์พร้อมสำหรับการปักดำ กำหนดการปักดำจะเริ่มในวันที่ 15 พฤษภาคม 2569 นี้' },
    ],
    hashtags: ['#เกษตรไทย', '#ข้าวไทย', '#ทำนา', '#ฤดูนาปี', '#เกษตรอินทรีย์', '#ชาวนาไทย', '#ต้นกล้าข้าว'],
  }),
  caption: '🌱 ต้นกล้าข้าวในภาพนี้อยู่ในระยะกล้าอายุประมาณ 15-20 วัน สังเกตจากใบเขียวเข้ม แข็งแรง แสดงถึงการได้รับธาตุอาหารที่เพียงพอ',
  hashtags: '#เกษตรไทย #ข้าวไทย #ทำนา #ฤดูนาปี #เกษตรอินทรีย์ #ชาวนาไทย #ต้นกล้าข้าว',
  analysis_json: '{"raw":"mock"}',
};

let mockPostIdCounter = 10;

const handlers: Record<string, (...args: unknown[]) => unknown> = {
  init_db: () => null,
  get_env_settings: () => mockEnv,
  save_settings: () => { console.log('[mock] save_settings'); return null; },
  analyze_image: async () => {
    console.log('[mock] analyze_image');
    await new Promise(r => setTimeout(r, 1500));
    return mockAiResult;
  },
  create_post: () => { mockPostIdCounter++; return mockPostIdCounter; },
  delete_post: () => { console.log('[mock] delete_post'); return null; },
  get_post: (args: unknown) => {
    const input = args as { postId?: number } | number | undefined;
    const id = typeof input === 'object' && input !== null ? (input as Record<string, unknown>).postId : (typeof input === 'number' ? input : 0);
    const post = mockPosts.find(p => p.id === Number(id));
    return post || null;
  },
  edit_post: (args: unknown) => {
    const input = args as Record<string, unknown>;
    const id = Number(input?.post_id);
    const idx = mockPosts.findIndex(p => p.id === id);
    if (idx >= 0) {
      const post = mockPosts[idx];
      if (input.caption) post.caption = input.caption as string;
      if ('hashtags' in input) post.hashtags = (input.hashtags as string | null) || null;
      if (input.scheduled_time) post.scheduled_time = input.scheduled_time as string;
      if (input.public_image_url) post.public_image_url = input.public_image_url as string;
    }
    return null;
  },
  list_pages: () => mockPages,
  list_posts: () => mockPosts,
  test_facebook: async () => {
    await new Promise(r => setTimeout(r, 1000));
    return { data: [{ id: '115878958064956', name: 'Farmerworld1101' }] };
  },
  publish_post: async () => {
    await new Promise(r => setTimeout(r, 800));
    return { id: '12345_67890' };
  },
  retry_post: async () => {
    await new Promise(r => setTimeout(r, 800));
    return { id: '12345_67890' };
  },
};

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return tauriInvoke<T>(cmd, args);
  }

  const handler = handlers[cmd];
  if (!handler) {
    console.warn(`[mock] unknown command: ${cmd}`);
    return undefined as T;
  }

  const input = args && 'input' in args ? args.input : args;
  return handler(input) as T;
}
