import { useEffect, useState } from 'react';
import { api } from '../lib/tauri';

export function QueuePage() {
  const [rows, setRows] = useState<Array<{ id: number; caption: string; page_id: string; scheduled_time: string | null; status: string; public_image_url: string | null; error_message: string | null }>>([]);

  useEffect(() => {
    api.listPosts().then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <div>
      <h2 className="mb-6 text-3xl font-bold">Queue</h2>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-4">รูป</th><th>ข้อความ</th><th>เพจ</th><th>เวลา</th><th>สถานะ</th><th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-4">-</td>
                <td>{row.caption}</td>
                <td>{row.page_id}</td>
                <td>{row.scheduled_time ?? '-'}</td>
                <td>{row.status}</td>
                <td>แก้ไข | ลบ | retry</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
