import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  DEFAULT_PEOPLE,
  getMonthKey,
  sanitizeDocId,
  type MaterialType,
  type PersonRecord,
  type PrintLogRecord,
} from '../lib/filamentLogic';
import {
  OperationType,
  auth,
  db,
  handleFirestoreError,
  signInWithGoogle,
  signOutFirebase,
  testFirestoreConnection,
} from '../lib/firebase';

export interface NewPrintPayload {
  machine: string;
  person: string;
  project: string;
  durationHours: number;
  isMultiColor: boolean;
  lines: Array<{
    material: MaterialType;
    color: string;
    grams: number;
  }>;
}

export function useLabData() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [logs, setLogs] = useState<PrintLogRecord[]>([]);
  const [people, setPeople] = useState<PersonRecord[]>([]);

  const isCloudConnected = Boolean(user && user.emailVerified);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (currentUser && !currentUser.emailVerified) {
        setAuthError('Sua conta Google precisa ter o e-mail verificado para acessar o laboratório.');
        setLoading(false);
      } else if (!currentUser) {
        setLogs([]);
        setPeople([]);
        setSyncError(null);
        setLoading(false);
      } else {
        setAuthError(null);
        void testFirestoreConnection();
      }
    });
    return () => unsubscribe();
  }, []);

  const ensureDefaultPeopleInFirestore = useCallback(async (uid: string) => {
    const peopleRef = collection(db, 'people');
    const q = query(peopleRef, where('visibility', '==', 'lab'));
    try {
      const snap = await getDocs(q);
      if (snap.empty) {
        const batch = writeBatch(db);
        for (const name of DEFAULT_PEOPLE) {
          const id = sanitizeDocId(name);
          batch.set(doc(db, 'people', id), {
            name,
            normalizedName: name.toLowerCase(),
            visibility: 'lab',
            createdByUid: uid,
            createdAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'people');
    }
  }, []);

  useEffect(() => {
    if (!authReady || !isCloudConnected || !user) {
      return;
    }

    setLoading(true);
    setSyncError(null);
    void ensureDefaultPeopleInFirestore(user.uid);

    const logsQuery = query(collection(db, 'print_logs'), where('visibility', '==', 'lab'));
    const unsubLogs = onSnapshot(
      logsQuery,
      (snapshot) => {
        const items: PrintLogRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          const ts = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
          return {
            id: d.id,
            machine: String(data.machine ?? ''),
            person: String(data.person ?? ''),
            project: String(data.project ?? ''),
            material: data.material as MaterialType,
            color: String(data.color ?? ''),
            grams: Number(data.grams ?? 0),
            durationHours: Number(data.durationHours ?? 0),
            isMultiColor: Boolean(data.isMultiColor),
            batchId: String(data.batchId ?? d.id),
            monthKey: String(data.monthKey ?? getMonthKey(new Date(ts))),
            createdAtMs: ts,
          };
        });
        items.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setLogs(items);
        setLoading(false);
      },
      (error) => {
        setSyncError('Erro ao sincronizar histórico com o Firebase.');
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'print_logs');
      }
    );

    const peopleQuery = query(collection(db, 'people'), where('visibility', '==', 'lab'));
    const unsubPeople = onSnapshot(
      peopleQuery,
      (snapshot) => {
        const list: PersonRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          const name = String(data.name ?? '');
          return {
            id: d.id,
            name,
            normalizedName: String(data.normalizedName ?? name.toLowerCase()),
          };
        });
        list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        setPeople(list);
      },
      (error) => {
        setSyncError('Erro ao sincronizar utilizadores com o Firebase.');
        handleFirestoreError(error, OperationType.LIST, 'people');
      }
    );

    return () => {
      unsubLogs();
      unsubPeople();
    };
  }, [authReady, isCloudConnected, user, ensureDefaultPeopleInFirestore]);

  const addPrintLogs = useCallback(
    async (payload: NewPrintPayload) => {
      if (!isCloudConnected || !user) {
        throw new Error('Autenticação necessária para registar impressões.');
      }

      const now = new Date();
      const nowMs = now.getTime();
      const monthKey = getMonthKey(now);
      const batchId = `batch-${nowMs}-${Math.random().toString(36).slice(2, 7)}`;

      try {
        const batch = writeBatch(db);
        payload.lines.forEach((line, idx) => {
          const logId = `log-${nowMs}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
          batch.set(doc(db, 'print_logs', logId), {
            machine: payload.machine,
            person: payload.person,
            project: payload.project.trim(),
            material: line.material,
            color: line.color,
            grams: line.grams,
            durationHours: payload.durationHours,
            isMultiColor: payload.isMultiColor,
            batchId,
            monthKey,
            visibility: 'lab',
            createdByUid: user.uid,
            createdAt: serverTimestamp(),
          });
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'print_logs');
      }
    },
    [isCloudConnected, user]
  );

  const deletePrintLog = useCallback(
    async (logId: string) => {
      if (!isCloudConnected) return;
      try {
        await deleteDoc(doc(db, 'print_logs', logId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `print_logs/${logId}`);
      }
    },
    [isCloudConnected]
  );

  const addPerson = useCallback(
    async (rawName: string): Promise<{ ok: boolean; error?: string }> => {
      if (!isCloudConnected || !user) {
        return { ok: false, error: 'Faça login para adicionar utilizadores.' };
      }

      const trimmed = rawName.trim();
      if (!trimmed) {
        return { ok: false, error: 'Informe um nome válido.' };
      }
      if (trimmed.length > 80) {
        return { ok: false, error: 'Nome deve ter no máximo 80 caracteres.' };
      }
      const normalized = trimmed.toLowerCase();
      if (people.some((p) => p.normalizedName === normalized)) {
        return { ok: false, error: 'Esta pessoa já está cadastrada.' };
      }

      const baseId = sanitizeDocId(trimmed);
      const uniqueId = people.some((p) => p.id === baseId)
        ? `${baseId}-${Date.now().toString(36)}`
        : baseId;

      try {
        await setDoc(doc(db, 'people', uniqueId), {
          name: trimmed,
          normalizedName: normalized,
          visibility: 'lab',
          createdByUid: user.uid,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `people/${uniqueId}`);
      }
      return { ok: true };
    },
    [people, isCloudConnected, user]
  );

  const removePerson = useCallback(
    async (personId: string) => {
      if (!isCloudConnected) return;
      try {
        await deleteDoc(doc(db, 'people', personId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `people/${personId}`);
      }
    },
    [isCloudConnected]
  );

  const restoreDefaultPeople = useCallback(async () => {
    if (!isCloudConnected || !user) return;
    const existingNormalized = new Set(people.map((p) => p.normalizedName));
    const missing = DEFAULT_PEOPLE.filter((name) => !existingNormalized.has(name.toLowerCase()));
    if (missing.length === 0) return;

    try {
      const batch = writeBatch(db);
      for (const name of missing) {
        const id = sanitizeDocId(name);
        batch.set(doc(db, 'people', id), {
          name,
          normalizedName: name.toLowerCase(),
          visibility: 'lab',
          createdByUid: user.uid,
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'people');
    }
  }, [people, isCloudConnected, user]);

  const connectFirebase = useCallback(async () => {
    setAuthError(null);
    setSyncError(null);
    setIsAuthenticating(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha na autenticação Google.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('Não foi possível concluir o login com o Google. Verifique se o popup não foi bloqueado.');
      }
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const disconnectFirebase = useCallback(async () => {
    await signOutFirebase();
  }, []);

  return {
    user,
    authReady,
    authError,
    isAuthenticating,
    isCloudConnected,
    loading,
    syncError,
    logs,
    people,
    addPrintLogs,
    deletePrintLog,
    addPerson,
    removePerson,
    restoreDefaultPeople,
    connectFirebase,
    disconnectFirebase,
  };
}
