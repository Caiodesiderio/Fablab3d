import { LogIn, ShieldCheck } from 'lucide-react';
import { OceanLogo } from './OceanLogo';

interface LoginGateProps {
  onLogin: () => void;
  isAuthenticating: boolean;
  authError: string | null;
}

export function LoginGate({ onLogin, isAuthenticating, authError }: LoginGateProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7FBFF] px-4 py-10 text-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-[#D8E8FA] bg-white p-8 shadow-sm">
        <div className="flex justify-center">
          <OceanLogo />
        </div>

        <div className="mt-7 text-center">
          <p className="text-xs font-semibold tracking-wider text-[#086BFF] uppercase">
            Laboratório de Prototipagem 3D
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
            Controle de Filamentos e Resinas
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
            Faça login com a sua conta Google para aceder às impressoras, registar consumos e consultar o histórico em tempo real.
          </p>
        </div>

        {authError && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800"
          >
            {authError}
          </div>
        )}

        <button
          type="button"
          onClick={onLogin}
          disabled={isAuthenticating}
          data-testid="google-login-btn"
          className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#086BFF] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0553CC] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#086BFF]"
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          <span>{isAuthenticating ? 'A autenticar...' : 'Entrar com Google'}</span>
        </button>

        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-[#D8E8FA] bg-[#F7FBFF] p-3.5 text-xs text-slate-600">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#086BFF]" aria-hidden="true" />
          <span>
            Todos os registos ficam sincronizados diretamente com o banco Firebase Firestore do Samsung Ocean e monitorados pelo Raspberry Pi.
          </span>
        </div>
      </div>
    </div>
  );
}
