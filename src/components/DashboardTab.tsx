import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  PieController,
  Tooltip,
} from 'chart.js';
import { ArrowLeft, CalendarClock, CheckCircle2, FileDown, Mail, Send, X } from 'lucide-react';
import {
  aggregateDashboardStats,
  formatMonthLabel,
  type PrintLogRecord,
} from '../lib/filamentLogic';
import { isValidEmail } from '../lib/reportFormatter';

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Legend,
  LinearScale,
  PieController,
  Tooltip
);

interface DashboardTabProps {
  logs: PrintLogRecord[];
  onBackHome: () => void;
}

interface ReportServerStatus {
  smtpConfigured: boolean;
  defaultRecipient: string;
  firestoreAdminReady: boolean;
  scheduleRule: string;
  lastAutoSentMonth: string | null;
  lastAutoSentAt: string | null;
}

const OCEAN_MATERIAL_PALETTE = [
  '#086BFF',
  '#18A0FF',
  '#38B2FF',
  '#0EA5E9',
  '#60C5FF',
  '#8DD7FF',
];

export function DashboardTab({ logs, onBackHome }: DashboardTabProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('cd.chaves2005@gmail.com');
  const [serverStatus, setServerStatus] = useState<ReportServerStatus | null>(null);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const pieCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const barCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const stats = useMemo(
    () => aggregateDashboardStats(logs, selectedMonth),
    [logs, selectedMonth]
  );

  const periodLabel =
    selectedMonth === 'ALL' ? 'Todos os meses' : formatMonthLabel(selectedMonth);

  useEffect(() => {
    if (selectedMonth !== 'ALL' && !stats.availableMonths.includes(selectedMonth)) {
      setSelectedMonth('ALL');
    }
  }, [selectedMonth, stats.availableMonths]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reports/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ReportServerStatus | null) => {
        if (cancelled || !data) return;
        setServerStatus(data);
        if (data.defaultRecipient) {
          setRecipientEmail(data.defaultRecipient);
        }
      })
      .catch(() => {
        // Status endpoint optional when running static preview
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEmailModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsEmailModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEmailModalOpen]);

  useEffect(() => {
    const canvas = pieCanvasRef.current;
    if (!canvas || stats.byMaterial.length === 0) return;

    const chart = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: stats.byMaterial.map((m) => m.material),
        datasets: [
          {
            label: 'Consumo (g)',
            data: stats.byMaterial.map((m) => m.grams),
            backgroundColor: stats.byMaterial.map(
              (_, i) => OCEAN_MATERIAL_PALETTE[i % OCEAN_MATERIAL_PALETTE.length]
            ),
            borderColor: '#FFFFFF',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 150,
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#334155',
              padding: 16,
              font: {
                family: "'Plus Jakarta Sans', sans-serif",
                size: 12,
              },
            },
          },
          tooltip: {
            backgroundColor: '#0F172A',
            titleColor: '#F8FAFC',
            bodyColor: '#E2E8F0',
            callbacks: {
              label: (ctx) => {
                const value = Number(ctx.parsed ?? 0);
                return ` ${ctx.label}: ${value.toFixed(1)} g`;
              },
            },
          },
        },
      },
    });

    return () => {
      chart.destroy();
    };
  }, [stats.byMaterial]);

  useEffect(() => {
    const canvas = barCanvasRef.current;
    if (!canvas || stats.byUser.length === 0) return;

    const topUsers = stats.byUser.slice(0, 10);

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: topUsers.map((u) => u.person),
        datasets: [
          {
            label: 'Consumo (g)',
            data: topUsers.map((u) => u.grams),
            backgroundColor: '#086BFF',
            borderRadius: 6,
            maxBarThickness: 36,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 150,
        },
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              color: '#E2ECF7',
            },
            ticks: {
              color: '#475569',
              font: {
                family: "'JetBrains Mono', monospace",
                size: 11,
              },
              callback: (val) => `${val}g`,
            },
          },
          y: {
            grid: {
              display: false,
            },
            ticks: {
              color: '#0F172A',
              font: {
                family: "'Plus Jakarta Sans', sans-serif",
                size: 12,
              },
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: '#0F172A',
            titleColor: '#F8FAFC',
            bodyColor: '#E2E8F0',
            callbacks: {
              label: (ctx) => ` ${Number(ctx.parsed.x ?? 0).toFixed(1)} g`,
            },
          },
        },
      },
    });

    return () => {
      chart.destroy();
    };
  }, [stats.byUser]);

  const handleOpenEmailModal = () => {
    setSendFeedback(null);
    setIsEmailModalOpen(true);
  };

  const handleSendReport = async () => {
    const trimmedEmail = recipientEmail.trim();
    if (!isValidEmail(trimmedEmail)) {
      setSendFeedback({
        type: 'error',
        message: 'Informe um endereço de e-mail destinatário válido.',
      });
      return;
    }

    setIsSendingReport(true);
    setSendFeedback(null);

    try {
      const response = await fetch('/api/reports/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: trimmedEmail,
          periodLabel,
          totalGrams: stats.totalGrams,
          totalPrints: stats.totalPrints,
          byMaterial: stats.byMaterial,
          byUser: stats.byUser,
          byMachine: stats.byMachine,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; error?: string }
        | null;

      if (!response.ok || !data?.ok) {
        setSendFeedback({
          type: 'error',
          message:
            data?.error ||
            'Não foi possível enviar o relatório neste momento. Verifique as variáveis SMTP do servidor.',
        });
        return;
      }

      setSendFeedback({
        type: 'success',
        message:
          data.message ||
          `Relatório (${periodLabel}) enviado com sucesso para ${trimmedEmail}.`,
      });
    } catch {
      setSendFeedback({
        type: 'error',
        message: 'Falha de comunicação com o servidor do aplicativo ao enviar o relatório.',
      });
    } finally {
      setIsSendingReport(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    setSendFeedback(null);
    try {
      const response = await fetch('/api/reports/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: recipientEmail.trim() || 'relatorio@samsungocean.local',
          periodLabel,
          totalGrams: stats.totalGrams,
          totalPrints: stats.totalPrints,
          byMaterial: stats.byMaterial,
          byUser: stats.byUser,
          byMachine: stats.byMachine,
        }),
      });
      if (!response.ok) {
        setSendFeedback({
          type: 'error',
          message: 'Não foi possível gerar a prévia em PDF neste momento.',
        });
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-samsung-ocean-3d-${selectedMonth === 'ALL' ? 'geral' : selectedMonth}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setSendFeedback({
        type: 'error',
        message: 'Falha ao transferir o PDF do servidor.',
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#D8E8FA] bg-white p-6">
        <div className="mb-4">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8E8FA] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#086BFF] hover:text-[#086BFF] whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Voltar ao Início</span>
          </button>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl [text-wrap:balance]">
              Dashboard de Consumo
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Distribuição de materiais e ranking de consumo por utilizador no Samsung Ocean.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:w-56">
              <label
                htmlFor="dashboard-month-filter"
                className="mb-1.5 block text-xs font-semibold text-slate-600"
              >
                Filtrar por Mês
              </label>
              <select
                id="dashboard-month-filter"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full rounded-lg border border-[#D8E8FA] bg-[#F7FBFF] px-3.5 py-2 text-sm text-slate-900 focus:border-[#086BFF] focus:bg-white focus:outline-none"
              >
                <option value="ALL">Todos os meses</option>
                {stats.availableMonths.map((monthKey) => (
                  <option key={monthKey} value={monthKey}>
                    {formatMonthLabel(monthKey)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleOpenEmailModal}
              data-testid="open-email-report-btn"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#086BFF] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0553CC] whitespace-nowrap shrink-0"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              <span>Enviar Relatório por E-mail</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#D8E8FA] bg-white p-5">
          <span className="text-xs font-medium text-slate-500">Consumo Total</span>
          <p className="font-mono-tabular mt-2 text-2xl font-bold text-[#086BFF]">
            {stats.totalGrams.toFixed(1)} g
          </p>
          <span className="font-mono-tabular mt-1 block text-xs text-slate-500">
            {(stats.totalGrams / 1000).toFixed(2)} kg acumulados
          </span>
        </div>

        <div className="rounded-2xl border border-[#D8E8FA] bg-white p-5">
          <span className="text-xs font-medium text-slate-500">Impressões Registadas</span>
          <p className="font-mono-tabular mt-2 text-2xl font-bold text-slate-900">
            {stats.totalPrints}
          </p>
          <span className="mt-1 block text-xs text-slate-500">
            {selectedMonth === 'ALL' ? 'Todo o período' : formatMonthLabel(selectedMonth)}
          </span>
        </div>

        <div className="rounded-2xl border border-[#D8E8FA] bg-white p-5">
          <span className="text-xs font-medium text-slate-500">Material Mais Usado</span>
          <p className="mt-2 truncate text-2xl font-bold text-slate-900">
            {stats.topMaterial ? stats.topMaterial.name : '—'}
          </p>
          <span className="font-mono-tabular mt-1 block text-xs text-[#086BFF]">
            {stats.topMaterial ? `${stats.topMaterial.grams.toFixed(1)} g` : 'Sem dados'}
          </span>
        </div>

        <div className="rounded-2xl border border-[#D8E8FA] bg-white p-5">
          <span className="text-xs font-medium text-slate-500">Maior Utilizador</span>
          <p className="mt-2 truncate text-2xl font-bold text-slate-900">
            {stats.topUser ? stats.topUser.name : '—'}
          </p>
          <span className="font-mono-tabular mt-1 block text-xs text-[#086BFF]">
            {stats.topUser ? `${stats.topUser.grams.toFixed(1)} g` : 'Sem dados'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#D8E8FA] bg-white p-6">
          <div className="mb-4 border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">
              Materiais Mais Consumidos (gramas)
            </h2>
          </div>

          {stats.byMaterial.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">
              Nenhum dado de material disponível para o período selecionado.
            </p>
          ) : (
            <div className="relative h-72 w-full">
              <canvas
                ref={pieCanvasRef}
                data-testid="chart-materials"
                aria-label="Gráfico de pizza de materiais mais consumidos em gramas"
              />
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#D8E8FA] bg-white p-6">
          <div className="mb-4 border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">
              Utilizadores que Mais Gastaram (Top 10)
            </h2>
          </div>

          {stats.byUser.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">
              Nenhum dado de utilizador disponível para o período selecionado.
            </p>
          ) : (
            <div className="relative h-72 w-full">
              <canvas
                ref={barCanvasRef}
                data-testid="chart-users"
                aria-label="Gráfico de barras dos utilizadores que mais gastaram"
              />
            </div>
          )}
        </section>
      </div>

      {isEmailModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          onClick={() => setIsEmailModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-report-modal-title"
            className="w-full max-w-lg rounded-2xl border border-[#D8E8FA] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2
                  id="email-report-modal-title"
                  className="text-lg font-bold text-slate-900"
                >
                  Enviar Relatório do Dashboard
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Dispare o resumo do período com gráficos em PDF (estilo Power BI) em anexo.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                aria-label="Fechar janela de envio de relatório"
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#086BFF] hover:text-[#086BFF]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#D8E8FA] bg-[#F7FBFF] p-3.5 sm:grid-cols-3">
                <div className="col-span-2 sm:col-span-1">
                  <span className="block text-[11px] font-medium text-slate-500">Período</span>
                  <span className="mt-0.5 block text-xs font-bold text-slate-900">
                    {periodLabel}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-slate-500">Consumo</span>
                  <span className="font-mono-tabular mt-0.5 block text-xs font-bold text-[#086BFF]">
                    {stats.totalGrams.toFixed(1)} g
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-slate-500">Impressões</span>
                  <span className="font-mono-tabular mt-0.5 block text-xs font-bold text-slate-900">
                    {stats.totalPrints}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-[#D8E8FA] bg-[#ECFCFF]/50 p-3 text-xs text-slate-700">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[#086BFF]" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-slate-900">
                    Agendamento automático mensal ativo no backend
                  </p>
                  <p className="mt-0.5 text-slate-600">
                    Todo dia 1 de cada mês às 08:00, o servidor envia automaticamente o resumo do mês anterior.
                  </p>
                </div>
              </div>

              {serverStatus && !serverStatus.smtpConfigured && !sendFeedback && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  SMTP ainda não configurado no servidor. Defina <code className="font-mono">SMTP_USER</code> e{' '}
                  <code className="font-mono">SMTP_APP_PASSWORD</code> nas variáveis de ambiente para habilitar envios reais pelo Gmail.
                </div>
              )}

              <div>
                <label
                  htmlFor="report-recipient-email"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  E-mail destinatário
                </label>
                <input
                  id="report-recipient-email"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="responsavel@laboratorio.com"
                  className="w-full rounded-lg border border-[#D8E8FA] bg-[#F7FBFF] px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#086BFF] focus:bg-white focus:outline-none"
                />
              </div>

              {sendFeedback && (
                <div
                  role="status"
                  data-testid="email-report-feedback"
                  className={`flex items-start gap-2 rounded-xl border p-3 text-xs font-medium ${
                    sendFeedback.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-rose-200 bg-rose-50 text-rose-800'
                  }`}
                >
                  {sendFeedback.type === 'success' && (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{sendFeedback.message}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf || isSendingReport}
                data-testid="download-pdf-report-btn"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#BFEAFF] bg-[#ECFCFF] px-3.5 py-2 text-sm font-semibold text-[#086BFF] transition-colors hover:bg-[#DDF5FF] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <FileDown className="h-4 w-4" aria-hidden="true" />
                <span>{isDownloadingPdf ? 'A gerar PDF...' : 'Baixar PDF (Power BI)'}</span>
              </button>

              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleSendReport}
                  disabled={isSendingReport}
                  data-testid="confirm-send-report-btn"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#086BFF] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0553CC] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  <span>{isSendingReport ? 'Enviando...' : 'Confirmar Envio'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
