import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { api } from '../lib/tauri';
import type { EnvSettings } from '../lib/types';

type PageItem = { id: number; page_id: string; page_name: string; access_token: string };

const DRAFT_KEY = 'draft_newpost';
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function loadDraft(): { caption: string; hashtags: string } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveDraftLocal(caption: string, hashtags: string) {
  if (caption || hashtags) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ caption, hashtags }));
  }
}

function clearDraftLocal() {
  localStorage.removeItem(DRAFT_KEY);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('อ่านไฟล์ไม่ได้'));
    reader.readAsDataURL(file);
  });
}

export function NewPostPage() {
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [savedToLocal, setSavedToLocal] = useState(false);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [pageId, setPageId] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [captionsJson, setCaptionsJson] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [imageName, setImageName] = useState('');
  const [publicImageUrl, setPublicImageUrl] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const preview = useMemo(() => imageDataUrl || '', [imageDataUrl]);

  useEffect(() => {
    api.listPages()
      .then((rows) => {
        setPages(rows);
        if (!pageId && rows[0]) setPageId(rows[0].page_id);
      })
      .catch(() => undefined);
    api.getEnvSettings().then((env: EnvSettings) => {
      if (!pageId && env.fb_page_id) setPageId(env.fb_page_id);
    }).catch(() => undefined);
    const draft = loadDraft();
    if (draft) {
      if (draft.caption) setCaption(draft.caption);
      if (draft.hashtags) setHashtags(draft.hashtags);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      saveDraftLocal(caption, hashtags);
      setSavedToLocal(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [caption, hashtags]);

  const acceptFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('เลือกเฉพาะไฟล์รูปเท่านั้น');
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setImageDataUrl(dataUrl);
    setImageName(file.name);
    setMessage(`รับรูปแล้ว: ${file.name} — กด "วิเคราะห์ภาพด้วย AI" เพื่อสร้างแคปชัน`);
    setError('');
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await acceptFile(file);
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) await acceptFile(file);
  };

  const analyze = async () => {
    if (!preview) {
      setError('กรุณาใส่รูปก่อนวิเคราะห์');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const env = await api.getEnvSettings();
      const result = await api.analyzeImage({
        api_key: env.ai_api_key,
        model: env.ai_model || 'gemini-1.5-flash',
        image_data_url: preview,
      });
      setAiResult(result.raw_text);
      setCaptionsJson(result.captions_json);
      setCaption(result.caption);
      setHashtags(result.hashtags);
      setMessage('✨ วิเคราะห์ภาพสำเร็จ — AI สร้างแคปชันให้เลือก 3 แบบทางขวา');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const useAiCaption = (text: string) => {
    setCaption(text);
    setMessage('✅ ใช้แคปชันนี้แล้ว — แก้ไขต่อได้ตามต้องการ');
  };

  const saveDraft = async () => {
    if (!caption) { setError('กรุณากรอกแคปชัน'); return; }
    setLoading(true); setError('');
    try {
      await api.createPost({
        public_image_url: publicImageUrl || undefined,
        ai_analysis: aiResult || undefined,
        caption, hashtags: hashtags || undefined,
        page_id: pageId, scheduled_time: undefined,
      });
      clearDraftLocal();
      setMessage('📝 บันทึกร่างแล้ว — ดูได้ที่หน้า Queue');
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  const schedulePost = async () => {
    if (!caption) { setError('กรุณากรอกแคปชัน'); return; }
    if (!scheduledTime) { setError('กรุณาเลือกเวลาตั้งโพสต์'); return; }
    if (!pageId) { setError('กรุณาเลือกเพจ'); return; }
    const page = pages.find((p) => p.page_id === pageId);
    if (!page) { setError('ไม่พบเพจที่เลือก'); return; }
    setLoading(true); setError('');
    try {
      const scheduledIso = new Date(scheduledTime).toISOString();
      const savedId = await api.createPost({
        local_image_path: imageDataUrl || undefined,
        public_image_url: publicImageUrl || undefined,
        ai_analysis: aiResult || undefined,
        caption, hashtags: hashtags || undefined,
        page_id: pageId, scheduled_time: scheduledIso,
      });
      await api.publishPost({
        post_id: savedId, page_id: pageId,
        page_access_token: page.access_token,
        caption: caption + (hashtags ? "\n\n" + hashtags : ""),
        public_image_url: publicImageUrl || undefined,
        local_image_data_url: imageDataUrl || undefined,
        scheduled_time: scheduledIso,
      });
      clearDraftLocal();
      setMessage('⏰ ตั้งเวลาโพสต์บน Facebook แล้ว — ตรวจสอบได้ที่ Meta scheduled posts');
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  const publishNow = async () => {
    if (!caption) { setError('กรุณากรอกแคปชัน'); return; }
    if (!pageId) { setError('กรุณาเลือกเพจ'); return; }
    const page = pages.find((p) => p.page_id === pageId);
    if (!page) { setError('ไม่พบเพจที่เลือก'); return; }
    setLoading(true); setError('');
    try {
      const savedId = await api.createPost({
        public_image_url: publicImageUrl || undefined,
        ai_analysis: aiResult || undefined,
        caption, hashtags: hashtags || undefined,
        page_id: pageId, scheduled_time: undefined,
      });
      await api.publishPost({
        post_id: savedId, page_id: pageId,
        page_access_token: page.access_token,
        caption: caption + (hashtags ? "\n\n" + hashtags : ""), public_image_url: publicImageUrl || undefined, local_image_data_url: imageDataUrl || undefined,
      });
      setMessage(isTauri
        ? '🎉 โพสต์สำเร็จแล้ว! ตรวจสอบได้ที่ Facebook Page'
        : '📋 บันทึกในระบบแล้ว — ⚠️ นี่คือโหมดตัวอย่าง ต้องรันผ่าน Tauri เพื่อโพสต์ขึ้น Facebook จริง');
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  const parsedCaptions = (() => {
    try { return JSON.parse(captionsJson)?.captions || []; }
    catch { return []; }
  })();

  const styleIcons: Record<string, string> = {
    'ให้ความรู้': '📚',
    'เล่าสั้นๆ': '💬',
    'ราชการอ่านง่าย': '🏛️',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">✨ เพิ่มโพสต์ใหม่</h2>
        <p className="mt-1 text-sm text-slate-500">ลากรูปมา แล้วให้ AI สร้างแคปชันให้ — ร่าง, ตั้งเวลา, หรือโพสต์ทันที</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Left: Main Editor */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          {/* Drop Zone */}
          <div
            className={`relative rounded-xl border-2 border-dashed p-4 transition-all duration-200 ${
              dragActive
                ? 'border-blue-500 bg-blue-50 shadow-inner'
                : 'border-slate-300 bg-slate-50/50 hover:border-slate-400'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-700">📷 ลากไฟล์รูปมาวางตรงนี้</p>
                  <p className="text-sm text-slate-400">หรือคลิกปุ่มเลือกไฟล์ — รองรับ JPG, PNG, WebP</p>
                </div>
                <button
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:shadow"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  📁 เลือกรูป
                </button>
                <input ref={fileInputRef} className="hidden" type="file" accept="image/*" onChange={onFileChange} />
              </div>

              {preview ? (
                <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                  <img src={preview} alt={imageName} className="max-h-[420px] w-full object-contain" />
                </div>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-slate-400">
                  <span className="text-4xl">🖼️</span>
                  <span className="mt-2 text-sm">ยังไม่มีรูป</span>
                </div>
              )}

              {imageName && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <span>✅</span> ไฟล์: <strong>{imageName}</strong> — พร้อมวิเคราะห์
                </div>
              )}
            </div>
          </div>

          {/* Editor Fields */}
          <div className="mt-5 grid gap-3">
            <div>
              <button
                onClick={analyze}
                disabled={loading || !preview}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3.5 font-semibold text-white shadow-md shadow-blue-200 transition-all hover:from-blue-700 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? '⏳ กำลังวิเคราะห์ด้วย AI...' : '🤖 วิเคราะห์ภาพด้วย AI'}
              </button>
              <p className="mt-1 text-xs text-slate-400">AI จะวิเคราะห์ภาพและสร้างแคปชัน 3 แบบให้เลือก</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">🔗 Public Image URL (ถ้ามี)</label>
              <input
                className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="https://your-image-host.com/photo.jpg"
                value={publicImageUrl}
                onChange={(e) => setPublicImageUrl(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-400">ใส่ URL รูปที่อัปโหลดไว้แล้ว (ไม่ใช่ data URL) — ถ้าเว้นว่างจะโพสต์ข้อความอย่างเดียว</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">✏️ แคปชัน</label>
              <textarea
                className="min-h-32 w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="เขียนแคปชันภาษาไทยตรงนี้... หรือให้ AI สร้างให้"
                value={caption}
                onChange={(e) => { setCaption(e.target.value); setSavedToLocal(false); }}
              />
              <div className="mt-1 flex justify-between text-xs text-slate-400">
                <span>{savedToLocal ? '💾 บันทึกร่างอัตโนมัติแล้ว' : (caption ? '⏳ กำลังรอ auto-save...' : '')}</span>
                <span className={caption.length > 63206 ? 'font-bold text-red-500' : ''}>{caption.length.toLocaleString()} / 63,206</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">🏷️ Hashtags</label>
              <input
                className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="#เกษตร #ชุมชน #..."
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">📄 เลือกเพจ</label>
                <select
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none"
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                >
                  <option value="">— เลือกเพจ —</option>
                  {pages.map((p) => (
                    <option key={p.page_id} value={p.page_id}>{p.page_name} ({p.page_id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">📅 เวลาโพสต์ (ถ้าตั้งเวลา)</label>
                <input
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none"
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-400">ต้องล่วงหน้า ≥ 10 นาที และ ≤ 30 วัน</p>
              </div>
            </div>

            {!isTauri && (
              <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-800">
                <strong className="block mb-1">⚠️ โหมดตัวอย่างในเบราว์เซอร์</strong>
                ปุ่มโพสต์ด้านล่างจะ <strong>บันทึกข้อมูลในระบบเท่านั้น</strong> ไม่ได้โพสต์ขึ้น Facebook จริง
                <br />ใช้ <code className="bg-amber-200 px-1.5 py-0.5 rounded text-xs font-mono">cargo tauri dev</code> เพื่อเชื่อมต่อ Facebook จริง
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 border-t pt-4">
              <button
                onClick={saveDraft}
                disabled={loading}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50"
              >
                📝 บันทึกร่าง
              </button>
              <button
                onClick={schedulePost}
                disabled={loading}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-200 transition-all hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-50"
              >
                ⏰ ตั้งเวลาโพสต์
              </button>
              <button
                onClick={publishNow}
                disabled={loading}
                className="rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-slate-200 transition-all hover:from-slate-900 hover:to-slate-800 disabled:opacity-50"
              >
                {loading ? '⏳ กำลังโพสต์...' : '🚀 โพสต์ทันที'}
              </button>
            </div>

            {message && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                {message}
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                ❌ {error}
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Results */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-1 text-lg font-semibold text-slate-700">🤖 ผล AI</h3>
          <p className="mb-4 text-xs text-slate-400">แคปชัน 3 แบบ — เลือกแบบที่ชอบแล้วแก้ไขต่อได้</p>

          {parsedCaptions.length > 0 ? (
            <div className="space-y-3">
              {parsedCaptions.map((c: { style: string; text: string }, i: number) => (
                <div
                  key={i}
                  className={`rounded-xl border p-4 transition-all hover:shadow-sm ${
                    caption === c.text
                      ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-lg">{styleIcons[c.style] || '📝'}</span>
                    <span className="font-semibold text-slate-700">{c.style}</span>
                    {caption === c.text && (
                      <span className="ml-auto rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                        กำลังใช้
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{c.text}</p>
                  <button
                    className={`mt-3 w-full rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                      caption === c.text
                        ? 'bg-blue-100 text-blue-600 cursor-default'
                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                    }`}
                    onClick={() => useAiCaption(c.text)}
                    disabled={caption === c.text}
                  >
                    {caption === c.text ? '✅ กำลังใช้แคปชันนี้' : '📋 ใช้แคปชันนี้'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <span className="text-5xl">🤖</span>
              <p className="mt-3 text-sm font-medium">ยังไม่ได้วิเคราะห์ภาพ</p>
              <p className="mt-1 text-xs">ลากรูปมาแล้วกด "วิเคราะห์ภาพด้วย AI"</p>
            </div>
          )}

          {aiResult && parsedCaptions.length === 0 && (
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="whitespace-pre-wrap">{aiResult}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

