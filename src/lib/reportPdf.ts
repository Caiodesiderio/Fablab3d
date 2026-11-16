import PDFDocument from 'pdfkit';
import type { ReportPayload } from './reportFormatter.ts';

const OCEAN_COLORS = [
  '#086BFF',
  '#18A0FF',
  '#0EA5E9',
  '#38BDF8',
  '#60C5FF',
  '#93C5FD',
];

export function buildReportPdfFilename(periodLabel: string): string {
  const slug = periodLabel
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `relatorio-samsung-ocean-3d-${slug || 'geral'}.pdf`;
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(1, maxLen - 1))}…`;
}

function formatDatePt(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function drawDonutSlice(
  doc: PDFKit.PDFDocument,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  color: string
) {
  const span = endAngle - startAngle;
  if (span <= 0) return;

  if (span >= Math.PI * 2 - 0.001) {
    doc.save().circle(cx, cy, radius).fill(color).restore();
    return;
  }

  const steps = Math.max(8, Math.ceil(span / 0.05));
  doc.save();
  doc.moveTo(cx, cy);
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (span * i) / steps;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    doc.lineTo(x, y);
  }
  doc.closePath().fill(color);
  doc.restore();
}

export async function generatePowerBiReportPdf(
  payload: ReportPayload,
  generatedAt: Date = new Date()
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 0,
      info: {
        Title: `Samsung Ocean 3D — Relatório (${payload.periodLabel})`,
        Author: 'Samsung Ocean 3D Lab',
        Subject: `Consumo de Filamentos e Resinas — ${payload.periodLabel}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    const pageW = 841.89;
    const pageH = 595.28;
    const marginX = 28;
    const contentW = pageW - marginX * 2;

    // Canvas background (#F7FBFF)
    doc.rect(0, 0, pageW, pageH).fill('#F7FBFF');

    // Top Header Bar
    doc.roundedRect(marginX, 20, contentW, 52, 8).fillAndStroke('#FFFFFF', '#D8E8FA');
    doc.rect(marginX, 20, 6, 52).fill('#086BFF');

    doc
      .fillColor('#086BFF')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('SAMSUNG OCEAN 3D · POWER BI STYLE REPORT', marginX + 18, 30);

    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(16)
      .text('Relatório Analítico de Consumo de Filamentos e Resinas', marginX + 18, 43);

    doc
      .fillColor('#086BFF')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(payload.periodLabel, marginX + contentW - 220, 32, {
        width: 204,
        align: 'right',
      });

    doc
      .fillColor('#64748B')
      .font('Helvetica')
      .fontSize(8.5)
      .text(`Emitido em ${formatDatePt(generatedAt)}`, marginX + contentW - 220, 49, {
        width: 204,
        align: 'right',
      });

    // Row 1: 4 KPI Cards
    const kpiY = 84;
    const kpiH = 72;
    const kpiGap = 12;
    const kpiW = (contentW - kpiGap * 3) / 4;

    const topMat = payload.byMaterial[0];
    const topUser = payload.byUser[0];
    const totalGrams = payload.totalGrams;
    const totalHours = Number(payload.totalHours ?? 0);

    const kpis = [
      {
        label: 'CONSUMO TOTAL',
        value: `${totalGrams.toFixed(1)} g`,
        sub: `${(totalGrams / 1000).toFixed(2)} kg acumulados`,
        accent: '#086BFF',
      },
      {
        label: 'IMPRESSÕES & TEMPO',
        value: `${payload.totalPrints} (${totalHours.toFixed(1)} h)`,
        sub: 'lotes e horas de máquina',
        accent: '#0F172A',
      },
      {
        label: 'MATERIAL LÍDER',
        value: topMat ? truncateText(topMat.material, 14) : '—',
        sub:
          topMat && totalGrams > 0
            ? `${topMat.grams.toFixed(1)} g (${((topMat.grams / totalGrams) * 100).toFixed(0)}%)`
            : 'Sem registos',
        accent: '#086BFF',
      },
      {
        label: 'MAIOR UTILIZADOR',
        value: topUser ? truncateText(topUser.person, 15) : '—',
        sub:
          topUser && totalGrams > 0
            ? `${topUser.grams.toFixed(1)} g (${((topUser.grams / totalGrams) * 100).toFixed(0)}%)`
            : 'Sem registos',
        accent: '#0F172A',
      },
    ];

    kpis.forEach((kpi, idx) => {
      const x = marginX + idx * (kpiW + kpiGap);
      doc.roundedRect(x, kpiY, kpiW, kpiH, 8).fillAndStroke('#FFFFFF', '#D8E8FA');
      doc
        .fillColor('#64748B')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(kpi.label, x + 14, kpiY + 12, { width: kpiW - 28 });
      doc
        .fillColor(kpi.accent)
        .font('Helvetica-Bold')
        .fontSize(17)
        .text(kpi.value, x + 14, kpiY + 26, { width: kpiW - 28 });
      doc
        .fillColor('#475569')
        .font('Helvetica')
        .fontSize(8.5)
        .text(kpi.sub, x + 14, kpiY + 50, { width: kpiW - 28 });
    });

    // Row 2: Two Power BI Visual Panels
    const row2Y = 168;
    const row2H = 220;
    const panelGap = 12;
    const leftW = 368;
    const rightW = contentW - leftW - panelGap;

    // Left Panel: Donut Chart (Material Share)
    doc.roundedRect(marginX, row2Y, leftW, row2H, 8).fillAndStroke('#FFFFFF', '#D8E8FA');
    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(10.5)
      .text('Distribuição por Material (gramas e %)', marginX + 14, row2Y + 13);
    doc
      .moveTo(marginX + 14, row2Y + 31)
      .lineTo(marginX + leftW - 14, row2Y + 31)
      .strokeColor('#E2ECF7')
      .lineWidth(1)
      .stroke();

    const materialSum = payload.byMaterial.reduce((acc, m) => acc + Math.max(0, m.grams), 0);
    if (payload.byMaterial.length === 0 || materialSum <= 0) {
      doc
        .fillColor('#64748B')
        .font('Helvetica')
        .fontSize(9.5)
        .text('Sem dados de material para o período.', marginX + 14, row2Y + 102, {
          width: leftW - 28,
          align: 'center',
        });
    } else {
      const cx = marginX + 94;
      const cy = row2Y + 124;
      const outerR = 66;
      const innerR = 36;
      let startAngle = -Math.PI / 2;

      payload.byMaterial.forEach((mat, idx) => {
        const fraction = mat.grams / materialSum;
        const endAngle = startAngle + fraction * Math.PI * 2;
        const color = OCEAN_COLORS[idx % OCEAN_COLORS.length];
        drawDonutSlice(doc, cx, cy, outerR, startAngle, endAngle, color);
        startAngle = endAngle;
      });

      // Donut center cutout
      doc.save().circle(cx, cy, innerR).fill('#FFFFFF').restore();
      doc
        .fillColor('#0F172A')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(`${materialSum.toFixed(0)}g`, cx - 28, cy - 6, { width: 56, align: 'center' });

      // Material legend
      const legendX = marginX + 182;
      let legendY = row2Y + 48;
      payload.byMaterial.slice(0, 7).forEach((mat, idx) => {
        const color = OCEAN_COLORS[idx % OCEAN_COLORS.length];
        const pct = ((mat.grams / materialSum) * 100).toFixed(1);
        doc.roundedRect(legendX, legendY + 2, 8, 8, 2).fill(color);
        doc
          .fillColor('#0F172A')
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text(truncateText(mat.material, 14), legendX + 14, legendY + 1, { width: 76 });
        doc
          .fillColor('#086BFF')
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text(`${mat.grams.toFixed(1)} g`, legendX + 88, legendY + 1, {
            width: 52,
            align: 'right',
          });
        doc
          .fillColor('#64748B')
          .font('Helvetica')
          .fontSize(8)
          .text(`${pct}%`, legendX + 142, legendY + 1.5, {
            width: 30,
            align: 'right',
          });
        legendY += 23;
      });
    }

    // Right Panel: Top Users Horizontal Bar Chart
    const rightX = marginX + leftW + panelGap;
    doc.roundedRect(rightX, row2Y, rightW, row2H, 8).fillAndStroke('#FFFFFF', '#D8E8FA');
    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(10.5)
      .text('Ranking de Utilizadores (Top 8 em gramas)', rightX + 14, row2Y + 13);
    doc
      .moveTo(rightX + 14, row2Y + 31)
      .lineTo(rightX + rightW - 14, row2Y + 31)
      .strokeColor('#E2ECF7')
      .lineWidth(1)
      .stroke();

    const topUsers = payload.byUser.slice(0, 8);
    if (topUsers.length === 0) {
      doc
        .fillColor('#64748B')
        .font('Helvetica')
        .fontSize(9.5)
        .text('Sem dados de utilizadores para o período.', rightX + 14, row2Y + 102, {
          width: rightW - 28,
          align: 'center',
        });
    } else {
      const maxUserGrams = Math.max(...topUsers.map((u) => u.grams), 1);
      const labelW = 112;
      const valueW = 54;
      const barAreaW = rightW - 28 - labelW - valueW - 16;
      let barY = row2Y + 44;

      topUsers.forEach((user) => {
        const ratio = Math.max(0, Math.min(1, user.grams / maxUserGrams));
        const fillW = Math.max(ratio > 0 ? 4 : 0, ratio * barAreaW);

        doc
          .fillColor('#0F172A')
          .font('Helvetica')
          .fontSize(8.5)
          .text(truncateText(user.person, 19), rightX + 14, barY + 2, { width: labelW });

        doc.roundedRect(rightX + 14 + labelW + 6, barY + 2, barAreaW, 10, 3).fill('#EBF3FC');
        if (fillW > 0) {
          doc.roundedRect(rightX + 14 + labelW + 6, barY + 2, fillW, 10, 3).fill('#086BFF');
        }

        doc
          .fillColor('#086BFF')
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text(`${user.grams.toFixed(1)} g`, rightX + rightW - 14 - valueW, barY + 2, {
            width: valueW,
            align: 'right',
          });

        barY += 21;
      });
    }

    // Row 3: Full-width Printer Breakdown (2-column matrix)
    const row3Y = 400;
    const row3H = 164;
    doc.roundedRect(marginX, row3Y, contentW, row3H, 8).fillAndStroke('#FFFFFF', '#D8E8FA');
    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(10.5)
      .text('Consumo por Impressora 3D', marginX + 14, row3Y + 12);
    doc
      .moveTo(marginX + 14, row3Y + 30)
      .lineTo(marginX + contentW - 14, row3Y + 30)
      .strokeColor('#E2ECF7')
      .lineWidth(1)
      .stroke();

    const machines = payload.byMachine.slice(0, 10);
    if (machines.length === 0) {
      doc
        .fillColor('#64748B')
        .font('Helvetica')
        .fontSize(9.5)
        .text('Sem dados de impressoras para o período.', marginX + 14, row3Y + 76, {
          width: contentW - 28,
          align: 'center',
        });
    } else {
      const maxMachineGrams = Math.max(...machines.map((m) => m.grams), 1);
      const colW = (contentW - 44) / 2;

      machines.forEach((mac, idx) => {
        const col = idx < 5 ? 0 : 1;
        const row = idx % 5;
        const cellX = marginX + 14 + col * (colW + 16);
        const cellY = row3Y + 42 + row * 23;
        const trackX = cellX + 126;
        const trackW = colW - 126 - 98;
        const ratio = Math.max(0, Math.min(1, mac.grams / maxMachineGrams));
        const pct = totalGrams > 0 ? ((mac.grams / totalGrams) * 100).toFixed(0) : '0';
        const hrsText = mac.hours && mac.hours > 0 ? ` · ${mac.hours.toFixed(1)}h` : ` (${pct}%)`;

        doc
          .fillColor('#0F172A')
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text(truncateText(mac.machine, 21), cellX, cellY + 1, { width: 120 });

        doc.roundedRect(trackX, cellY + 2, trackW, 9, 3).fill('#EBF3FC');
        if (ratio > 0) {
          doc
            .roundedRect(trackX, cellY + 2, Math.max(4, ratio * trackW), 9, 3)
            .fill('#18A0FF');
        }

        doc
          .fillColor('#0F172A')
          .font('Helvetica-Bold')
          .fontSize(8.2)
          .text(`${mac.grams.toFixed(1)}g${hrsText}`, cellX + colW - 94, cellY + 1, {
            width: 94,
            align: 'right',
          });
      });
    }

    // Footer
    doc
      .fillColor('#64748B')
      .font('Helvetica')
      .fontSize(8)
      .text(
        'Samsung Ocean 3D · Relatório analítico em anexo gerado automaticamente pelo Sistema de Controle de Filamentos',
        marginX,
        pageH - 20,
        { width: contentW, align: 'center' }
      );

    doc.end();
  });
}
