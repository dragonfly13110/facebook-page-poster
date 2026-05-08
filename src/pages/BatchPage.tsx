import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { api } from '../lib/tauri';
import type { AiResult, EnvSettings } from '../lib/types';
import type { BatchAnalyzeResult } from '../lib/tauri';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('อ่านไฟล์ไม่ได้'));
    reader.readAsDataURL(file);
  });
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateScheduleTimes(
  count: number,
  postsPerDay: number,
  timeStart: string,
  timeEnd: string,
  startDate: Date,
) {
  const [sh, sm] = timeStart.split(':').map(Number);
  const [eh, em] = timeEnd.split(':').map(Number);
  const rangeStart = sh * 60 + sm;
  const rangeEnd = eh * 60 + em;
  const rangeMins = rangeEnd - rangeStart;

  const times: Date[] = [];
  let remaining = count;
  let day = 0;
  while (remaining > 0) {
    const todayCount = Math.min(postsPerDay, remaining);
    const todaySlots = new Set<number>();
    while (todaySlots.size < todayCount) {
      todaySlots.add(randInt(rangeStart, rangeEnd - 1));
    }
    const sorted = [...todaySlots].sort((a, b) => a - b);
    for (const mins of sorted) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + day);
      d.setHours(Math.floor(mins / 60), mins % 60, randInt(0, 59), 0);
      times.push(d);
    }
    remaining -= todayCount;
    day++;
  }
  return times.slice(0, count);
}

type PostCard = {
  index: number;
  dataUrl: string;
  caption: string;
  hashtags: string;
  aiResult: AiResult | null;
  error: string | null;
};

export function BatchPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [dataUrls, setDataUrls] = useState<string[]>([]);
  const [cards, setCards] = useState<PostCard[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [progress, setProgress] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [pageId, setPageId] = useState('');
  const [pages, setPages] = useState<Array<{ id: number; page_id: string; page_name: string; access_token: string }>>([]);
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [timeStart, setTimeStart] = useState('10:00');
  const [timeEnd, setTimeEnd] = useState('11:00');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalDays = Math.ceil(cards.length / postsPerDay);

  useEffect(() => {
    api.listPages().then(setPages).catch(() => {});
    api.getEnvSettings()
      .then((env: EnvSettings) => {
        if (env.fb_page_id && !pageId) setPageId(env.fb_page_id);
      })
      .catch(() => {});
  }, []);

  const acceptFiles = async (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).filter((f) => f.type.startsWith('image/'));
    if (!arr.length) {
      setError('เลือกเฉพาะไฟล์รูปเท่านั้น');
      return;
    }
    setError('');
    const urls = await Promise.all(arr.map(readFileAsDataUrl));
    setFiles((prev) => [...prev, ...arr]);
    setDataUrls((prev) => [...prev, ...urls]);
    setMessage(`เพิ่มแล้ว ${arr.length} รูป — รวม ${files.length + arr.length} รูป`);
  };

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) await acceptFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) await acceptFiles(e.dataTransfer.files);
  };

  const onFolderChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) await acceptFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearImages = () => {
    setFiles([]);
    setDataUrls([]);
    setCards([]);
    setMessage('');
  };

  const analyzeAll = async () => {
    if (!dataUrls.length) {
      setError('ยังไม่มีรูปให้วิเคราะห์');
      return;
    }
    setAnalyzing(true);
    setError('');
    setProgress(`กำลังวิเคราะห์ ${dataUrls.length} ภาพด้วย AI...`);
    try {
      const env = await api.getEnvSettings();
      const results: BatchAnalyzeResult[] = await api.batchAnalyzeImages({
        image_data_urls: dataUrls,
        api_key: env.ai_api_key,
        model: env.ai_model || 'gemini-1.5-flash',
      });

      const map = new Map<number, BatchAnalyzeResult>();
      for (const r of results) map.set(r.index, r);

      const newCards: PostCard[] = dataUrls.map((url, i) => {
        const r = map.get(i);
        return {
          index: i,
          dataUrl: url,
          caption: r?.ai_result?.caption || '',
          hashtags: r?.ai_result?.hashtags || '',
          aiResult: r?.ai_result || null,
          error: r?.error || null,
        };
      });

      setCards(newCards);
      const ok = results.filter((r) => r.ai_result).length;
      const fail = results.filter((r) => r.error).length;
      setMessage(`✨ AI วิเคราะห์เสร็จ — สำเร็จ ${ok} รูป${fail > 0 ? ` (ไม่สำเร็จ ${fail} รูป)` : ''}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setAnalyzing(false);
      setProgress('');
    }
  };

  const scheduleAll = async () => {
    if (!cards.length) { setError('ยังไม่มีโพสต์ให้ตั้งเวลา'); return; }
    if (!pageId) { setError('กรุณาเลือกเพจ'); return; }

    setScheduling(true);
    setError('');

    const times = generateScheduleTimes(cards.length, postsPerDay, timeStart, timeEnd, new Date(startDate));

    try {
      let success = 0;
      let errors = 0;

      const page = pages.find((p) => p.page_id === pageId);
      if (!page) { setError('ไม่พบเพจที่เลือก'); setScheduling(false); return; }

      for (let i = 0; i < cards.length; i++) {
        setProgress(`กำลังตั้งเวลา ${i + 1}/${cards.length}...`);
        try {
          const postId = await api.createPost({
            local_image_path: cards[i].dataUrl,
            ai_analysis: cards[i].aiResult?.raw_text,
            caption: cards[i].caption,
            hashtags: cards[i].hashtags || undefined,
            page_id: pageId,
            scheduled_time: times[i].toISOString(),
          });
          await api.publishPost({
            post_id: postId,
            page_id: pageId,
            page_access_token: page.access_token,
            caption: cards[i].caption + (cards[i].hashtags ? '\n\n' + cards[i].hashtags : ''),
            public_image_url: undefined,
            local_image_data_url: cards[i].dataUrl,
            scheduled_time: times[i].toISOString(),
          });
          success++;
          await new Promise((r) => setTimeout(r, 2000));
        } catch {
          errors++;
        }
      }

      setMessage(
        `⏰ จัดตาราง ${cards.length} โพสต์เรียบร้อย (${success} สำเร็จ${errors > 0 ? `, ${errors} ล้มเหลว` : ''})` +
        `\nช่วงวันที่: ${times[0].toLocaleDateString('th-TH')} ถึง ${times[times.length - 1].toLocaleDateString('th-TH')}` +
        `\nเวลา ${timeStart} - ${timeEnd} (สุ่ม)`
      );
      setCards([]);
      setFiles([]);
      setDataUrls([]);
    } catch (e) {
      setError(String(e));
    } finally {
      setScheduling(false);
      setProgress('');
    }
  };

  const publishAllNow = async () => {
    if (!cards.length) { setError('ยังไม่มีโพสต์ให้เผยแพร่'); return; }
    if (!pageId) { setError('กรุณาเลือกเพจ'); return; }
    if (!isTauri) {
      setError('ต้องรันใน Tauri เท่านั้นถึงจะโพสต์ขึ้น Facebook จริง');
      return;
    }

    const page = pages.find((p) => p.page_id === pageId);
    if (!page) { setError('ไม่พบเพจที่เลือก'); return; }

    setScheduling(true);
    setError('');
    let success = 0;
    let errors = 0;

    try {
      for (let i = 0; i < cards.length; i++) {
        setProgress(`กำลังโพสต์ ${i + 1}/${cards.length}...`);
        try {
          const postId = await api.createPost({
            local_image_path: cards[i].dataUrl,
            ai_analysis: cards[i].aiResult?.raw_text,
            caption: cards[i].caption,
            hashtags: cards[i].hashtags || undefined,
            page_id: pageId,
            scheduled_time: undefined,
          });
          await api.publishPost({
            post_id: postId,
            page_id: pageId,
            page_access_token: page.access_token,
            caption: cards[i].caption + (cards[i].hashtags ? '\n\n' + cards[i].hashtags : ''),
            public_image_url: undefined,
            local_image_data_url: cards[i].dataUrl,
            scheduled_time: undefined,
          });
          success++;
          await new Promise((r) => setTimeout(r, 2000));
        } catch {
          errors++;
        }
      }
      setMessage(`🚀 โพสต์แล้ว ${success} โพสต์เรียบร้อย${errors > 0 ? `, ล้มเหลว ${errors} โพสต์` : ''}`);
      setCards([]);
      setFiles([]);
      setDataUrls([]);
    } catch (e) {
      setError(String(e));
    } finally {
      setScheduling(false);
      setProgress('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">📦 Batch สร้างหลายโพสต์</h2>
        <p className="mt-1 text-sm text-slate-500">ลากหลายรูป ให้ AI วิเคราะห์ทีเดียว แล้วตั้งเวลาสุ่มวันละโพสต์</p>
      </div>

      {!isTauri && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>⚠️ โหมดตัวอย่างในเบราว์เซอร์</strong> — ปุ่มโพสต์จะทำงานเมื่อรันผ่าน <code className="bg-amber-200 px-1.5 py-0.5 rounded text-xs">cargo tauri dev</code> เท่านั้น
        </div>
      )}

      {/* Upload Zone */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div
          className={`rounded-xl border-2 border-dashed p-6 text-center transition-all ${
            dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50/50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
        >
          <p className="text-3xl">📁</p>
          <p className="mt-2 font-semibold text-slate-700">ลากไฟล์รูปหรือโฟลเดอร์มาวาง</p>
          <p className="text-sm text-slate-400">หรือใช้ปุ่มด้านล่าง — เลือกทีละหลายไฟล์ได้</p>
          <div className="mt-4 flex justify-center gap-3 flex-wrap">
            <button
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
              onClick={() => fileInputRef.current?.click()}
            >
              🖼️ เลือกหลายไฟล์
            </button>
            <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50">
              📁 เลือกทั้งโฟลเดอร์
              <input type="file" className="hidden" multiple onChange={onFolderChange} ref={(el) => { if (el) { (el as any).webkitdirectory = true; } }} />
            </label>
          </div>
          <input ref={fileInputRef} className="hidden" type="file" multiple accept="image/*" onChange={onFileChange} />
        </div>

        {dataUrls.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-600">
                🖼️ {dataUrls.length} รูปที่เลือก
              </span>
              {!analyzing && !scheduling && (
                <button onClick={clearImages} className="text-xs text-red-500 hover:underline">
                  ล้างทั้งหมด
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-48 overflow-y-auto">
              {dataUrls.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                  <img src={url} alt={`img-${i}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 right-0 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-tl">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h3 className="font-semibold text-slate-700 mb-3">⚙️ ตั้งค่าการจัดตาราง</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">เพจปลายทาง</label>
            <select
              className="w-full rounded-xl border border-slate-300 p-3 text-sm"
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
            >
              <option value="">— เลือกเพจ —</option>
              {pages.map((p) => (
                <option key={p.page_id} value={p.page_id}>{p.page_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">โพสต์ต่อวัน</label>
            <input
              className="w-full rounded-xl border border-slate-300 p-3 text-sm"
              type="number" min="1" max="10"
              value={postsPerDay}
              onChange={(e) => setPostsPerDay(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">เวลาเริ่ม (สุ่ม)</label>
            <input
              className="w-full rounded-xl border border-slate-300 p-3 text-sm"
              type="time" value={timeStart}
              onChange={(e) => setTimeStart(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">เวลาสิ้นสุด</label>
            <input
              className="w-full rounded-xl border border-slate-300 p-3 text-sm"
              type="time" value={timeEnd}
              onChange={(e) => setTimeEnd(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">เริ่มวันที่</label>
            <input
              className="w-full rounded-xl border border-slate-300 p-3 text-sm"
              type="date" value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {cards.length > 0
            ? `📅 ${cards.length} โพสต์ วันละ ${postsPerDay} โพสต์ รวม ${totalDays} วัน (${timeStart} - ${timeEnd} สุ่มเวลา)`
            : dataUrls.length > 0
            ? `📷 ${dataUrls.length} รูป — กด "วิเคราะห์ด้วย AI" เพื่อเริ่ม`
            : 'เลือกรูปก่อน แล้วตั้งค่าวันละกี่โพสต์ ช่วงเวลาที่ต้องการ'}
        </p>
      </div>

      {/* Analyze Button */}
      {dataUrls.length > 0 && cards.length === 0 && (
        <button
          onClick={analyzeAll}
          disabled={analyzing}
          className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-4 font-bold text-white shadow-lg shadow-blue-200 transition-all hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 text-lg"
        >
          {analyzing ? `⏳ กำลังวิเคราะห์... ${progress}` : `🤖 วิเคราะห์ด้วย AI (${dataUrls.length} รูป)`}
        </button>
      )}

      {analyzing && progress && (
        <div className="rounded-xl bg-blue-50 p-4 text-center text-blue-700 font-medium">{progress}</div>
      )}

      {/* Cards Preview */}
      {cards.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-700">📝 Preview โพสต์ ({cards.length})</h3>
            <span className="text-xs text-slate-400">แก้ไขแคปชันกับ hashtags ได้ตามต้องการ</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((card, i) => (
              <div key={i} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="aspect-square rounded-lg overflow-hidden border border-slate-100 bg-slate-50 mb-3">
                  <img src={card.dataUrl} alt={`preview-${i}`} className="w-full h-full object-cover" />
                </div>
                <div className="text-xs text-slate-400 mb-1">
                  โพสต์ที่ {i + 1}/{cards.length}
                  {cards.length > 0 && postsPerDay > 0 && (
                    <span> | วันที่ {Math.floor(i / postsPerDay) + 1}</span>
                  )}
                </div>
                {card.error && (
                  <div className="rounded-lg bg-red-50 p-2 text-xs text-red-600 mb-2">
                    ⚠️ AI วิเคราะห์ไม่สำเร็จ — กรุณากรอกแคปชันเอง
                  </div>
                )}
                <textarea
                  className="w-full rounded-lg border border-slate-200 p-2 text-sm mb-2 min-h-20 resize-y"
                  value={card.caption}
                  onChange={(e) => {
                    const updated = [...cards];
                    updated[i] = { ...updated[i], caption: e.target.value };
                    setCards(updated);
                  }}
                  placeholder="แคปชันภาษาไทย..."
                />
                <input
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs mb-2"
                  value={card.hashtags}
                  onChange={(e) => {
                    const updated = [...cards];
                    updated[i] = { ...updated[i], hashtags: e.target.value };
                    setCards(updated);
                  }}
                  placeholder="#agriculture #..."
                />
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={scheduleAll}
              disabled={scheduling}
              className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-4 font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-50"
            >
              {scheduling ? progress : `⏰ Schedule ${cards.length} โพสต์`}
            </button>
            <button
              onClick={publishAllNow}
              disabled={scheduling || !isTauri}
              className="rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 font-bold text-white shadow-lg shadow-slate-200 transition-all hover:from-slate-900 hover:to-slate-800 disabled:opacity-50"
            >
              {scheduling ? progress : `🚀 โพสต์เลย ${cards.length} โพสต์`}
            </button>
          </div>
        </>
      )}

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700 whitespace-pre-line">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          ❌ {error}
        </div>
      )}
    </div>
  );
}
