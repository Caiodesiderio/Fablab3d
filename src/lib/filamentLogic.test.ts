import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PEOPLE,
  FILAMENT_INVENTORY,
  PRINTERS,
  aggregateDashboardStats,
  formatMonthLabel,
  getColorsForMaterial,
  isValidMaterialColorPair,
  sanitizeDocId,
  validatePrintSubmission,
  type PrintLogRecord,
} from './filamentLogic';

test('inventory and default datasets match exact laboratory specifications', () => {
  assert.equal(PRINTERS.length, 9);
  assert.ok(PRINTERS.includes('Creality LD-006'));
  assert.equal(DEFAULT_PEOPLE.length, 23);
  assert.ok(DEFAULT_PEOPLE.includes('Caio'));
  assert.deepEqual(Object.keys(FILAMENT_INVENTORY), ['ABS', 'PC', 'PETG', 'PLA', 'Resina', 'TPU']);
  assert.equal(FILAMENT_INVENTORY.ABS.length, 10);
  assert.equal(FILAMENT_INVENTORY.PLA.length, 24);
  assert.deepEqual(FILAMENT_INVENTORY.Resina, [
    'Pro',
    'Standard',
    'Lavável',
    'Flex',
    'Semi-Flex',
    'Calcinável',
    'Dental',
  ]);
});

test('cascading color lookup filters strictly by selected material', () => {
  const pcColors = getColorsForMaterial('PC');
  assert.deepEqual(pcColors, ['Preto']);
  assert.equal(isValidMaterialColorPair('PC', 'Preto'), true);
  assert.equal(isValidMaterialColorPair('PC', 'Amarelo'), false);
  assert.equal(isValidMaterialColorPair('Resina', 'Calcinável'), true);
  assert.equal(isValidMaterialColorPair('Resina', 'Dental'), true);
  assert.deepEqual(getColorsForMaterial('Inexistente'), []);
});

test('validatePrintSubmission rejects empty project, invalid grams, invalid duration, or mismatched color', () => {
  const invalidEmpty = validatePrintSubmission(
    {
      machine: 'Bambu H2D',
      person: 'Alexsandro',
      project: '   ',
      durationHours: '2.5',
      isMultiColor: false,
      lines: [{ id: '1', material: 'PLA', color: 'Preto', grams: '50' }],
    },
    DEFAULT_PEOPLE
  );
  assert.equal(invalidEmpty.valid, false);
  assert.ok(invalidEmpty.errors.some((e) => e.includes('projeto')));

  const invalidDuration = validatePrintSubmission(
    {
      machine: 'Bambu H2D',
      person: 'Alexsandro',
      project: 'Suporte',
      durationHours: '0',
      isMultiColor: false,
      lines: [{ id: '1', material: 'PLA', color: 'Preto', grams: '50' }],
    },
    DEFAULT_PEOPLE
  );
  assert.equal(invalidDuration.valid, false);
  assert.ok(invalidDuration.errors.some((e) => e.includes('horas')));

  const tooLongDuration = validatePrintSubmission(
    {
      machine: 'Bambu H2D',
      person: 'Alexsandro',
      project: 'Suporte',
      durationHours: '600',
      isMultiColor: false,
      lines: [{ id: '1', material: 'PLA', color: 'Preto', grams: '50' }],
    },
    DEFAULT_PEOPLE
  );
  assert.equal(tooLongDuration.valid, false);

  const invalidGrams = validatePrintSubmission(
    {
      machine: 'Bambu H2D',
      person: 'Alexsandro',
      project: 'Suporte',
      durationHours: '1.5',
      isMultiColor: false,
      lines: [{ id: '1', material: 'PLA', color: 'Preto', grams: '0' }],
    },
    DEFAULT_PEOPLE
  );
  assert.equal(invalidGrams.valid, false);

  const invalidPair = validatePrintSubmission(
    {
      machine: 'Bambu H2D',
      person: 'Alexsandro',
      project: 'Suporte',
      durationHours: '1.5',
      isMultiColor: false,
      lines: [{ id: '1', material: 'PETG', color: 'Branco Dental', grams: '30' }],
    },
    DEFAULT_PEOPLE
  );
  assert.equal(invalidPair.valid, false);
});

test('validatePrintSubmission accepts valid multi-color AMS/CFS submission', () => {
  const result = validatePrintSubmission(
    {
      machine: 'Bambu X2D',
      person: 'Bruna',
      project: 'Caixa Sensorial',
      durationHours: '3.26',
      isMultiColor: true,
      lines: [
        { id: '1', material: 'PLA', color: 'Branco', grams: '42.34' },
        { id: '2', material: 'PLA', color: 'Laranja', grams: '18.5' },
      ],
    },
    DEFAULT_PEOPLE
  );
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.parsedDurationHours, 3.3);
  assert.equal(result.parsedLines.length, 2);
  assert.equal(result.parsedLines[0].grams, 42.3);
});

test('aggregateDashboardStats computes totals, rankings, deduplicated batch hours, and month filtering accurately', () => {
  const logs: PrintLogRecord[] = [
    {
      id: '1',
      machine: 'Bambu H2D',
      person: 'Alexsandro',
      project: 'P1',
      material: 'PLA',
      color: 'Preto',
      grams: 100,
      durationHours: 3.5,
      isMultiColor: true,
      batchId: 'b1',
      monthKey: '2026-11',
      createdAtMs: 1,
    },
    {
      id: '2',
      machine: 'Bambu H2D',
      person: 'Alexsandro',
      project: 'P1',
      material: 'ABS',
      color: 'Preto',
      grams: 50,
      durationHours: 3.5,
      isMultiColor: true,
      batchId: 'b1',
      monthKey: '2026-11',
      createdAtMs: 1,
    },
    {
      id: '3',
      machine: 'Creality K1 Max 01',
      person: 'Bruna',
      project: 'P2',
      material: 'ABS',
      color: 'Vermelho',
      grams: 200,
      durationHours: 4.0,
      isMultiColor: false,
      batchId: 'b2',
      monthKey: '2026-10',
      createdAtMs: 2,
    },
  ];

  const allStats = aggregateDashboardStats(logs, 'ALL');
  assert.equal(allStats.totalGrams, 350);
  assert.equal(allStats.totalHours, 7.5);
  assert.equal(allStats.totalPrints, 2);
  assert.equal(allStats.topMaterial?.name, 'ABS');
  assert.equal(allStats.topMaterial?.grams, 250);
  assert.equal(allStats.topUser?.name, 'Bruna');
  assert.equal(allStats.topUser?.grams, 200);
  assert.equal(allStats.topUser?.hours, 4.0);
  assert.deepEqual(allStats.byMachine, [
    { machine: 'Creality K1 Max 01', grams: 200, hours: 4.0 },
    { machine: 'Bambu H2D', grams: 150, hours: 3.5 },
  ]);
  assert.deepEqual(allStats.availableMonths, ['2026-11', '2026-10']);

  const novStats = aggregateDashboardStats(logs, '2026-11');
  assert.equal(novStats.totalGrams, 150);
  assert.equal(novStats.totalHours, 3.5);
  assert.equal(novStats.totalPrints, 1);
  assert.equal(novStats.topUser?.name, 'Alexsandro');
  assert.equal(formatMonthLabel('2026-11'), 'Novembro 2026');
});

test('sanitizeDocId generates safe Firestore-compliant document IDs', () => {
  assert.equal(sanitizeDocId('Natália Barros'), 'natalia-barros');
  assert.equal(sanitizeDocId('João Luz!@#'), 'joao-luz');
});
