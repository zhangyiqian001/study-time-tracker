import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, ListTodo, Timer, Target } from 'lucide-react';

const navItems = [
  { to: '/', label: '仪表盘', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: '任务管理', icon: ListTodo },
  { to: '/timer', label: '学习计时', icon: Timer },
];

const Layout = () => {
  return (
    <div className="flex h-screen w-screen bg-slate-50">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 transition-transform hover:scale-105">
            <Timer size={18} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-slate-800 leading-tight">学习记录</span>
            <span className="text-xs text-slate-400">Study Tracker</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/80 text-blue-500 shadow-sm">
              <Target size={14} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-700">每日目标</span>
              <span className="text-[11px] text-slate-500">4 小时专注学习</span>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
