import type { User } from 'firebase/auth';
import { Home, LogOut } from 'lucide-react';
import { OceanLogo } from './OceanLogo';

export type ActivePage = 'home' | 'register' | 'history' | 'dashboard' | 'people';

interface HeaderProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  user: User;
  onDisconnectFirebase: () => void;
}

const NAV_ITEMS: Array<{ id: ActivePage; label: string }> = [
  { id: 'home', label: 'Início' },
  { id: 'register', label: 'Cadastrar' },
  { id: 'history', label: 'Histórico' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'people', label: 'Pessoas' },
];

export function Header({
  activePage,
  onNavigate,
  user,
  onDisconnectFirebase,
}: HeaderProps) {
  return (
    <header className="border-b border-[#D8E8FA] bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          aria-label="Voltar à página inicial Samsung Ocean 3D"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#086BFF]"
        >
          <OceanLogo compact />
        </button>

        <nav
          aria-label="Navegação principal"
          className="order-3 flex w-full flex-wrap items-center gap-1 border-t border-slate-100 pt-2.5 sm:w-auto sm:flex-nowrap sm:border-t-0 sm:pt-0 md:order-2"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onNavigate(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#086BFF] ${
                  isActive
                    ? 'bg-[#086BFF] text-white'
                    : 'text-slate-600 hover:bg-[#ECFCFF] hover:text-[#086BFF]'
                }`}
              >
                {item.id === 'home' && <Home className="h-3.5 w-3.5" aria-hidden="true" />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="order-2 flex items-center gap-3 shrink-0 md:order-3">
          <button
            type="button"
            onClick={onDisconnectFirebase}
            aria-label={`Sair da conta ${user.email ?? ''}`}
            className="inline-flex items-center gap-2 rounded-lg border border-[#BFEAFF] bg-[#ECFCFF] px-3.5 py-2 text-xs font-medium text-[#086BFF] transition-colors hover:bg-[#DDF5FF] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#086BFF]"
          >
            <span className="max-w-[140px] truncate">{user.displayName ?? user.email}</span>
            <LogOut className="h-3.5 w-3.5 text-[#086BFF]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
