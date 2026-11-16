import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportPdfFilename, generatePowerBiReportPdf } from './reportPdf.ts';

test('buildReportPdfFilename normalizes accents and spaces', () => {
  assert.equal(
    buildReportPdfFilename('Março 2026'),
    'relatorio-samsung-ocean-3d-marco-2026.pdf'
  );
  assert.equal(
    buildReportPdfFilename('Todos os meses'),
    'relatorio-samsung-ocean-3d-todos-os-meses.pdf'
  );
});

test('generatePowerBiReportPdf returns valid PDF buffer for full report payload', async () => {
  const buf = await generatePowerBiReportPdf({
    recipientEmail: 'akimura@uea.edu.br',
    periodLabel: 'Novembro 2026',
    totalGrams: 1535.0,
    totalHours: 34.5,
    totalPrints: 9,
    byMaterial: [
      { material: 'PLA', grams: 704.5 },
      { material: 'ABS', grams: 413.0 },
      { material: 'PC', grams: 165.0 },
      { material: 'PETG', grams: 142.5 },
      { material: 'TPU', grams: 62.0 },
      { material: 'Resina', grams: 48.0 },
    ],
    byUser: [
      { person: 'Alexsandro', grams: 416.5, hours: 10.0 },
      { person: 'Ana Sarah', grams: 310.0, hours: 8.0 },
      { person: 'Bruna', grams: 218.0, hours: 5.2 },
    ],
    byMachine: [
      { machine: 'Bambu H2D', grams: 416.5, hours: 10.0 },
      { machine: 'Bambu P2S', grams: 310.0, hours: 8.0 },
    ],
  });

  assert.ok(Buffer.isBuffer(buf));
  assert.ok(buf.length > 1500);
  assert.equal(buf.subarray(0, 5).toString('ascii'), '%PDF-');
});

test('generatePowerBiReportPdf handles single-material 100% slice and empty payload safely', async () => {
  const singleBuf = await generatePowerBiReportPdf({
    recipientEmail: 'akimura@uea.edu.br',
    periodLabel: 'Janeiro 2026',
    totalGrams: 200,
    totalHours: 4.5,
    totalPrints: 1,
    byMaterial: [{ material: 'PLA', grams: 200 }],
    byUser: [{ person: 'Caio', grams: 200, hours: 4.5 }],
    byMachine: [{ machine: 'Bambu A1 Mini', grams: 200, hours: 4.5 }],
  });
  assert.equal(singleBuf.subarray(0, 5).toString('ascii'), '%PDF-');

  const emptyBuf = await generatePowerBiReportPdf({
    recipientEmail: 'akimura@uea.edu.br',
    periodLabel: 'Fevereiro 2026',
    totalGrams: 0,
    totalHours: 0,
    totalPrints: 0,
    byMaterial: [],
    byUser: [],
    byMachine: [],
  });
  assert.equal(emptyBuf.subarray(0, 5).toString('ascii'), '%PDF-');
});
