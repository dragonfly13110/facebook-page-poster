import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { api } from './lib/tauri';
import { DashboardPage } from './pages/DashboardPage';
import { NewPostPage } from './pages/NewPostPage';
import { QueuePage } from './pages/QueuePage';
import { SettingsPage } from './pages/SettingsPage';

const nav = [
  { to: '/', label: '📊 Dashboard', desc: 'ภาพรวม' },
  { to: '/new', label: '✨ เพิ่มโพสต์', desc: 'ร่าง + AI' },
  { to: '/queue', label: '📋 Queue', desc: 'จัดการคิว' },
  { to: '/settings', label: '⚙️ ตั้งค่า', desc: 'เชื่อมต่อ' },
];

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function notify(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '📮' });
  }
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    api.initDb().then(() => {
      setDbReady(true);
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }).catch(() => setDbReady(true));
  }, []);

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/30">
      {!isTauri && (
        <div className="sticky top-0 z-50 bg-amber-500 px-4 py-3 text-center text-sm font-bold text-white shadow-md">
          ⚠️ โหมดตัวอย่างในเบราว์เซอร์ — โพสต์ไม่ขึ้น Facebook จริง! ใช้ <code className="bg-amber-600 px-2 py-0.5 rounded text-xs">cargo tauri dev</code> เพื่อเชื่อมต่อจริง
        </div>
      )}
      <div className="mx-auto flex min-h-full max-w-7xl">
        <aside className="w-64 border-r border-slate-200/60 bg-white/70 p-5 backdrop-blur-xl">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 text-lg shadow-lg shadow-blue-200">
              📮
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight text-slate-800">Facebook</h1>
              <h1 className="text-base font-bold leading-tight text-slate-800">Page Poster</h1>
            </div>
          </div>
          <p className="mb-6 text-xs text-slate-400">จัดการโพสต์เพจด้วย AI</p>
          <nav className="space-y-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `group block rounded-xl px-4 py-3 transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className={`text-xs ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                      {item.desc}
                    </div>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-8">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">🟢 สถานะระบบ</p>
              <p className="mt-1 text-xs text-slate-400">
                {dbReady ? 'พร้อมทำงาน' : 'กำลังโหลด...'}
              </p>
            </div>
          </div>
        </aside>
        <main className="flex-1 p-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/new" element={<NewPostPage />} />
            <Route path="/queue" element={<QueuePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
