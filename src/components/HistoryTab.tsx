import { useMemo, useState } from 'react';
import { ArrowLeft, Search, Trash2 } from 'lucide-react';
import { PRINTERS, formatTimestampPt, type PrintLogRecord } from '../lib/filamentLogic';

interface HistoryTabProps {
  logs: PrintLogRecord[];
  loading: boolean;
  onDeleteLog: (logId: string) => Promise<void>;
  onGoToRegister: () => void;
  onBackHome: () => void;
}

export function HistoryTab({
  logs,
  loading,
  onDeleteLog,
  onGoToRegister,
  onBackHome,
}: HistoryTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [machineFilter, setMachineFilter] = useState('ALL');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    const queryText = searchTerm.trim().toLowerCase();
    return logs.filter((log) => {
      if (machineFilter !== 'ALL' && log.machine !== machineFilter) {
        return false;
      }
      if (!queryText) return true;
      return (
        log.project.toLowerCase().includes(queryText) ||
        log.person.toLowerCase().includes(queryText) ||
        log.material.toLowerCase().includes(queryText) ||
        log.color.toLowerCase().includes(queryText) ||
        log.machine.toLowerCase().includes(queryText)
      );
    });
  }, [logs, searchTerm, machineFilter]);

  const totalFilteredGrams = useMemo(
    () => filteredLogs.reduce((acc, item) => acc + item.grams, 0),
    [filteredLogs]
  );

  const totalFilteredHours = useMemo(() => {
    const seenBatches = new Set<string>();
    let total = 0;
    for (const item of filteredLogs) {
      const key = item.batchId || item.id;
      if (!seenBatches.has(key)) {
        seenBatches.add(key);
        if (Number.isFinite(item.durationHours) && item.durationHours > 0) {
          total += item.durationHours;
        }
      }
    }
    return Math.round(total * 10) / 10;
  }, [filteredLogs]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteLog(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[#D8E8FA] bg-white p-6 sm:p-8">
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

      <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl [text-wrap:balance]">
            Histórico de Impressões
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <span className="font-mono-tabular font-medium text-[#086BFF]">
              {filteredLogs.length} registos
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{totalFilteredGrams.toFixed(1)} g totais</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{totalFilteredHours.toFixed(1)} h totais</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <label htmlFor="history-search" className="sr-only">
              Pesquisar histórico
            </label>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="history-search"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar projeto, pessoa ou cor..."
              className="w-full rounded-lg border border-[#D8E8FA] bg-[#F7FBFF] py-2 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#086BFF] focus:bg-white focus:outline-none sm:w-64"
            />
          </div>

          <div>
            <label htmlFor="history-machine-filter" className="sr-only">
              Filtrar por máquina
            </label>
            <select
              id="history-machine-filter"
              value={machineFilter}
              onChange={(e) => setMachineFilter(e.target.value)}
              className="w-full rounded-lg border border-[#D8E8FA] bg-[#F7FBFF] px-3 py-2 text-sm text-slate-900 focus:border-[#086BFF] focus:bg-white focus:outline-none sm:w-52"
            >
              <option value="ALL">Todas as máquinas</option>
              {PRINTERS.map((printer) => (
                <option key={printer} value={printer}>
                  {printer}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 py-6" aria-label="Carregando histórico">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-11 rounded-lg bg-[#F0F7FF]" />
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-slate-500">
            {logs.length === 0
              ? 'Ainda não existem impressões registadas.'
              : 'Nenhum registo corresponde aos filtros atuais.'}
          </p>
          {logs.length === 0 && (
            <button
              type="button"
              onClick={onGoToRegister}
              className="mt-4 rounded-xl bg-[#086BFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B7CFF] whitespace-nowrap shrink-0"
            >
              Registar Primeira Impressão
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th scope="col" className="py-3 pr-4">
                  Data/Hora
                </th>
                <th scope="col" className="py-3 pr-4">
                  Máquina
                </th>
                <th scope="col" className="py-3 pr-4">
                  Pessoa
                </th>
                <th scope="col" className="py-3 pr-4">
                  Projeto
                </th>
                <th scope="col" className="py-3 pr-4">
                  Material
                </th>
                <th scope="col" className="py-3 pr-4">
                  Cor
                </th>
                <th scope="col" className="py-3 pr-4 text-right">
                  Gramas
                </th>
                <th scope="col" className="py-3 pr-4 text-right">
                  Duração
                </th>
                <th scope="col" className="py-3 text-right">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="transition-colors hover:bg-[#F7FBFF]">
                  <td className="font-mono-tabular py-3 pr-4 text-xs text-slate-500 whitespace-nowrap">
                    {formatTimestampPt(log.createdAtMs)}
                  </td>
                  <td className="py-3 pr-4 font-medium text-slate-900 whitespace-nowrap">
                    {log.machine}
                  </td>
                  <td className="py-3 pr-4 text-slate-700 whitespace-nowrap">{log.person}</td>
                  <td className="py-3 pr-4 text-slate-900">
                    <span className="block max-w-[240px] truncate" title={log.project}>
                      {log.project}
                    </span>
                    {log.isMultiColor && (
                      <span className="text-[11px] font-medium text-[#086BFF]">AMS/CFS</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 font-semibold text-slate-800 whitespace-nowrap">
                    {log.material}
                  </td>
                  <td className="py-3 pr-4 text-slate-600">{log.color}</td>
                  <td className="font-mono-tabular py-3 pr-4 text-right font-bold text-[#086BFF] whitespace-nowrap">
                    {log.grams.toFixed(1)} g
                  </td>
                  <td className="font-mono-tabular py-3 pr-4 text-right text-slate-700 whitespace-nowrap">
                    {log.durationHours > 0 ? `${log.durationHours.toFixed(1)} h` : '—'}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      disabled={deletingId === log.id}
                      onClick={() => void handleDelete(log.id)}
                      aria-label={`Excluir registo '${log.project}'`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
