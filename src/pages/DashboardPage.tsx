import { useEffect, useState } from 'react';
import { api } from '../lib/tauri';

export function DashboardPage() {
  const [counts, setCounts] = useState([['โพสต์ร่าง', '0'], ['รอเผยแพร่', '0'], ['สำเร็จ', '0'], ['ล้มเหลว', '0']] as Array<[string, string]>);

  useEffect(() => {
    api.listPosts().then((rows) => {
      const draft = rows.filter((r) => r.status === 'draft').length;
      const scheduled = rows.filter((r) => r.status === 'scheduled').length;
      const published = rows.filter((r) => r.status === 'published').length;
      const failed = rows.filter((r) => r.status === 'failed').length;
      setCounts([
        ['โพสต์ร่าง', String(draft)],
        ['รอเผยแพร่', String(scheduled)],
        ['สำเร็จ', String(published)],
        ['ล้มเหลว', String(failed)],
      ]);
    }).catch(() => undefined);
  }, []);

  const cards = [
    ...counts,
  ];
  return (
    <div>
      <h2 className="mb-6 text-3xl font-bold">Dashboard</h2>
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map(([title, value]) => (
          <div key={title} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">{title}</div>
            <div className="mt-2 text-3xl font-bold">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
