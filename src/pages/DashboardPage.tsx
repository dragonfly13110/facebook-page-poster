import { useEffect, useState } from 'react';
import { api } from '../lib/tauri';

type PostSummary = {
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

const statCards = [
  { key: 'draft', label: '📝 โพสต์ร่าง', desc: 'ยังไม่ได้ตั้งเวลา', color: 'from-slate-500 to-slate-400', bg: 'bg-slate-50', text: 'text-slate-700' },
  { key: 'scheduled', label: '⏰ รอเผยแพร่', desc: 'ตั้งเวลาไว้แล้ว', color: 'from-amber-500 to-orange-400', bg: 'bg-amber-50', text: 'text-amber-700' },
  { key: 'published', label: '✅ เผยแพร่แล้ว', desc: 'โพสต์สำเร็จ', color: 'from-emerald-500 to-green-400', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  { key: 'failed', label: '❌ ล้มเหลว', desc: 'ต้องแก้ไข', color: 'from-red-500 to-rose-400', bg: 'bg-red-50', text: 'text-red-700' },
];

export function DashboardPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [recentPosts, setRecentPosts] = useState<PostSummary[]>([]);

  useEffect(() => {
    api.listPosts()
      .then((rows) => {
        const c: Record<string, number> = {};
        rows.forEach((r) => {
          c[r.status] = (c[r.status] || 0) + 1;
        });
        setCounts(c);
        setRecentPosts(rows.slice(0, 5));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const total = Object.values(counts).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">📊 Dashboard</h2>
        <p className="mt-1 text-sm text-slate-500">ภาพรวมสถานะโพสต์ทั้งหมดของคุณ</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.key}
            className={`group relative overflow-hidden rounded-2xl p-5 shadow-sm ring-1 ring-slate-200 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 bg-white`}
          >
            <div className={`absolute top-0 left-0 h-1 w-full bg-gradient-to-r ${card.color}`} />
            <div className="text-sm font-medium text-slate-500">{card.label}</div>
            <div className="mt-2 text-4xl font-bold text-slate-800">
              {loading ? (
                <span className="inline-block h-9 w-12 animate-pulse rounded bg-slate-200" />
              ) : (
                counts[card.key] || 0
              )}
            </div>
            <div className="mt-1 text-xs text-slate-400">{card.desc}</div>
            {!loading && total > 0 && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${card.color} transition-all duration-700`}
                  style={{ width: `${((counts[card.key] || 0) / total) * 100}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {recentPosts.length > 0 && !loading && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-4 text-lg font-semibold text-slate-700">📌 โพสต์ล่าสุด</h3>
          <div className="space-y-3">
            {recentPosts.map((p) => (
              <div key={p.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                <span className={`mt-0.5 inline-block h-2 w-2 rounded-full flex-shrink-0 ${
                  p.status === 'published' ? 'bg-emerald-500' :
                  p.status === 'scheduled' ? 'bg-amber-500' :
                  p.status === 'failed' ? 'bg-red-500' : 'bg-slate-400'
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-700">{p.caption}</p>
                  <p className="text-xs text-slate-400">
                    {p.status} · {p.scheduled_time ? new Date(p.scheduled_time).toLocaleString('th-TH') : 'ยังไม่ตั้งเวลา'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-5">
        <p className="text-sm font-semibold text-blue-700">💡 คำแนะนำ</p>
        <ul className="mt-2 space-y-1 text-sm text-blue-600">
          <li>• เริ่มจากหน้า <strong>เพิ่มโพสต์</strong> เพื่อร่างและใช้ AI วิเคราะห์ภาพ</li>
          <li>• ตรวจสอบคิวโพสต์ในหน้า <strong>Queue</strong> ก่อนตั้งเวลา</li>
          <li>• ตั้งค่า Token และ API Key ในหน้า <strong>ตั้งค่า</strong> ก่อนใช้งานจริง</li>
        </ul>
      </div>
    </div>
  );
}
