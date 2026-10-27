import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { SetupWizardPage } from './pages/SetupWizardPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { MainLayout } from './components/layout/MainLayout.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { UsersPage } from './pages/UsersPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { CustodyDashboardPage } from './pages/CustodyDashboardPage.tsx';
import { CustodiesPage } from './pages/CustodiesPage.tsx';
import { ItemsPage } from './pages/ItemsPage.tsx';
import { UnitsPage } from './pages/UnitsPage.tsx';
import { CustodyItemsPage } from './pages/CustodyItemsPage.tsx';
import { MovementsPage } from './pages/MovementsPage.tsx';
import { PendingMovementsPage } from './pages/PendingMovementsPage.tsx';
import { DelegationSettingsPage } from './pages/DelegationSettingsPage.tsx';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [setupStatus, setSetupStatus] = useState<{ isConfigured: boolean; companyName?: string } | null>(null);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  const checkSetup = async () => {
    try {
      const res = await fetch('/api/setup/status');
      if (res.ok) {
        const data = await res.json();
        setSetupStatus({
          isConfigured: data.isConfigured,
          companyName: data.companyName,
        });
      } else {
        setSetupStatus({ isConfigured: false });
      }
    } catch (err) {
      console.error('Failed to check setup status:', err);
      setSetupStatus({ isConfigured: false });
    } finally {
      setIsCheckingSetup(false);
    }
  };

  useEffect(() => {
    checkSetup();
  }, []);

  if (isCheckingSetup || isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-xs text-slate-400">جارٍ تهيئة الاتصال بالنظام...</p>
      </div>
    );
  }

  // 1. If system is not configured yet (no admin exists) -> Show pristine Setup Wizard
  if (!setupStatus?.isConfigured) {
    return (
      <SetupWizardPage
        onSetupSuccess={(companyName) => {
          setSetupStatus({ isConfigured: true, companyName });
        }}
      />
    );
  }

  // 2. If system is configured but no user is currently authenticated -> Show Clean Login Page
  if (!user) {
    return <LoginPage companyName={setupStatus.companyName} />;
  }

  // 3. User is logged in -> Render Main Application Layout with corresponding dashboard
  return (
    <MainLayout
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      companyName={setupStatus.companyName}
    >
      {user.role === 'admin' ? (
        activeTab === 'dashboard' ? (
          <AdminDashboardPage onNavigate={setActiveTab} />
        ) : activeTab === 'users' ? (
          <UsersPage />
        ) : activeTab === 'settings' ? (
          <SettingsPage companyName={setupStatus.companyName} onNavigate={setActiveTab} />
        ) : activeTab === 'custodies' ? (
          <CustodiesPage />
        ) : activeTab === 'items' ? (
          <ItemsPage />
        ) : activeTab === 'units' ? (
          <UnitsPage />
        ) : activeTab === 'movements' ? (
          <MovementsPage />
        ) : activeTab === 'pending' ? (
          <PendingMovementsPage />
        ) : activeTab === 'delegation' ? (
          <DelegationSettingsPage />
        ) : (
          <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
              تبويب «{activeTab}» مخصص للتنفيذ في المراحل القادمة
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              وفقاً لقاعدة الوقوف والمراجعة الإجبارية بين المراحل (Strict Phase Gate Protocol)، سيتم تفعيل السجل العام وكشوف الحساب في المرحلة 4، والجرد السنوي في المرحلة 5.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
            >
              العودة للوحة التحكم
            </button>
          </div>
        )
      ) : (
        activeTab === 'items' ? (
          <CustodyItemsPage />
        ) : activeTab === 'settings' ? (
          <SettingsPage companyName={setupStatus.companyName} onNavigate={setActiveTab} />
        ) : activeTab === 'movements' ? (
          <MovementsPage />
        ) : activeTab === 'pending' ? (
          <PendingMovementsPage />
        ) : activeTab === 'delegation' ? (
          <DelegationSettingsPage />
        ) : (
          <CustodyDashboardPage onNavigate={setActiveTab} />
        )
      )}
    </MainLayout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
