import { useEffect, useState } from 'react';
import { api } from '../lib/tauri';
import { ConfirmDialog } from '../components/ConfirmDialog';

type PostItem = {
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

const statusBadge = (status: string) => {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    draft:     { bg: 'bg-slate-100', text: 'text-slate-700', label: '📝 ร่าง' },
    scheduled: { bg: 'bg-amber-100', text: 'text-amber-700', label: '⏰ รอเวลา' },
    published: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '✅ เผยแพร่' },
    failed:    { bg: 'bg-red-100', text: 'text-red-700', label: '❌ ล้มเหลว' },
  };
  const s = map[status] || map.draft;
  return `${s.bg} ${s.text} inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium`;
};

const statusLabel = (status: string) => {
  const map: Record<string, string> = { draft: '📝 ร่าง', scheduled: '⏰ รอเวลา', published: '✅ เผยแพร่', failed: '❌ ล้มเหลว' };
  return map[status] || status;
};

export function QueuePage() {
  const [rows, setRows] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState<number | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [editing, setEditing] = useState<PostItem | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editHashtags, setEditHashtags] = useState('');
  const [editScheduledTime, setEditScheduledTime] = useState('');
  const [editPublicUrl, setEditPublicUrl] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listPosts();
      setRows(data);
      setError('');
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openEdit = (post: PostItem) => {
    setEditing(post);
    setEditCaption(post.caption);
    setEditHashtags(post.hashtags || '');
    setEditScheduledTime(post.scheduled_time ? post.scheduled_time.slice(0, 16) : '');
    setEditPublicUrl(post.public_image_url || '');
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    setError('');
    try {
      const sched = editScheduledTime
        ? new Date(editScheduledTime).toISOString()
        : undefined;
      await api.editPost({
        post_id: editing.id,
        caption: editCaption,
        hashtags: editHashtags || undefined,
        scheduled_time: sched,
        public_image_url: editPublicUrl || undefined,
      });
      setMessage(`✏️ แก้ไขโพสต์ #${editing.id} แล้ว`);
      setEditing(null);
      load();
    } catch (e) { setError(String(e)); }
    finally { setSavingEdit(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.deletePost(deleteId);
      setMessage(`🗑️ ลบโพสต์ #${deleteId} แล้ว`);
      setError('');
      setDeleteId(null);
      load();
    } catch (e) { setError(String(e)); setDeleteId(null); }
  };

  const handleRetry = async (post: PostItem) => {
    setRetrying(post.id); setError('');
    try {
      const pages = await api.listPages();
      const page = pages.find((p) => p.page_id === post.page_id);
      if (!page) { setError('ไม่พบเพจที่ใช้โพสต์นี้'); return; }
      await api.retryPost({ post_id: post.id, page_id: post.page_id, page_access_token: page.access_token });
      setMessage(`🔄 retry โพสต์ #${post.id} สำเร็จ`);
      load();
    } catch (e) { setError(String(e)); }
    finally { setRetrying(null); }
  };

  const filtered = rows.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (search && !r.caption.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = { all: rows.length, draft: 0, scheduled: 0, published: 0, failed: 0 };
  rows.forEach((r) => { if (r.status in counts) (counts as Record<string, number>)[r.status]++; });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">📋 Queue</h2>
        <p className="mt-1 text-sm text-slate-500">
          จัดการโพสต์ทั้งหมด — แก้ไข, ลบ, retry โพสต์ที่ล้มเหลว
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {(['all', 'draft', 'scheduled', 'published', 'failed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-slate-800 text-white shadow-md shadow-slate-200'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {f === 'all' ? '📋 ทั้งหมด' : statusLabel(f)} ({counts[f]})
            </button>
          ))}
        </div>
        <input
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
          placeholder="🔍 ค้นหาแคปชัน..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={load}
          disabled={loading}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? '⏳...' : '🔄 รีเฟรช'}
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

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-slate-50/80">
                <th className="p-4 font-semibold text-slate-500">#</th>
                <th className="font-semibold text-slate-500">ข้อความ</th>
                <th className="font-semibold text-slate-500">เวลา</th>
                <th className="font-semibold text-slate-500">สถานะ</th>
                <th className="font-semibold text-slate-500">error</th>
                <th className="pr-4 font-semibold text-slate-500">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <span className="text-4xl">{loading ? '⏳' : '📭'}</span>
                      <p className="mt-2 text-sm font-medium">
                        {loading ? 'กำลังโหลด...' : search ? 'ไม่พบโพสต์ที่ค้นหา' : 'ยังไม่มีโพสต์'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="border-t transition-colors hover:bg-slate-50/50">
                    <td className="p-4 font-mono text-xs text-slate-400">#{row.id}</td>
                    <td className="max-w-xs">
                      <p className="truncate font-medium text-slate-700">{row.caption}</p>
                      <p className="text-xs text-slate-400">
                        {row.scheduled_time
                          ? new Date(row.scheduled_time).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
                          : '—'}
                      </p>
                    </td>
                    <td className="text-sm text-slate-500">
                      {row.scheduled_time ? new Date(row.scheduled_time).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                    <td><span className={statusBadge(row.status)}>{statusLabel(row.status)}</span></td>
                    <td>
                      {row.error_message ? (
                        <span className="max-w-[120px] truncate block text-xs text-red-500" title={row.error_message}>
                          {row.error_message}
                        </span>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="pr-4">
                      <div className="flex gap-2">
                        <button className="text-xs font-medium text-slate-500 hover:text-slate-700" onClick={() => openEdit(row)}>✏️</button>
                        <button className="text-xs font-medium text-red-500 hover:text-red-700" onClick={() => setDeleteId(row.id)}>🗑️</button>
                        {row.status === 'failed' && (
                          <button className="text-xs font-medium text-blue-500 hover:text-blue-700" disabled={retrying === row.id} onClick={() => handleRetry(row)}>
                            {retrying === row.id ? '⏳' : '🔄'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        title="ยืนยันการลบ"
        message={`คุณแน่ใจหรือไม่ที่จะลบโพสต์ #${deleteId}? การลบไม่สามารถเรียกคืนได้`}
        confirmLabel="ลบโพสต์"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div
            className="mx-4 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800">✏️ แก้ไขโพสต์ #{editing.id}</h3>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  แคปชัน <span className="font-normal text-slate-400">({editCaption.length} ตัว)</span>
                </label>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none"
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                />
                <div className="mt-1 flex justify-between text-xs text-slate-400">
                  <span>สูงสุด ~63,206 ตัวอักษร</span>
                  <span className={editCaption.length > 63206 ? 'text-red-500 font-bold' : ''}>
                    {editCaption.length.toLocaleString()} / 63,206
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Hashtags</label>
                <input
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none"
                  value={editHashtags}
                  onChange={(e) => setEditHashtags(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Public Image URL</label>
                <input
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none"
                  value={editPublicUrl}
                  onChange={(e) => setEditPublicUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">เวลาโพสต์</label>
                <input
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none"
                  type="datetime-local"
                  value={editScheduledTime}
                  onChange={(e) => setEditScheduledTime(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                onClick={() => setEditing(null)}
              >
                ยกเลิก
              </button>
              <button
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={savingEdit || !editCaption}
                onClick={saveEdit}
              >
                {savingEdit ? 'กำลังบันทึก...' : '💾 บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
