import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Layers,
  Palette,
  Plus,
  Printer,
  Search,
  Trash2,
  User,
} from 'lucide-react';
import {
  MATERIALS,
  PRINTERS,
  PRINTER_META,
  getColorsForMaterial,
  validatePrintSubmission,
  type FilamentLineInput,
  type MaterialType,
  type PersonRecord,
} from '../lib/filamentLogic';
import type { NewPrintPayload } from '../hooks/useLabData';

interface PrintWizardProps {
  people: PersonRecord[];
  onSubmitPrint: (payload: NewPrintPayload) => Promise<void>;
  onBackHome: () => void;
  onOpenHistory: () => void;
}

type WizardStep = 1 | 2 | 3 | 4 | 'success';

function createLine(material: MaterialType = 'PLA'): FilamentLineInput {
  const colors = getColorsForMaterial(material);
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    material,
    color: colors[0] ?? '',
    grams: '',
  };
}

const STEP_LABELS = [
  { step: 1, label: 'Máquina' },
  { step: 2, label: 'Pessoa' },
  { step: 3, label: 'Projeto e AMS/CFS' },
  { step: 4, label: 'Material e Gramas' },
] as const;

export function PrintWizard({
  people,
  onSubmitPrint,
  onBackHome,
  onOpenHistory,
}: PrintWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [machine, setMachine] = useState<string>('');
  const [person, setPerson] = useState<string>('');
  const [personSearch, setPersonSearch] = useState<string>('');
  const [project, setProject] = useState<string>('');
  const [durationHours, setDurationHours] = useState<string>('');
  const [isMultiColor, setIsMultiColor] = useState<boolean>(false);
  const [lines, setLines] = useState<FilamentLineInput[]>(() => [createLine('PLA')]);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [lastSavedSummary, setLastSavedSummary] = useState<{
    project: string;
    machine: string;
    person: string;
    totalGrams: number;
    durationHours: number;
  } | null>(null);

  useEffect(() => {
    if (person && people.length > 0 && !people.some((p) => p.name === person)) {
      setPerson('');
    }
  }, [people, person]);

  const filteredPeople = useMemo(() => {
    const q = personSearch.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.name.toLowerCase().includes(q));
  }, [people, personSearch]);

  const isResinMachine = (name: string) =>
    name === 'Halot-Mage Pro 8K' || name === 'Creality LD-006';

  const handleSelectMachine = (selectedMachine: string) => {
    setMachine(selectedMachine);
    setErrors([]);
    if (isResinMachine(selectedMachine)) {
      setLines([createLine('Resina')]);
    } else if (lines[0]?.material === 'Resina') {
      setLines([createLine('PLA')]);
    }
    setStep(2);
  };

  const handleSelectPerson = (selectedPerson: string) => {
    setPerson(selectedPerson);
    setErrors([]);
    setStep(3);
  };

  const handleSelectColorMode = (multi: boolean) => {
    setIsMultiColor(multi);
    if (multi) {
      setLines((prev) => (prev.length >= 2 ? prev : [...prev, createLine('PLA')]));
    } else {
      const defaultMat: MaterialType = isResinMachine(machine) ? 'Resina' : 'PLA';
      setLines((prev) => [prev[0] ?? createLine(defaultMat)]);
    }
  };

  const handleContinueFromStep3 = (e: FormEvent) => {
    e.preventDefault();
    const stepErrors: string[] = [];
    const trimmed = project.trim();
    if (!trimmed) {
      stepErrors.push('Informe o nome do projeto antes de avançar.');
    } else if (trimmed.length > 120) {
      stepErrors.push('O nome do projeto deve ter no máximo 120 caracteres.');
    }

    const hoursVal = Number(durationHours);
    if (!Number.isFinite(hoursVal) || hoursVal <= 0) {
      stepErrors.push('Informe a duração estimada em horas (> 0).');
    } else if (hoursVal > 500) {
      stepErrors.push('A duração máxima por impressão é de 500 horas.');
    }

    if (stepErrors.length > 0) {
      setErrors(stepErrors);
      return;
    }

    setErrors([]);
    setStep(4);
  };

  const handleLineMaterialChange = (lineId: string, newMaterial: MaterialType) => {
    const validColors = getColorsForMaterial(newMaterial);
    setLines((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              material: newMaterial,
              color: validColors[0] ?? '',
            }
          : line
      )
    );
  };

  const handleLineColorChange = (lineId: string, newColor: string) => {
    setLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, color: newColor } : line))
    );
  };

  const handleLineGramsChange = (lineId: string, newGrams: string) => {
    setLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, grams: newGrams } : line))
    );
  };

  const handleAddLine = () => {
    setLines((prev) => [...prev, createLine('PLA')]);
  };

  const handleRemoveLine = (lineId: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== lineId) : prev));
  };

  const totalGramsPreview = lines.reduce((acc, l) => {
    const val = Number(l.grams);
    return Number.isFinite(val) && val > 0 ? acc + val : acc;
  }, 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const validation = validatePrintSubmission(
      {
        machine,
        person,
        project,
        durationHours,
        isMultiColor,
        lines,
      },
      people.map((p) => p.name)
    );

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors([]);
    setSubmitting(true);
    try {
      await onSubmitPrint({
        machine,
        person,
        project,
        durationHours: validation.parsedDurationHours,
        isMultiColor,
        lines: validation.parsedLines,
      });

      const totalSaved = validation.parsedLines.reduce((sum, l) => sum + l.grams, 0);
      setLastSavedSummary({
        project: project.trim(),
        machine,
        person,
        totalGrams: totalSaved,
        durationHours: validation.parsedDurationHours,
      });

      // Reset form fields for next print
      setMachine('');
      setPerson('');
      setPersonSearch('');
      setProject('');
      setDurationHours('');
      setIsMultiColor(false);
      setLines([createLine('PLA')]);
      setStep('success');
    } catch {
      setErrors(['Ocorreu um erro ao salvar no banco de dados. Tente novamente.']);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartNewPrint = () => {
    setErrors([]);
    setStep(1);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {step !== 'success' && (
        <div className="rounded-2xl border border-[#D8E8FA] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => {
                setErrors([]);
                if (step === 1) {
                  onBackHome();
                } else {
                  setStep((prev) => (typeof prev === 'number' && prev > 1 ? ((prev - 1) as WizardStep) : 1));
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8E8FA] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#086BFF] hover:text-[#086BFF] whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{step === 1 ? 'Voltar ao Início' : 'Passo Anterior'}</span>
            </button>

            <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Progresso do cadastro">
              {STEP_LABELS.map((item, idx) => {
                const isCurrent = step === item.step;
                const isDone = typeof step === 'number' && step > item.step;
                return (
                  <li key={item.step} className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 font-medium ${
                        isCurrent
                          ? 'text-[#086BFF]'
                          : isDone
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      <span
                        className={`font-mono-tabular flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-semibold ${
                          isCurrent
                            ? 'bg-[#086BFF] text-white'
                            : isDone
                            ? 'bg-[#BFEAFF] text-[#086BFF]'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {item.step}
                      </span>
                      <span className="hidden sm:inline">{item.label}</span>
                    </span>
                    {idx < STEP_LABELS.length - 1 && (
                      <span className="text-slate-300" aria-hidden="true">/</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <ul className="list-disc space-y-1 pl-4">
            {errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* PASSO 1: ESCOLHER A MÁQUINA (8 BOXES) */}
      {step === 1 && (
        <section className="rounded-2xl border border-[#D8E8FA] bg-white p-6 sm:p-8">
          <div className="mb-6 border-b border-slate-100 pb-4">
            <p className="text-xs font-semibold tracking-wider text-[#086BFF] uppercase">
              Etapa 1 de 4
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
              Escolha a Impressora 3D
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Toque ou clique na máquina onde a impressão será executada.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PRINTERS.map((printerName) => {
              const meta = PRINTER_META[printerName];
              const isSelected = machine === printerName;
              return (
                <button
                  key={printerName}
                  type="button"
                  onClick={() => handleSelectMachine(printerName)}
                  className={`group flex flex-col justify-between rounded-xl border p-5 text-left transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#086BFF] ${
                    isSelected
                      ? 'border-[#086BFF] bg-[#ECFCFF] ring-2 ring-[#086BFF]/20'
                      : 'border-[#D8E8FA] bg-white hover:border-[#086BFF] hover:bg-[#F7FBFF] hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-[#086BFF] text-white'
                          : 'bg-[#ECFCFF] text-[#086BFF] group-hover:bg-[#086BFF] group-hover:text-white'
                      }`}
                    >
                      <Printer className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <ArrowRight
                      className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#086BFF]"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-4">
                    <span className="block text-sm font-bold text-slate-900">
                      {printerName}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {meta.brand} · {meta.tech}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* PASSO 2: ESCOLHER A PESSOA */}
      {step === 2 && (
        <section className="rounded-2xl border border-[#D8E8FA] bg-white p-6 sm:p-8">
          <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#086BFF]">
                <span className="font-semibold uppercase tracking-wider">Etapa 2 de 4</span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-slate-600">Máquina: {machine}</span>
              </div>
              <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
                Quem está a imprimir?
              </h1>
            </div>

            <div className="relative sm:w-64">
              <label htmlFor="wizard-person-search" className="sr-only">
                Filtrar pessoa
              </label>
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="wizard-person-search"
                type="search"
                value={personSearch}
                onChange={(e) => setPersonSearch(e.target.value)}
                placeholder="Buscar pessoa..."
                className="w-full rounded-lg border border-[#D8E8FA] bg-[#F7FBFF] py-2 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#086BFF] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {filteredPeople.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Nenhuma pessoa encontrada com esse nome.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPeople.map((p) => {
                const isSelected = person === p.name;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPerson(p.name)}
                    className={`group flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#086BFF] ${
                      isSelected
                        ? 'border-[#086BFF] bg-[#ECFCFF] ring-2 ring-[#086BFF]/20'
                        : 'border-[#D8E8FA] bg-white hover:border-[#086BFF] hover:bg-[#F7FBFF]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          isSelected
                            ? 'bg-[#086BFF] text-white'
                            : 'bg-[#ECFCFF] text-[#086BFF] group-hover:bg-[#086BFF] group-hover:text-white'
                        }`}
                      >
                        <User className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {p.name}
                      </span>
                    </div>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#086BFF]"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* PASSO 3: PROJETO E MÚLTIPLAS CORES (AMS/CFS) */}
      {step === 3 && (
        <section className="rounded-2xl border border-[#D8E8FA] bg-white p-6 sm:p-8">
          <div className="mb-6 border-b border-slate-100 pb-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold tracking-wider text-[#086BFF] uppercase">
                Etapa 3 de 4
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-600">{machine}</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-600">{person}</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
              Projeto e Modo de Cores (AMS/CFS)
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Identifique o nome do projeto e escolha se a impressão usa apenas 1 cor ou múltiplas cores.
            </p>
          </div>

          <form onSubmit={handleContinueFromStep3} noValidate className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-8">
                <label
                  htmlFor="wizard-project-input"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
                  Nome do Projeto
                </label>
                <input
                  id="wizard-project-input"
                  type="text"
                  maxLength={120}
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  placeholder="Ex.: Suporte Câmera v2"
                  className="w-full rounded-xl border border-[#D8E8FA] bg-[#F7FBFF] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#086BFF] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="sm:col-span-4">
                <label
                  htmlFor="wizard-duration-input"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
                  Duração Estimada (horas)
                </label>
                <input
                  id="wizard-duration-input"
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  max="500"
                  step="0.1"
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  placeholder="Ex.: 2.5"
                  className="font-mono-tabular w-full rounded-xl border border-[#D8E8FA] bg-[#F7FBFF] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#086BFF] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <span className="mb-3 block text-sm font-semibold text-slate-800">
                Múltiplas Cores (AMS / CFS)?
              </span>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" role="group" aria-label="Múltiplas Cores (AMS/CFS)">
                <button
                  type="button"
                  aria-pressed={!isMultiColor}
                  onClick={() => handleSelectColorMode(false)}
                  className={`flex items-start gap-4 rounded-xl border p-5 text-left transition-all ${
                    !isMultiColor
                      ? 'border-[#086BFF] bg-[#ECFCFF] ring-2 ring-[#086BFF]/20'
                      : 'border-[#D8E8FA] bg-white hover:border-[#086BFF] hover:bg-[#F7FBFF]'
                  }`}
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                      !isMultiColor ? 'bg-[#086BFF] text-white' : 'bg-[#ECFCFF] text-[#086BFF]'
                    }`}
                  >
                    <Palette className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-slate-900">
                      Não — Cor Única
                    </span>
                    <span className="mt-1 block text-xs text-slate-600">
                      Impressão padrão utilizando apenas um material e uma cor.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  aria-pressed={isMultiColor}
                  onClick={() => handleSelectColorMode(true)}
                  className={`flex items-start gap-4 rounded-xl border p-5 text-left transition-all ${
                    isMultiColor
                      ? 'border-[#086BFF] bg-[#ECFCFF] ring-2 ring-[#086BFF]/20'
                      : 'border-[#D8E8FA] bg-white hover:border-[#086BFF] hover:bg-[#F7FBFF]'
                  }`}
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                      isMultiColor ? 'bg-[#086BFF] text-white' : 'bg-[#ECFCFF] text-[#086BFF]'
                    }`}
                  >
                    <Layers className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-slate-900">
                      Sim — Múltiplas Cores (AMS/CFS)
                    </span>
                    <span className="mt-1 block text-xs text-slate-600">
                      Adicione várias linhas de material, cor e gramas para trocas automáticas.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-5">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#086BFF] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B7CFF] sm:w-auto whitespace-nowrap shrink-0"
              >
                <span>Continuar para Materiais</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>
      )}

      {/* PASSO 4: MATERIAL, COR (EM CASCATA) E GRAMAS */}
      {step === 4 && (
        <section className="rounded-2xl border border-[#D8E8FA] bg-white p-6 sm:p-8">
          <div className="mb-6 border-b border-slate-100 pb-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold tracking-wider text-[#086BFF] uppercase">
                Etapa 4 de 4
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-600">{machine}</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-600">{person}</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-800">{project}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular font-semibold text-[#086BFF]">
                {Number(durationHours || 0).toFixed(1)} h
              </span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
              {isMultiColor ? 'Materiais e Cores (AMS/CFS)' : 'Material, Cor e Gramas'}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              A lista de cores é filtrada automaticamente de acordo com o material selecionado.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {lines.map((line, index) => {
              const availableColors = getColorsForMaterial(line.material);
              return (
                <div
                  key={line.id}
                  className="grid grid-cols-1 gap-4 rounded-xl border border-[#D8E8FA] bg-[#F7FBFF] p-4 sm:grid-cols-12 sm:items-end"
                >
                  <div className="sm:col-span-4">
                    <label
                      htmlFor={`material-${line.id}`}
                      className="mb-1.5 block text-xs font-semibold text-slate-700"
                    >
                      {isMultiColor ? `Material (Cor ${index + 1})` : 'Material'}
                    </label>
                    <select
                      id={`material-${line.id}`}
                      value={line.material}
                      onChange={(e) =>
                        handleLineMaterialChange(line.id, e.target.value as MaterialType)
                      }
                      className="w-full rounded-lg border border-[#D8E8FA] bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#086BFF] focus:outline-none"
                    >
                      {MATERIALS.map((mat) => (
                        <option key={mat} value={mat}>
                          {mat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-5">
                    <label
                      htmlFor={`color-${line.id}`}
                      className="mb-1.5 block text-xs font-semibold text-slate-700"
                    >
                      Cor
                    </label>
                    <select
                      id={`color-${line.id}`}
                      value={line.color}
                      onChange={(e) => handleLineColorChange(line.id, e.target.value)}
                      className="w-full rounded-lg border border-[#D8E8FA] bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#086BFF] focus:outline-none"
                    >
                      {availableColors.map((colorName) => (
                        <option key={colorName} value={colorName}>
                          {colorName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={isMultiColor ? 'sm:col-span-2' : 'sm:col-span-3'}>
                    <label
                      htmlFor={`grams-${line.id}`}
                      className="mb-1.5 block text-xs font-semibold text-slate-700"
                    >
                      Gramas (g)
                    </label>
                    <input
                      id={`grams-${line.id}`}
                      type="number"
                      inputMode="decimal"
                      min="0.1"
                      max="50000"
                      step="0.1"
                      value={line.grams}
                      onChange={(e) => handleLineGramsChange(line.id, e.target.value)}
                      placeholder="0.0"
                      className="font-mono-tabular w-full rounded-lg border border-[#D8E8FA] bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#086BFF] focus:outline-none"
                    />
                  </div>

                  {isMultiColor && (
                    <div className="flex justify-end sm:col-span-1">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line.id)}
                        disabled={lines.length <= 1}
                        aria-label={`Remover linha de cor ${index + 1}`}
                        className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-[#D8E8FA] bg-white text-slate-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {isMultiColor && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#BFEAFF] bg-[#ECFCFF] px-4 py-2 text-xs font-semibold text-[#086BFF] transition-colors hover:bg-[#DDF5FF] whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Adicionar Cor</span>
                </button>

                <span className="font-mono-tabular text-xs text-slate-600">
                  Total combinado:{' '}
                  <strong className="text-[#086BFF]">{totalGramsPreview.toFixed(1)} g</strong>
                </span>
              </div>
            )}

            <div className="flex justify-end border-t border-slate-100 pt-5">
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#086BFF] px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B7CFF] disabled:opacity-60 sm:w-auto whitespace-nowrap shrink-0"
              >
                {submitting ? 'A guardar...' : 'Salvar Impressão'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* TELA DE SUCESSO APÓS SALVAR */}
      {step === 'success' && lastSavedSummary && (
        <section
          role="status"
          className="rounded-2xl border border-[#BFEAFF] bg-white p-8 text-center sm:p-12"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ECFCFF] text-[#086BFF]">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            Impressão Registada!
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            O consumo de{' '}
            <strong className="font-mono-tabular text-[#086BFF]">
              {lastSavedSummary.totalGrams.toFixed(1)} g
            </strong>{' '}
            em{' '}
            <strong className="font-mono-tabular text-slate-900">
              {lastSavedSummary.durationHours.toFixed(1)} h
            </strong>{' '}
            para o projeto <strong>{lastSavedSummary.project}</strong> na máquina{' '}
            <strong>{lastSavedSummary.machine}</strong> ({lastSavedSummary.person}) foi guardado com sucesso.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleStartNewPrint}
              className="rounded-xl bg-[#086BFF] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0B7CFF] whitespace-nowrap shrink-0"
            >
              Nova Impressão
            </button>
            <button
              type="button"
              onClick={onOpenHistory}
              className="rounded-xl border border-[#BFEAFF] bg-[#ECFCFF] px-5 py-2.5 text-sm font-semibold text-[#086BFF] transition-colors hover:bg-[#DDF5FF] whitespace-nowrap shrink-0"
            >
              Ver Histórico
            </button>
            <button
              type="button"
              onClick={onBackHome}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Voltar ao Início
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
