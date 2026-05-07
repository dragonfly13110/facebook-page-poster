import { useState } from 'react';
import { api } from '../lib/tauri';

export function SettingsPage() {
  const [pageId, setPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('gpt-4.1-mini');
  const [message, setMessage] = useState('');

  const save = async () => {
    await api.saveSettings({ page_id: pageId, page_name: pageName, access_token: accessToken, ai_api_key: aiApiKey, ai_model: aiModel });
    localStorage.setItem('AI_API_KEY', aiApiKey);
    localStorage.setItem('AI_MODEL', aiModel);
    setMessage('บันทึกแล้ว');
  };

  const testFb = async () => {
    await api.testFacebook(accessToken);
    setMessage('ทดสอบ Facebook ผ่าน');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">ตั้งค่า</h2>
      <div className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <input className="rounded-xl border border-slate-300 p-3" placeholder="Facebook Page ID" value={pageId} onChange={(e) => setPageId(e.target.value)} />
        <input className="rounded-xl border border-slate-300 p-3" placeholder="ชื่อเพจ" value={pageName} onChange={(e) => setPageName(e.target.value)} />
        <input className="rounded-xl border border-slate-300 p-3" placeholder="Page Access Token" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
        <input className="rounded-xl border border-slate-300 p-3" placeholder="AI API Key" value={aiApiKey} onChange={(e) => setAiApiKey(e.target.value)} />
        <input className="rounded-xl border border-slate-300 p-3" placeholder="AI Model" value={aiModel} onChange={(e) => setAiModel(e.target.value)} />
        <div className="flex gap-3">
          <button onClick={testFb} className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white">ทดสอบ Facebook</button>
          <button onClick={save} className="rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white">บันทึก</button>
        </div>
        <p className="text-sm text-slate-500">{message}</p>
      </div>
    </div>
  );
}
