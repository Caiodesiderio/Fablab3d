import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import nodemailer from 'nodemailer';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  buildReportEmailContent,
  getPreviousMonthWindow,
  isValidEmail,
  validateReportPayload,
  type ReportPayload,
} from './src/lib/reportFormatter.ts';
import {
  buildReportPdfFilename,
  generatePowerBiReportPdf,
} from './src/lib/reportPdf.ts';

interface FirebaseAppletConfig {
  projectId?: string;
  firestoreDatabaseId?: string;
}

function loadFirebaseAppletConfig(): FirebaseAppletConfig {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return {};
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw) as FirebaseAppletConfig;
  } catch (err) {
    console.warn('[Reports] Não foi possível ler firebase-applet-config.json:', err);
    return {};
  }
}

function normalizeServiceAccount(raw: Record<string, unknown>) {
  if (typeof raw.private_key === 'string') {
    raw.private_key = raw.private_key.replace(/\\n/g, '\n');
  }
  return raw;
}

function initAdminFirestore(config: FirebaseAppletConfig): {
  db: Firestore | null;
  serviceAccountProjectId: string | null;
} {
  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

    let app: App;
    let serviceAccountProjectId: string | null = null;
    if (getApps().length > 0) {
      app = getApps()[0];
    } else if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      const parsed = normalizeServiceAccount(
        JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')) as Record<string, unknown>
      );
      serviceAccountProjectId = typeof parsed.project_id === 'string' ? parsed.project_id : null;
      app = initializeApp({
        credential: cert(parsed as Parameters<typeof cert>[0]),
        projectId: config.projectId || serviceAccountProjectId || undefined,
      });
    } else if (serviceAccountJson) {
      const parsed = normalizeServiceAccount(JSON.parse(serviceAccountJson) as Record<string, unknown>);
      serviceAccountProjectId = typeof parsed.project_id === 'string' ? parsed.project_id : null;
      app = initializeApp({
        credential: cert(parsed as Parameters<typeof cert>[0]),
        projectId: config.projectId || serviceAccountProjectId || undefined,
      });
    } else if (gacPath && fs.existsSync(gacPath)) {
      app = initializeApp({
        projectId: config.projectId,
      });
    } else {
      return { db: null, serviceAccountProjectId: null };
    }

    const dbId = config.firestoreDatabaseId?.trim();
    const db = dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);
    return { db, serviceAccountProjectId };
  } catch (err) {
    console.warn('[Reports] Falha ao inicializar Firebase Admin SDK:', err);
    return { db: null, serviceAccountProjectId: null };
  }
}

function getSmtpConfig() {
  const user = process.env.SMTP_USER?.trim() || '';
  const pass = process.env.SMTP_APP_PASSWORD?.trim() || '';
  const defaultRecipient = process.env.REPORT_RECIPIENT_EMAIL?.trim() || '';
  return {
    user,
    pass,
    defaultRecipient,
    configured: Boolean(user && pass),
  };
}

async function sendReportViaSmtp(payload: ReportPayload): Promise<
  | { ok: true }
  | { ok: false; status: number; code: string; error: string }
> {
  const smtp = getSmtpConfig();
  if (!smtp.configured) {
    return {
      ok: false,
      status: 400,
      code: 'SMTP_NOT_CONFIGURED',
      error:
        'Configuração SMTP ausente no servidor. Defina SMTP_USER e SMTP_APP_PASSWORD nas variáveis de ambiente para enviar e-mails.',
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    });

    const content = buildReportEmailContent(payload);
    const pdfBuffer = await generatePowerBiReportPdf(payload);
    const pdfFilename = buildReportPdfFilename(payload.periodLabel);

    await transporter.sendMail({
      from: `"Samsung Ocean 3D" <${smtp.user}>`,
      to: payload.recipientEmail,
      subject: content.subject,
      text: content.text,
      html: content.html,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    return { ok: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Erro desconhecido no envio SMTP.';
    console.error('[Reports] Erro ao enviar e-mail via SMTP:', detail);
    return {
      ok: false,
      status: 502,
      code: 'SMTP_SEND_FAILED',
      error: `Falha ao enviar o e-mail pelo servidor Gmail SMTP: ${detail}`,
    };
  }
}

async function aggregateMonthFromFirestore(
  adminDb: Firestore,
  monthKey: string,
  periodLabel: string,
  recipientEmail: string
): Promise<ReportPayload> {
  const snapshot = await adminDb
    .collection('print_logs')
    .where('monthKey', '==', monthKey)
    .get();

  const materialMap = new Map<string, number>();
  const userMap = new Map<string, number>();
  const userHoursMap = new Map<string, number>();
  const machineMap = new Map<string, number>();
  const machineHoursMap = new Map<string, number>();
  const batchSet = new Set<string>();
  let totalGrams = 0;
  let totalHours = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const grams = Number(data.grams ?? 0);
    if (!Number.isFinite(grams) || grams <= 0) continue;

    const material = String(data.material ?? 'Outro');
    const person = String(data.person ?? 'Desconhecido');
    const machine = String(data.machine ?? 'Desconhecida');
    const batchId = String(data.batchId ?? docSnap.id);
    const hours = Number(data.durationHours ?? 0);

    const isNewBatch = !batchSet.has(batchId);
    batchSet.add(batchId);

    totalGrams += grams;
    materialMap.set(material, (materialMap.get(material) ?? 0) + grams);
    userMap.set(person, (userMap.get(person) ?? 0) + grams);
    machineMap.set(machine, (machineMap.get(machine) ?? 0) + grams);

    if (isNewBatch && Number.isFinite(hours) && hours > 0) {
      totalHours += hours;
      userHoursMap.set(person, (userHoursMap.get(person) ?? 0) + hours);
      machineHoursMap.set(machine, (machineHoursMap.get(machine) ?? 0) + hours);
    }
  }

  const round1 = (n: number) => Math.round(n * 10) / 10;

  return {
    recipientEmail,
    periodLabel,
    totalGrams: round1(totalGrams),
    totalHours: round1(totalHours),
    totalPrints: batchSet.size,
    byMaterial: Array.from(materialMap.entries())
      .map(([material, grams]) => ({ material, grams: round1(grams) }))
      .sort((a, b) => b.grams - a.grams),
    byUser: Array.from(userMap.entries())
      .map(([person, grams]) => ({
        person,
        grams: round1(grams),
        hours: round1(userHoursMap.get(person) ?? 0),
      }))
      .sort((a, b) => b.grams - a.grams),
    byMachine: Array.from(machineMap.entries())
      .map(([machine, grams]) => ({
        machine,
        grams: round1(grams),
        hours: round1(machineHoursMap.get(machine) ?? 0),
      }))
      .sort((a, b) => b.grams - a.grams),
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const firebaseConfig = loadFirebaseAppletConfig();
  const { db: adminDb, serviceAccountProjectId } = initAdminFirestore(firebaseConfig);

  let lastAutoSentMonth: string | null = null;
  let lastAutoSentAt: string | null = null;
  let schedulerNoticeLogged = false;

  const checkMonthlyReportSchedule = async () => {
    const now = new Date();
    if (now.getDate() !== 1 || now.getHours() < 8) {
      return;
    }

    const { monthKey, periodLabel } = getPreviousMonthWindow(now);
    if (lastAutoSentMonth === monthKey) {
      return;
    }

    const smtp = getSmtpConfig();
    if (!smtp.configured || !isValidEmail(smtp.defaultRecipient) || !adminDb) {
      if (!schedulerNoticeLogged) {
        schedulerNoticeLogged = true;
        console.info(
          '[Reports] Envio automático mensal (dia 1 às 08:00) aguardando SMTP_USER, SMTP_APP_PASSWORD, REPORT_RECIPIENT_EMAIL e credencial Admin do Firebase.'
        );
      }
      return;
    }

    try {
      const markerRef = adminDb.collection('system_reports').doc(`monthly_${monthKey}`);
      const markerSnap = await markerRef.get();
      if (markerSnap.exists) {
        lastAutoSentMonth = monthKey;
        return;
      }

      const payload = await aggregateMonthFromFirestore(
        adminDb,
        monthKey,
        periodLabel,
        smtp.defaultRecipient
      );
      const result = await sendReportViaSmtp(payload);
      if (result.ok) {
        lastAutoSentMonth = monthKey;
        lastAutoSentAt = new Date().toISOString();
        await markerRef.set({
          monthKey,
          periodLabel,
          recipientEmail: smtp.defaultRecipient,
          totalGrams: payload.totalGrams,
          totalPrints: payload.totalPrints,
          sentAt: lastAutoSentAt,
        });
        console.info(
          `[Reports] Relatório mensal (${periodLabel}) enviado automaticamente para ${smtp.defaultRecipient}.`
        );
      }
    } catch (err) {
      console.error('[Reports] Erro no agendador mensal:', err);
    }
  };

  app.get('/api/reports/status', async (_req, res) => {
    const smtp = getSmtpConfig();
    let firestoreConnectionOk = false;
    let firestoreCheckError: string | null = null;

    if (adminDb) {
      try {
        await adminDb.collection('print_logs').limit(1).get();
        firestoreConnectionOk = true;
      } catch (err) {
        firestoreCheckError = err instanceof Error ? err.message : 'Erro desconhecido no Firestore.';
      }
    }

    res.json({
      ok: true,
      smtpConfigured: smtp.configured,
      defaultRecipient: smtp.defaultRecipient,
      firestoreAdminReady: Boolean(adminDb),
      firestoreConnectionOk,
      serviceAccountProjectId,
      expectedProjectId: firebaseConfig.projectId || null,
      firestoreCheckError,
      scheduleRule: 'Todo dia 1 às 08:00 (resumo do mês anterior)',
      lastAutoSentMonth,
      lastAutoSentAt,
    });
  });

  app.post('/api/reports/send', async (req, res) => {
    const smtp = getSmtpConfig();
    const validation = validateReportPayload(req.body, smtp.defaultRecipient);
    if (!validation.valid || !validation.payload) {
      res.status(400).json({
        ok: false,
        code: 'INVALID_PAYLOAD',
        error: validation.error || 'Dados do relatório inválidos.',
      });
      return;
    }

    const result = await sendReportViaSmtp(validation.payload);
    if (!result.ok) {
      res.status(result.status).json({
        ok: false,
        code: result.code,
        error: result.error,
      });
      return;
    }

    res.json({
      ok: true,
      recipientEmail: validation.payload.recipientEmail,
      periodLabel: validation.payload.periodLabel,
      message: `Relatório (${validation.payload.periodLabel}) enviado com sucesso para ${validation.payload.recipientEmail}.`,
    });
  });

  app.post('/api/reports/pdf', async (req, res) => {
    const smtp = getSmtpConfig();
    const fallback = smtp.defaultRecipient || 'relatorio@samsungocean.local';
    const validation = validateReportPayload(req.body, fallback);
    if (!validation.valid || !validation.payload) {
      res.status(400).json({
        ok: false,
        code: 'INVALID_PAYLOAD',
        error: validation.error || 'Dados do relatório inválidos.',
      });
      return;
    }

    try {
      const pdfBuffer = await generatePowerBiReportPdf(validation.payload);
      const filename = buildReportPdfFilename(validation.payload.periodLabel);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Erro ao gerar PDF.';
      res.status(500).json({
        ok: false,
        code: 'PDF_GENERATION_FAILED',
        error: `Falha ao gerar o PDF do relatório: ${detail}`,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.info(`[Samsung Ocean 3D] Servidor ativo em http://0.0.0.0:${port}`);
    void checkMonthlyReportSchedule();
    setInterval(() => {
      void checkMonthlyReportSchedule();
    }, 10 * 60 * 1000);
  });
}

void startServer();
