import { useEffect } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { api } from './lib/tauri';
import { DashboardPage } from './pages/DashboardPage';
import { NewPostPage } from './pages/NewPostPage';
import { QueuePage } from './pages/QueuePage';
import { SettingsPage } from './pages/SettingsPage';

const nav = [
  { to: '/', label: 'Dashboard' },
  { to: '/new', label: 'เพิ่มโพสต์' },
  { to: '/queue', label: 'Queue' },
  { to: '/settings', label: 'ตั้งค่า' },
];

export default function App() {
  useEffect(() => {
    api.initDb().catch(() => undefined);
  }, []);

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="mx-auto flex min-h-full max-w-7xl">
        <aside className="w-64 border-r bg-white/80 p-4 backdrop-blur">
          <h1 className="mb-8 text-xl font-bold">Facebook Page Poster</h1>
          <nav className="space-y-2">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block rounded-xl px-4 py-3 text-sm font-medium ${isActive ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-6">
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
