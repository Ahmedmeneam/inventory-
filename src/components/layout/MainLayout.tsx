import React, { useState } from 'react';
import { AppHeader } from './AppHeader.tsx';
import { Sidebar } from './Sidebar.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { Lock, ShieldAlert } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  companyName?: string;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  activeTab,
  onSelectTab,
  companyName,
}) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isIdleLocked, unlockIdleSession, user, logout } = useAuth();
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPassword) return;
    setIsUnlocking(true);
    setUnlockError('');
    const success = await unlockIdleSession(unlockPassword);
    setIsUnlocking(false);
    if (!success) {
      setUnlockError('كلمة المرور غير صحيحة');
    } else {
      setUnlockPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      <AppHeader
        onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        companyName={companyName}
        onNavigate={onSelectTab}
      />

      <div className="flex-1 flex w-full">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
        />

        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* 30-Minute Idle Lock Screen Overlay */}
      {isIdleLocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                تم قفل الشاشة بسبب الخمول
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                مرت 30 دقيقة دون نشاط. أدخل كلمة مرور الحساب (<strong>{user?.user_code}</strong>) للمتابعة.
              </p>
            </div>

            <form onSubmit={handleUnlockSubmit} className="space-y-3">
              <input
                type="password"
                placeholder="كلمة المرور"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                className="w-full text-center px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              {unlockError && (
                <p className="text-xs text-rose-500 font-medium">{unlockError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isUnlocking}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  {isUnlocking ? 'جارٍ التحقق...' : 'إلغاء القفل'}
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition-colors cursor-pointer"
                >
                  تسجيل الخروج
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
