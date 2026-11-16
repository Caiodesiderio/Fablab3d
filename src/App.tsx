import { useState } from 'react';
import { Header, type ActivePage } from './components/Header';
import { HomePage } from './components/HomePage';
import { PrintWizard } from './components/PrintWizard';
import { HistoryTab } from './components/HistoryTab';
import { DashboardTab } from './components/DashboardTab';
import { PeopleManagerTab } from './components/PeopleManagerTab';
import { LoginGate } from './components/LoginGate';
import { OceanLogo } from './components/OceanLogo';
import { useLabData } from './hooks/useLabData';

export default function App() {
  const [activePage, setActivePage] = useState<ActivePage>('home');
  const {
    user,
    authReady,
    authError,
    isAuthenticating,
    isCloudConnected,
    loading,
    syncError,
    logs,
    people,
    addPrintLogs,
    deletePrintLog,
    addPerson,
    removePerson,
    restoreDefaultPeople,
    connectFirebase,
    disconnectFirebase,
  } = useLabData();

  if (!authReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7FBFF] px-4 text-slate-700">
        <OceanLogo />
        <p className="mt-4 text-sm font-medium text-slate-600">A verificar sessão...</p>
      </div>
    );
  }

  if (!isCloudConnected || !user) {
    return (
      <LoginGate
        onLogin={() => void connectFirebase()}
        isAuthenticating={isAuthenticating}
        authError={authError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F7FBFF] text-slate-900">
      <Header
        activePage={activePage}
        onNavigate={setActivePage}
        user={user}
        onDisconnectFirebase={() => void disconnectFirebase()}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {syncError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {syncError}
          </div>
        )}

        {activePage === 'home' && (
          <HomePage
            logs={logs}
            people={people}
            onSelectPage={setActivePage}
          />
        )}

        {activePage === 'register' && (
          <PrintWizard
            people={people}
            onSubmitPrint={addPrintLogs}
            onBackHome={() => setActivePage('home')}
            onOpenHistory={() => setActivePage('history')}
          />
        )}

        {activePage === 'history' && (
          <HistoryTab
            logs={logs}
            loading={loading}
            onDeleteLog={deletePrintLog}
            onGoToRegister={() => setActivePage('register')}
            onBackHome={() => setActivePage('home')}
          />
        )}

        {activePage === 'dashboard' && (
          <DashboardTab
            logs={logs}
            onBackHome={() => setActivePage('home')}
          />
        )}

        {activePage === 'people' && (
          <PeopleManagerTab
            people={people}
            onAddPerson={addPerson}
            onRemovePerson={removePerson}
            onRestoreDefaults={restoreDefaultPeople}
            onBackHome={() => setActivePage('home')}
          />
        )}
      </main>
    </div>
  );
}
