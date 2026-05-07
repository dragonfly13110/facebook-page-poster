import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { api } from '../lib/tauri';

type PageItem = { id: number; page_id: string; page_name: string; access_token: string };

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
  const [pages, setPages] = useState<PageItem[]>([]);
  const [pageId, setPageId] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [imageName, setImageName] = useState('');
  const [message, setMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const preview = useMemo(() => imageDataUrl || '', [imageDataUrl]);

  useEffect(() => {
    api.listPages()
      .then((rows) => {
        setPages(rows);
        if (!pageId && rows[0]) setPageId(rows[0].page_id);
      })
      .catch(() => undefined);
  }, []);

  const acceptFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setMessage('เลือกเฉพาะไฟล์รูป');
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setImageDataUrl(dataUrl);
    setImageName(file.name);
    setMessage(`รับรูปแล้ว: ${file.name}`);
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
    if (!preview) return setMessage('ใส่รูปก่อน');
    const result = await api.analyzeImage({
      api_key: localStorage.getItem('AI_API_KEY') ?? '',
      model: localStorage.getItem('AI_MODEL') ?? 'gpt-4.1-mini',
      image_data_url: preview,
    });
    setAiResult(result.raw_text);
    setCaption(result.caption);
    setHashtags(result.hashtags);
    setMessage('วิเคราะห์แล้ว');
  };

  const saveDraft = async () => {
    await api.createPost({
      public_image_url: imageDataUrl,
      ai_analysis: aiResult,
      caption,
      hashtags,
      page_id: pageId,
      scheduled_time: undefined,
    });
    setMessage('บันทึกร่างแล้ว');
  };

  const schedule = async () => {
    await api.createPost({
      public_image_url: imageDataUrl,
      ai_analysis: aiResult,
      caption,
      hashtags,
      page_id: pageId,
      scheduled_time: scheduledTime,
    });
    setMessage('บันทึกคิวแล้ว');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">เพิ่มโพสต์ใหม่</h2>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div
            className={`rounded-xl border-2 border-dashed p-4 transition ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">ลากไฟล์รูปมาวางตรงนี้</p>
                  <p className="text-sm text-slate-500">หรือเลือกไฟล์จากเครื่อง</p>
                </div>
                <button
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  เลือกรูป
                </button>
                <input ref={fileInputRef} className="hidden" type="file" accept="image/*" onChange={onFileChange} />
              </div>

              {preview ? (
                <div className="overflow-hidden rounded-2xl border bg-white">
                  <img src={preview} alt={imageName} className="max-h-[420px] w-full object-contain" />
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400">
                  ยังไม่มีรูป
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                {imageName ? `ไฟล์: ${imageName}` : 'ยังไม่เลือกไฟล์'}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <button onClick={analyze} className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white">วิเคราะห์ภาพด้วย AI</button>
            <textarea className="min-h-32 rounded-xl border border-slate-300 p-3" placeholder="แคปชันภาษาไทย" value={caption} onChange={(e) => setCaption(e.target.value)} />
            <input className="rounded-xl border border-slate-300 p-3" placeholder="hashtag" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
            <select className="rounded-xl border border-slate-300 p-3" value={pageId} onChange={(e) => setPageId(e.target.value)}>
              <option value="">เลือกเพจ</option>
              {pages.map((p) => <option key={p.page_id} value={p.page_id}>{p.page_name}</option>)}
            </select>
            <input className="rounded-xl border border-slate-300 p-3" type="datetime-local" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            <div className="flex flex-wrap gap-3">
              <button onClick={saveDraft} className="rounded-xl border border-slate-300 px-4 py-3">บันทึกร่าง</button>
              <button onClick={schedule} className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white">ตั้งเวลาโพสต์</button>
              <button onClick={saveDraft} className="rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white">โพสต์ทันที</button>
            </div>
            <p className="text-sm text-slate-500">{message}</p>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-4 text-lg font-semibold">ผล AI</h3>
          <div className="space-y-3 text-sm text-slate-600">
            <p className="whitespace-pre-wrap">{aiResult || 'ยังไม่ได้วิเคราะห์ภาพ'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
