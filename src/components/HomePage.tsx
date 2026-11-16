import { useMemo } from 'react';
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  PlusCircle,
  Users,
} from 'lucide-react';
import {
  PRINTERS,
  aggregateDashboardStats,
  formatTimestampPt,
  type PersonRecord,
  type PrintLogRecord,
} from '../lib/filamentLogic';
import type { ActivePage } from './Header';

interface HomePageProps {
  logs: PrintLogRecord[];
  people: PersonRecord[];
  onSelectPage: (page: ActivePage) => void;
}

export function HomePage({ logs, people, onSelectPage }: HomePageProps) {
  const stats = useMemo(() => aggregateDashboardStats(logs, 'ALL'), [logs]);
  const latestLog = logs[0] ?? null;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-[#D8E8FA] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wider text-[#086BFF] uppercase">
              Laboratório de Prototipagem 3D · Samsung Ocean
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl [text-wrap:balance]">
              Controle de Filamentos e Resinas
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
              Selecione uma das 4 áreas abaixo para registar uma nova impressão passo a passo, consultar o histórico em tempo real, analisar gráficos ou gerir utilizadores.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            <div>
              <span className="block text-xs text-slate-500">Impressoras</span>
              <span className="font-mono-tabular mt-1 block text-xl font-bold text-[#086BFF]">
                {PRINTERS.length}
              </span>
            </div>
            <div>
              <span className="block text-xs text-slate-500">Consumo Total</span>
              <span className="font-mono-tabular mt-1 block text-xl font-bold text-slate-900">
                {(stats.totalGrams / 1000).toFixed(2)} kg
              </span>
            </div>
            <div>
              <span className="block text-xs text-slate-500">Equipa</span>
              <span className="font-mono-tabular mt-1 block text-xl font-bold text-slate-900">
                {people.length}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Ações principais do laboratório">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Box 1: Cadastrar Impressão */}
          <button
            type="button"
            onClick={() => onSelectPage('register')}
            className="group flex flex-col justify-between rounded-2xl border border-[#D8E8FA] bg-white p-7 text-left transition-all duration-150 hover:border-[#086BFF] hover:bg-[#F7FBFF] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#086BFF]"
          >
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#086BFF] text-white transition-transform duration-150 group-hover:scale-105">
                  <PlusCircle className="h-7 w-7" aria-hidden="true" />
                </div>
                <span className="font-mono-tabular text-xs font-medium text-[#086BFF]">
                  {PRINTERS.length} máquinas prontas
                </span>
              </div>

              <h2 className="mt-5 text-xl font-bold text-slate-900">
                Cadastrar Impressão
              </h2>
              <p className="mt-1.5 text-sm text-slate-600">
                Fluxo guiado por etapas: escolha a máquina, o utilizador, modo AMS/CFS e o material utilizado.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <div className="text-xs text-slate-500">
                <span>Fluxo em 4 passos</span>
                <span aria-hidden="true"> · </span>
                <span>Simples ou Multi-Cor</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#086BFF] whitespace-nowrap shrink-0">
                <span>Iniciar</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </div>
          </button>

          {/* Box 2: Histórico */}
          <button
            type="button"
            onClick={() => onSelectPage('history')}
            className="group flex flex-col justify-between rounded-2xl border border-[#D8E8FA] bg-white p-7 text-left transition-all duration-150 hover:border-[#0F8EFF] hover:bg-[#F7FBFF] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#086BFF]"
          >
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#0F8EFF] text-white transition-transform duration-150 group-hover:scale-105">
                  <ClipboardList className="h-7 w-7" aria-hidden="true" />
                </div>
                <span className="font-mono-tabular text-xs font-medium text-[#0B7CFF]">
                  {logs.length} registos
                </span>
              </div>

              <h2 className="mt-5 text-xl font-bold text-slate-900">
                Histórico
              </h2>
              <p className="mt-1.5 text-sm text-slate-600">
                Tabela em tempo real com data, máquina, pessoa, projeto, material, cor e gramas consumidas.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <div className="min-w-0 truncate text-xs text-slate-500">
                {latestLog ? (
                  <>
                    <span>Último: {latestLog.project}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono-tabular">{formatTimestampPt(latestLog.createdAtMs)}</span>
                  </>
                ) : (
                  <span>Sem registos recentes</span>
                )}
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#086BFF] whitespace-nowrap shrink-0">
                <span>Consultar</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </div>
          </button>

          {/* Box 3: Dashboard */}
          <button
            type="button"
            onClick={() => onSelectPage('dashboard')}
            className="group flex flex-col justify-between rounded-2xl border border-[#D8E8FA] bg-white p-7 text-left transition-all duration-150 hover:border-[#18A0FF] hover:bg-[#F7FBFF] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#086BFF]"
          >
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#18A0FF] text-white transition-transform duration-150 group-hover:scale-105">
                  <BarChart3 className="h-7 w-7" aria-hidden="true" />
                </div>
                <span className="font-mono-tabular text-xs font-medium text-[#0B7CFF]">
                  {stats.totalGrams.toFixed(1)} g acumulados
                </span>
              </div>

              <h2 className="mt-5 text-xl font-bold text-slate-900">
                Dashboard
              </h2>
              <p className="mt-1.5 text-sm text-slate-600">
                Gráficos Chart.js de materiais mais consumidos, ranking de utilizadores e filtro por mês.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <div className="min-w-0 truncate text-xs text-slate-500">
                {stats.topMaterial ? (
                  <>
                    <span>Líder: {stats.topMaterial.name}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono-tabular">{stats.topMaterial.grams.toFixed(1)} g</span>
                  </>
                ) : (
                  <span>Análise mensal interativa</span>
                )}
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#086BFF] whitespace-nowrap shrink-0">
                <span>Abrir Gráficos</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </div>
          </button>

          {/* Box 4: Gerir Pessoas */}
          <button
            type="button"
            onClick={() => onSelectPage('people')}
            className="group flex flex-col justify-between rounded-2xl border border-[#D8E8FA] bg-white p-7 text-left transition-all duration-150 hover:border-[#38B2FF] hover:bg-[#F7FBFF] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#086BFF]"
          >
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#38B2FF] text-white transition-transform duration-150 group-hover:scale-105">
                  <Users className="h-7 w-7" aria-hidden="true" />
                </div>
                <span className="font-mono-tabular text-xs font-medium text-[#0B7CFF]">
                  {people.length} pessoas ativas
                </span>
              </div>

              <h2 className="mt-5 text-xl font-bold text-slate-900">
                Gerir Pessoas
              </h2>
              <p className="mt-1.5 text-sm text-slate-600">
                Adicione ou remova utilizadores autorizados do laboratório, atualizando o cadastro automaticamente.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <div className="text-xs text-slate-500">
                <span>Lista sincronizada em tempo real</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#086BFF] whitespace-nowrap shrink-0">
                <span>Gerir Equipa</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
}
