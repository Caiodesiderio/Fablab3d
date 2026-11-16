export const PRINTERS = [
  'Bambu H2D',
  'Bambu P2S',
  'Bambu X2D',
  'Bambu A1 Mini',
  'Creality K1 Max 01',
  'Creality K1 Max 02',
  'Creality K1 Max 03',
  'Halot-Mage Pro 8K',
  'Creality LD-006',
] as const;

export type PrinterName = (typeof PRINTERS)[number];

export const PRINTER_META: Record<PrinterName, { brand: string; tech: string }> = {
  'Bambu H2D': { brand: 'Bambu Lab', tech: 'FDM · Dupla Extrusão' },
  'Bambu P2S': { brand: 'Estephany', tech: 'Bambu Lab · FDM' },
  'Bambu X2D': { brand: 'Fernanda', tech: 'Bambu Lab · FDM' },
  'Bambu A1 Mini': { brand: 'Jessica', tech: 'Bambu Lab · FDM' },
  'Creality K1 Max 01': { brand: 'Agatha', tech: 'Creality Klipper · FDM' },
  'Creality K1 Max 02': { brand: 'Bianca', tech: 'Creality Klipper · FDM' },
  'Creality K1 Max 03': { brand: 'Carla', tech: 'Creality Klipper · FDM' },
  'Halot-Mage Pro 8K': { brand: 'Creality Resina', tech: 'MSLA · Resina 8K' },
  'Creality LD-006': { brand: 'Creality Resina', tech: 'MSLA · Resina' },
};

export const DEFAULT_PEOPLE: string[] = [
  'Alexsandro',
  'Bruna',
  'Caio',
  'Eduardo Araujo',
  'Eduardo Barbosa',
  'Evellyn',
  'Seis e Meia',
  'Felipe',
  'Gustavo',
  'Kimura',
  'Kevin',
  'Kirizawa',
  'Medeiros',
  'Natália Barros',
  'Raysson',
  'Ana Sarah',
  'Vilker',
  'Satoki',
  'Davih',
  'Luís Guilherme',
  'João Luz',
  'Claus Luca',
  'Edmundo',
];

export const FILAMENT_INVENTORY = {
  ABS: [
    'Branco Dental',
    'Cinza / Grafite',
    'Natural',
    'Preto',
    'Rosa Choque',
    'Speed Premium Azul',
    'Speed Premium Cristal',
    'Speed Premium Mármore',
    'Verde',
    'Vermelho',
  ],
  PC: ['Preto'],
  PETG: ['Laranja', 'Vermelho'],
  PLA: [
    'Amarelo',
    'Azul Claro',
    'Azul Escuro / Ciano',
    'Bege Caucasiano',
    'Branco',
    'Branco Pérola',
    'Duo Color Dourado/Ametista',
    'Duo Color Lilás/Preto',
    'Flex Preto',
    'Fosforescente',
    'Laranja',
    'Preto',
    'Rosa Bebé',
    'Roxo',
    'Silk Azul Turquesa',
    'Silk Cobre',
    'Silk Ouro',
    'Silk Pink / Rosa Choque',
    'Silk Prata Metal',
    'Speed Premium Amarelo Neon',
    'Speed Premium Laranja Neon',
    'Speed Premium Rose Gold',
    'Transparente',
    'Verde / Fluorescente',
  ],
  Resina: [
    'Pro',
    'Standard',
    'Lavável',
    'Flex',
    'Semi-Flex',
    'Calcinável',
    'Dental',
  ],
  TPU: ['Preto'],
} as const;

export type MaterialType = keyof typeof FILAMENT_INVENTORY;

export const MATERIALS = Object.keys(FILAMENT_INVENTORY) as MaterialType[];

export interface FilamentLineInput {
  id: string;
  material: MaterialType;
  color: string;
  grams: string;
}

export interface PrintSubmissionInput {
  machine: string;
  person: string;
  project: string;
  isMultiColor: boolean;
  lines: FilamentLineInput[];
}

export interface PrintLogRecord {
  id: string;
  machine: string;
  person: string;
  project: string;
  material: MaterialType;
  color: string;
  grams: number;
  isMultiColor: boolean;
  batchId: string;
  monthKey: string;
  createdAtMs: number;
}

export interface PersonRecord {
  id: string;
  name: string;
  normalizedName: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  parsedLines: Array<{
    material: MaterialType;
    color: string;
    grams: number;
  }>;
}

export function getColorsForMaterial(material: string): string[] {
  if (material in FILAMENT_INVENTORY) {
    return [...FILAMENT_INVENTORY[material as MaterialType]];
  }
  return [];
}

export function isValidMaterialColorPair(material: string, color: string): boolean {
  const colors = getColorsForMaterial(material);
  return colors.includes(color);
}

export function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function formatMonthLabel(monthKey: string): string {
  const parts = monthKey.split('-');
  if (parts.length !== 2) return monthKey;
  const year = Number(parts[0]);
  const monthIdx = Number(parts[1]) - 1;
  if (!Number.isFinite(year) || monthIdx < 0 || monthIdx > 11) return monthKey;
  return `${MONTH_NAMES_PT[monthIdx]} ${year}`;
}

export function formatTimestampPt(ms: number): string {
  const date = new Date(ms);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export function sanitizeDocId(raw: string): string {
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (normalized || 'item').slice(0, 64);
}

export function validatePrintSubmission(
  input: PrintSubmissionInput,
  availablePeople: string[]
): ValidationResult {
  const errors: string[] = [];
  const trimmedProject = input.project.trim();

  if (!PRINTERS.includes(input.machine as PrinterName)) {
    errors.push('Selecione uma impressora válida.');
  }

  if (!input.person.trim() || (availablePeople.length > 0 && !availablePeople.includes(input.person))) {
    errors.push('Selecione uma pessoa cadastrada.');
  }

  if (trimmedProject.length === 0) {
    errors.push('Informe o nome do projeto.');
  } else if (trimmedProject.length > 120) {
    errors.push('O nome do projeto deve ter no máximo 120 caracteres.');
  }

  if (input.lines.length === 0) {
    errors.push('Adicione pelo menos um filamento ou resina.');
  }

  const parsedLines: Array<{ material: MaterialType; color: string; grams: number }> = [];

  input.lines.forEach((line, index) => {
    const rowLabel = input.isMultiColor ? ` (Cor ${index + 1})` : '';
    if (!(line.material in FILAMENT_INVENTORY)) {
      errors.push(`Material inválido${rowLabel}.`);
      return;
    }
    if (!isValidMaterialColorPair(line.material, line.color)) {
      errors.push(`Cor incompatível com o material ${line.material}${rowLabel}.`);
      return;
    }
    const gramsNum = Number(line.grams);
    if (!Number.isFinite(gramsNum) || gramsNum <= 0) {
      errors.push(`Informe uma quantidade válida em gramas (> 0)${rowLabel}.`);
      return;
    }
    if (gramsNum > 50000) {
      errors.push(`Quantidade máxima por linha é 50.000g${rowLabel}.`);
      return;
    }
    parsedLines.push({
      material: line.material,
      color: line.color,
      grams: Math.round(gramsNum * 10) / 10,
    });
  });

  return {
    valid: errors.length === 0 && parsedLines.length > 0,
    errors,
    parsedLines,
  };
}

export interface DashboardStats {
  totalGrams: number;
  totalPrints: number;
  topMaterial: { name: string; grams: number } | null;
  topUser: { name: string; grams: number } | null;
  byMaterial: Array<{ material: string; grams: number }>;
  byUser: Array<{ person: string; grams: number }>;
  byMachine: Array<{ machine: string; grams: number }>;
  availableMonths: string[];
}

export function aggregateDashboardStats(
  logs: PrintLogRecord[],
  selectedMonth: string
): DashboardStats {
  const monthSet = new Set<string>();
  for (const log of logs) {
    if (log.monthKey) monthSet.add(log.monthKey);
  }
  const availableMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));

  const filtered =
    selectedMonth === 'ALL' ? logs : logs.filter((log) => log.monthKey === selectedMonth);

  const materialMap = new Map<string, number>();
  const userMap = new Map<string, number>();
  const machineMap = new Map<string, number>();
  const batchSet = new Set<string>();
  let totalGrams = 0;

  for (const log of filtered) {
    totalGrams += log.grams;
    batchSet.add(log.batchId || log.id);
    materialMap.set(log.material, (materialMap.get(log.material) ?? 0) + log.grams);
    userMap.set(log.person, (userMap.get(log.person) ?? 0) + log.grams);
    machineMap.set(log.machine, (machineMap.get(log.machine) ?? 0) + log.grams);
  }

  const byMaterial = Array.from(materialMap.entries())
    .map(([material, grams]) => ({ material, grams: Math.round(grams * 10) / 10 }))
    .sort((a, b) => b.grams - a.grams);

  const byUser = Array.from(userMap.entries())
    .map(([person, grams]) => ({ person, grams: Math.round(grams * 10) / 10 }))
    .sort((a, b) => b.grams - a.grams);

  const byMachine = Array.from(machineMap.entries())
    .map(([machine, grams]) => ({ machine, grams: Math.round(grams * 10) / 10 }))
    .sort((a, b) => b.grams - a.grams);

  return {
    totalGrams: Math.round(totalGrams * 10) / 10,
    totalPrints: batchSet.size,
    topMaterial: byMaterial.length > 0 ? { name: byMaterial[0].material, grams: byMaterial[0].grams } : null,
    topUser: byUser.length > 0 ? { name: byUser[0].person, grams: byUser[0].grams } : null,
    byMaterial,
    byUser,
    byMachine,
    availableMonths,
  };
}

export function generateSeedPrintLogs(nowMs: number = Date.now()): PrintLogRecord[] {
  const currentMonth = new Date(nowMs);
  const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 15, 14, 30);

  const mk = (
    id: string,
    offsetHours: number,
    baseMs: number,
    machine: PrinterName,
    person: string,
    project: string,
    material: MaterialType,
    color: string,
    grams: number,
    isMultiColor: boolean = false,
    batchId: string = id
  ): PrintLogRecord => {
    const ts = baseMs - offsetHours * 3600 * 1000;
    return {
      id,
      machine,
      person,
      project,
      material,
      color,
      grams,
      isMultiColor,
      batchId,
      monthKey: getMonthKey(new Date(ts)),
      createdAtMs: ts,
    };
  };

  return [
    mk('seed-1', 2, nowMs, 'Bambu H2D', 'Alexsandro', 'Suporte Sensor LIDAR', 'PETG', 'Laranja', 142.5),
    mk('seed-2', 5, nowMs, 'Bambu X2D', 'Bruna', 'Carcaça Drone V3', 'ABS', 'Cinza / Grafite', 218.0),
    mk('seed-3a', 9, nowMs, 'Bambu A1 Mini', 'Eduardo Araujo', 'Organizador Bancada', 'PLA', 'Azul Escuro / Ciano', 84.0, true, 'batch-seed-3'),
    mk('seed-3b', 9, nowMs, 'Bambu A1 Mini', 'Eduardo Araujo', 'Organizador Bancada', 'PLA', 'Branco', 36.5, true, 'batch-seed-3'),
    mk('seed-4', 18, nowMs, 'Creality K1 Max 01', 'Felipe', 'Engrenagem Planetária', 'PC', 'Preto', 165.0),
    mk('seed-5', 26, nowMs, 'Halot-Mage Pro 8K', 'Natália Barros', 'Conector Microfluídico', 'Resina', 'Standard', 48.0),
    mk('seed-6', 40, nowMs, 'Creality K1 Max 02', 'Gustavo', 'Amortecedor Garra', 'TPU', 'Preto', 62.0),
    mk('seed-7', 52, nowMs, 'Bambu P2S', 'Ana Sarah', 'Protótipo Exoesqueleto', 'PLA', 'Silk Prata Metal', 310.0),
    mk('seed-8', 0, prevMonth.getTime(), 'Creality K1 Max 03', 'Kimura', 'Duto Refrigeração', 'ABS', 'Preto', 195.0),
    mk('seed-9', 24, prevMonth.getTime(), 'Bambu H2D', 'Alexsandro', 'Painel Telemetria', 'PLA', 'Preto', 274.0),
  ];
}
