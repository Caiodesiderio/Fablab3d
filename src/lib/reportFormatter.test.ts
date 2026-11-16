import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReportEmailContent,
  getPreviousMonthWindow,
  isValidEmail,
  validateReportPayload,
} from './reportFormatter';

test('isValidEmail accepts valid addresses and rejects malformed ones', () => {
  assert.equal(isValidEmail('cd.chaves2005@gmail.com'), true);
  assert.equal(isValidEmail('invalid-email'), false);
  assert.equal(isValidEmail(''), false);
});

test('validateReportPayload validates and normalizes report payload with fallback email', () => {
  const res = validateReportPayload(
    {
      periodLabel: 'Novembro 2026',
      totalGrams: 425.36,
      totalPrints: 4,
      byMaterial: [{ material: 'PLA', grams: 300.24 }],
      byUser: [{ person: 'Caio', grams: 125.12 }],
      byMachine: [{ machine: 'Creality LD-006', grams: 125.12 }],
    },
    'cd.chaves2005@gmail.com'
  );

  assert.equal(res.valid, true);
  assert.equal(res.payload?.recipientEmail, 'cd.chaves2005@gmail.com');
  assert.equal(res.payload?.totalGrams, 425.4);
  assert.equal(res.payload?.byMaterial[0].grams, 300.2);

  const bad = validateReportPayload({ totalGrams: -10 }, '');
  assert.equal(bad.valid, false);
});

test('getPreviousMonthWindow handles January rollover to December cleanly', () => {
  const jan = getPreviousMonthWindow(new Date(2027, 0, 1, 8, 0, 0));
  assert.equal(jan.monthKey, '2026-12');
  assert.equal(jan.periodLabel, 'Dezembro 2026');
});

test('buildReportEmailContent generates subject, plain text, and escaped HTML', () => {
  const content = buildReportEmailContent({
    recipientEmail: 'coord@ocean.org',
    periodLabel: 'Outubro 2026',
    totalGrams: 1250,
    totalPrints: 6,
    byMaterial: [{ material: 'PLA', grams: 800 }],
    byUser: [{ person: 'Estephany <Lab>', grams: 800 }],
    byMachine: [{ machine: 'Bambu P2S', grams: 800 }],
  });

  assert.ok(content.subject.includes('Outubro 2026'));
  assert.ok(content.text.includes('1250.0 g (1.25 kg)'));
  assert.ok(content.html.includes('Estephany &lt;Lab&gt;'));
  assert.ok(content.html.includes('#086bff'));
});
