export interface ReportMaterialRow {
  material: string;
  grams: number;
}

export interface ReportUserRow {
  person: string;
  grams: number;
  hours?: number;
}

export interface ReportMachineRow {
  machine: string;
  grams: number;
  hours?: number;
}

export interface ReportPayload {
  recipientEmail: string;
  periodLabel: string;
  totalGrams: number;
  totalHours?: number;
  totalPrints: number;
  byMaterial: ReportMaterialRow[];
  byUser: ReportUserRow[];
  byMachine: ReportMachineRow[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validateReportPayload(
  raw: unknown,
  fallbackRecipient: string = ''
): { valid: boolean; error?: string; payload?: ReportPayload } {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Corpo da requisição inválido.' };
  }

  const data = raw as Record<string, unknown>;
  const rawRecipient =
    typeof data.recipientEmail === 'string' && data.recipientEmail.trim().length > 0
      ? data.recipientEmail.trim()
      : fallbackRecipient.trim();

  if (!rawRecipient || !isValidEmail(rawRecipient)) {
    return { valid: false, error: 'Informe um endereço de e-mail destinatário válido.' };
  }

  const periodLabel =
    typeof data.periodLabel === 'string' && data.periodLabel.trim().length > 0
      ? data.periodLabel.trim().slice(0, 80)
      : 'Todos os meses';

  const totalGrams = Number(data.totalGrams ?? 0);
  const totalHours = Number(data.totalHours ?? 0);
  const totalPrints = Number(data.totalPrints ?? 0);
  if (
    !Number.isFinite(totalGrams) ||
    totalGrams < 0 ||
    !Number.isFinite(totalHours) ||
    totalHours < 0 ||
    !Number.isFinite(totalPrints) ||
    totalPrints < 0
  ) {
    return { valid: false, error: 'Totais do relatório inválidos.' };
  }

  const toRows = <T>(arr: unknown, mapper: (item: Record<string, unknown>) => T | null): T[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .slice(0, 100)
      .map((entry) => (entry && typeof entry === 'object' ? mapper(entry as Record<string, unknown>) : null))
      .filter((x): x is T => x !== null);
  };

  const byMaterial = toRows(data.byMaterial, (item) =>
    typeof item.material === 'string' && Number.isFinite(Number(item.grams))
      ? { material: item.material.slice(0, 40), grams: Math.round(Number(item.grams) * 10) / 10 }
      : null
  );

  const byUser = toRows(data.byUser, (item) =>
    typeof item.person === 'string' && Number.isFinite(Number(item.grams))
      ? {
          person: item.person.slice(0, 80),
          grams: Math.round(Number(item.grams) * 10) / 10,
          hours: Number.isFinite(Number(item.hours))
            ? Math.round(Number(item.hours) * 10) / 10
            : 0,
        }
      : null
  );

  const byMachine = toRows(data.byMachine, (item) =>
    typeof item.machine === 'string' && Number.isFinite(Number(item.grams))
      ? {
          machine: item.machine.slice(0, 64),
          grams: Math.round(Number(item.grams) * 10) / 10,
          hours: Number.isFinite(Number(item.hours))
            ? Math.round(Number(item.hours) * 10) / 10
            : 0,
        }
      : null
  );

  return {
    valid: true,
    payload: {
      recipientEmail: rawRecipient,
      periodLabel,
      totalGrams: Math.round(totalGrams * 10) / 10,
      totalHours: Math.round(totalHours * 10) / 10,
      totalPrints: Math.round(totalPrints),
      byMaterial,
      byUser,
      byMachine,
    },
  };
}

export function getPreviousMonthWindow(now: Date = new Date()): {
  monthKey: string;
  periodLabel: string;
} {
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = prevMonthDate.getFullYear();
  const monthNum = prevMonthDate.getMonth() + 1;
  const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`;
  const monthsPt = [
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
  return {
    monthKey,
    periodLabel: `${monthsPt[prevMonthDate.getMonth()]} ${year}`,
  };
}

export function buildReportEmailContent(payload: ReportPayload): {
  subject: string;
  text: string;
  html: string;
} {
  const totalKg = (payload.totalGrams / 1000).toFixed(2);
  const totalHours = Number(payload.totalHours ?? 0);
  const subject = `[Samsung Ocean 3D] Relatório de Filamentos — ${payload.periodLabel}`;

  const textLines: string[] = [
    'SAMSUNG OCEAN 3D — RELATÓRIO DE CONSUMO DE FILAMENTOS E RESINAS',
    `Período: ${payload.periodLabel}`,
    `Consumo total: ${payload.totalGrams.toFixed(1)} g (${totalKg} kg)`,
    `Total de impressões: ${payload.totalPrints} (${totalHours.toFixed(1)} h de impressão)`,
    '',
    '--- Consumo por Material ---',
    ...(payload.byMaterial.length > 0
      ? payload.byMaterial.map((m) => `  • ${m.material}: ${m.grams.toFixed(1)} g`)
      : ['  Sem registos no período.']),
    '',
    '--- Ranking de Utilizadores ---',
    ...(payload.byUser.length > 0
      ? payload.byUser.map(
          (u) =>
            `  • ${u.person}: ${u.grams.toFixed(1)} g${u.hours && u.hours > 0 ? ` (${u.hours.toFixed(1)} h)` : ''}`
        )
      : ['  Sem registos no período.']),
    '',
    '--- Consumo por Impressora ---',
    ...(payload.byMachine.length > 0
      ? payload.byMachine.map(
          (mac) =>
            `  • ${mac.machine}: ${mac.grams.toFixed(1)} g${mac.hours && mac.hours > 0 ? ` (${mac.hours.toFixed(1)} h)` : ''}`
        )
      : ['  Sem registos no período.']),
  ];

  const renderRowsHtml = (rows: Array<{ label: string; grams: number; hours?: number }>) => {
    if (rows.length === 0) {
      return `<tr><td colspan="2" style="padding:10px 12px;color:#64748b;font-size:13px;">Sem registos neste período.</td></tr>`;
    }
    return rows
      .map(
        (r) => `
      <tr>
        <td style="padding:9px 12px;border-bottom:1px solid #e2ecf7;color:#0f172a;font-size:13px;">${escapeHtml(r.label)}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e2ecf7;color:#086bff;font-weight:700;text-align:right;font-family:monospace;font-size:13px;">${r.grams.toFixed(1)} g${r.hours && r.hours > 0 ? ` <span style="color:#64748b;font-weight:500;">· ${r.hours.toFixed(1)} h</span>` : ''}</td>
      </tr>`
      )
      .join('');
  };

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#f7fbff;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #d8e8fa;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#086bff,#18a0ff);padding:24px 28px;color:#ffffff;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;">Samsung Ocean 3D</div>
      <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;">Relatório de Consumo de Filamentos</h1>
      <p style="margin:6px 0 0;font-size:14px;opacity:0.95;">Período: ${escapeHtml(payload.periodLabel)}</p>
    </div>

    <div style="padding:24px 28px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="width:50%;padding:14px;background:#ecfcff;border:1px solid #bfeaff;border-radius:12px;">
            <div style="font-size:12px;color:#475569;">Consumo Total</div>
            <div style="margin-top:4px;font-size:22px;font-weight:700;color:#086bff;font-family:monospace;">${payload.totalGrams.toFixed(1)} g</div>
            <div style="margin-top:2px;font-size:12px;color:#64748b;">${totalKg} kg acumulados</div>
          </td>
          <td style="width:12px;"></td>
          <td style="width:50%;padding:14px;background:#f7fbff;border:1px solid #d8e8fa;border-radius:12px;">
            <div style="font-size:12px;color:#475569;">Impressões &amp; Tempo</div>
            <div style="margin-top:4px;font-size:22px;font-weight:700;color:#0f172a;font-family:monospace;">${payload.totalPrints}</div>
            <div style="margin-top:2px;font-size:12px;color:#64748b;">${totalHours.toFixed(1)} h totais · ${escapeHtml(payload.periodLabel)}</div>
          </td>
        </tr>
      </table>

      <h2 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Consumo por Material</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:22px;border:1px solid #e2ecf7;">
        ${renderRowsHtml(payload.byMaterial.map((m) => ({ label: m.material, grams: m.grams })))}
      </table>

      <h2 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Ranking de Utilizadores</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:22px;border:1px solid #e2ecf7;">
        ${renderRowsHtml(payload.byUser.map((u) => ({ label: u.person, grams: u.grams, hours: u.hours })))}
      </table>

      <h2 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Consumo por Impressora</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2ecf7;">
        ${renderRowsHtml(payload.byMachine.map((mac) => ({ label: mac.machine, grams: mac.grams, hours: mac.hours })))}
      </table>

      <p style="margin:20px 0 0;padding:12px 14px;background:#f7fbff;border:1px solid #d8e8fa;border-radius:10px;font-size:12px;color:#475569;">
        Segue também em anexo o relatório visual em <strong>PDF (formato painel Power BI)</strong> com os gráficos de distribuição, ranking e consumo por impressora.
      </p>
    </div>
  </div>
</body>
</html>`;

  textLines.push('', 'Em anexo: Relatório visual em PDF (estilo Power BI).');

  return {
    subject,
    text: textLines.join('\n'),
    html,
  };
}
