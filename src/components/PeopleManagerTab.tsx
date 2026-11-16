import { useState, type FormEvent } from 'react';
import { ArrowLeft, RotateCcw, Trash2, UserPlus } from 'lucide-react';
import { DEFAULT_PEOPLE, type PersonRecord } from '../lib/filamentLogic';

interface PeopleManagerTabProps {
  people: PersonRecord[];
  onAddPerson: (name: string) => Promise<{ ok: boolean; error?: string }>;
  onRemovePerson: (personId: string) => Promise<void>;
  onRestoreDefaults: () => Promise<void>;
  onBackHome: () => void;
}

export function PeopleManagerTab({
  people,
  onAddPerson,
  onRemovePerson,
  onRestoreDefaults,
  onBackHome,
}: PeopleManagerTabProps) {
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await onAddPerson(newName);
      if (!result.ok) {
        setError(result.error ?? 'Erro ao adicionar pessoa.');
        return;
      }
      setNewName('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8E8FA] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#086BFF] hover:text-[#086BFF] whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Voltar ao Início</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="lg:col-span-5">
          <div className="rounded-2xl border border-[#D8E8FA] bg-white p-6">
            <div className="border-b border-slate-100 pb-4">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                Gerir Pessoas
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Adicione ou remova utilizadores. As alterações refletem imediatamente na seleção de pessoas.
              </p>
            </div>

            <form onSubmit={handleAdd} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="new-person-input"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
                  Nome do Utilizador
                </label>
                <input
                  id="new-person-input"
                  type="text"
                  maxLength={80}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex.: Mariana Silva"
                  className="w-full rounded-lg border border-[#D8E8FA] bg-[#F7FBFF] px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#086BFF] focus:bg-white focus:outline-none"
                />
              </div>

              {error && (
                <p role="alert" className="text-xs font-medium text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#086BFF] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0B7CFF] disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                <span>Adicionar Pessoa</span>
              </button>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => void onRestoreDefaults()}
                className="inline-flex items-center gap-2 rounded-lg border border-[#BFEAFF] bg-[#ECFCFF] px-3.5 py-2 text-xs font-semibold text-[#086BFF] transition-colors hover:bg-[#DDF5FF] whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Restaurar Lista Padrão ({DEFAULT_PEOPLE.length})</span>
              </button>
            </div>
          </div>
        </section>

        <section className="lg:col-span-7">
          <div className="rounded-2xl border border-[#D8E8FA] bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900">Utilizadores Ativos</h2>
              <span className="font-mono-tabular text-xs font-medium text-[#086BFF]">
                {people.length} cadastrados
              </span>
            </div>

            {people.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                Nenhuma pessoa cadastrada no laboratório.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {people.map((person) => (
                  <li
                    key={person.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-4 last:pb-0"
                  >
                    <span className="text-sm font-medium text-slate-800">{person.name}</span>
                    <button
                      type="button"
                      onClick={() => void onRemovePerson(person.id)}
                      aria-label={`Remover '${person.name}'`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Remover</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
