import { useEffect, useState } from 'react';
import { api } from '../lib/tauri';
import type { EnvSettings } from '../lib/types';

export function SettingsPage() {
  const [pageId, setPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('gemini-1.5-flash');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api.getEnvSettings().then((env: EnvSettings) => {
      const pid = env.fb_page_id || pageId;
      const pn = env.fb_page_name || pageName;
      const tok = env.fb_page_access_token || accessToken;
      const key = env.ai_api_key || aiApiKey;
      const mdl = env.ai_model || aiModel;

      setPageId(pid);
      setPageName(pn);
      setAccessToken(tok);
      setAiApiKey(key);
      setAiModel(mdl);

      if (pid && tok && key) {
        api.saveSettings({
          page_id: pid,
          page_name: pn,
          access_token: tok,
          ai_api_key: key,
          ai_model: mdl,
        }).then(() => setMessage('📋 โหลดค่าจาก .env อัตโนมัติและบันทึกแล้ว'))
          .catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.saveSettings({
        page_id: pageId,
        page_name: pageName,
        access_token: accessToken,
        ai_api_key: aiApiKey,
        ai_model: aiModel,
      });
      setMessage('บันทึกตั้งค่าสำเร็จ');
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const testFb = async () => {
    if (!accessToken) {
      setError('กรุณากรอก Access Token ก่อนทดสอบ');
      return;
    }
    setTesting(true);
    setError('');
    setMessage('');
    try {
      const result = await api.testFacebook(accessToken);
      setMessage(`ทดสอบสำเร็จ — ${JSON.stringify(result).slice(0, 200)}`);
    } catch (e) {
      setError(`ทดสอบล้มเหลว: ${String(e)}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">ตั้งค่า</h2>
      <div className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <input
          className="rounded-xl border border-slate-300 p-3"
          placeholder="Facebook Page ID"
          value={pageId}
          onChange={(e) => setPageId(e.target.value)}
        />
        <input
          className="rounded-xl border border-slate-300 p-3"
          placeholder="ชื่อเพจ"
          value={pageName}
          onChange={(e) => setPageName(e.target.value)}
        />
        <input
          className="rounded-xl border border-slate-300 p-3"
          placeholder="Page Access Token"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
        />
        <input
          className="rounded-xl border border-slate-300 p-3"
          placeholder="AI API Key"
          value={aiApiKey}
          onChange={(e) => setAiApiKey(e.target.value)}
        />
        <input
          className="rounded-xl border border-slate-300 p-3"
          placeholder="AI Model"
          value={aiModel}
          onChange={(e) => setAiModel(e.target.value)}
        />
        <div className="flex gap-3">
          <button
            onClick={testFb}
            disabled={testing}
            className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {testing ? 'กำลังทดสอบ...' : 'ทดสอบ Facebook'}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
        {message && <p className="text-sm text-emerald-600">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
