const QUEUE_KEY = 'sowa_offline_queue';
const OFFLINE_STUDENTS_KEY = 'sowa_offline_students';

export interface QueuedOperation {
  id: string;
  url: string;
  method: string;
  body: unknown;
  timestamp: number;
  retryCount: number;
  type: string;
}

export interface OfflineStudent {
  offlineId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  email?: string;
  classId: string;
  schoolId?: string;
  dateOfBirth?: string;
  parentWhatsapp?: string;
  address?: string;
  createdAt: number;
  queueOperationId: string;
}

export interface SyncStatus {
  syncing: boolean;
  pendingCount: number;
  justSynced: boolean;
  studentsChanged?: boolean;
  succeededCount?: number;
  failedCount?: number;
  droppedCount?: number;
  stillPendingFailures?: number;
  networkFailures?: number;
}

type SyncListener = (status: SyncStatus) => void;

const listeners: SyncListener[] = [];
let isSyncing = false;

export function addSyncListener(fn: SyncListener) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

function notify(status: SyncStatus) {
  listeners.forEach(fn => fn(status));
}

function getQueue(): QueuedOperation[] {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedOperation[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
  }
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getPendingCount(): number {
  return getQueue().length;
}

export function enqueueOperation(url: string, method: string, body: unknown, type = 'generic'): QueuedOperation {
  return enqueue(url, method, body, type);
}

function enqueue(url: string, method: string, body: unknown, type = 'generic'): QueuedOperation {
  const op: QueuedOperation = {
    id: generateId(),
    url,
    method,
    body,
    timestamp: Date.now(),
    retryCount: 0,
    type,
  };
  const queue = getQueue();
  queue.push(op);
  saveQueue(queue);
  notify({ syncing: false, pendingCount: queue.length, justSynced: false });
  return op;
}

type ReplayResult = 'success' | 'server-failure' | 'network-failure';

async function replayOperation(op: QueuedOperation, token: string | null): Promise<ReplayResult> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(op.url, {
      method: op.method,
      headers,
      body: op.body ? JSON.stringify(op.body) : undefined,
      credentials: 'include',
    });

    if (res.ok || res.status === 404) return 'success';

    // Treat the service worker's offline stub as a network failure so we
    // don't burn through the retry budget when there's actually no connection.
    if (res.status === 503) {
      try {
        const data = await res.clone().json();
        if (data && (data.offline === true || data.error === 'offline')) {
          return 'network-failure';
        }
      } catch {
        // fall through
      }
    }

    return 'server-failure';
  } catch {
    return 'network-failure';
  }
}

export async function processOfflineQueue(opts: { force?: boolean } = {}): Promise<void> {
  if (isSyncing) return;
  if (!opts.force && !navigator.onLine) return;
  const queue = getQueue();
  if (queue.length === 0) return;

  isSyncing = true;
  notify({ syncing: true, pendingCount: queue.length, justSynced: false });

  const token = localStorage.getItem('auth_token');
  const remaining: QueuedOperation[] = [];

  let studentsChanged = false;
  let succeededCount = 0;
  let droppedCount = 0;
  let stillPendingFailures = 0;
  let networkFailures = 0;
  for (const op of queue) {
    const result = await replayOperation(op, token);
    if (result === 'success') {
      succeededCount += 1;
      if (op.type === 'create-student') {
        removeOfflineStudentByQueueId(op.id);
        studentsChanged = true;
      }
    } else if (result === 'server-failure') {
      op.retryCount += 1;
      if (op.retryCount < 5) {
        remaining.push(op);
        stillPendingFailures += 1;
      } else {
        droppedCount += 1;
      }
    } else {
      // Network failure: keep the item in the queue without consuming its
      // retry budget so we don't lose work when there's no connectivity.
      remaining.push(op);
      networkFailures += 1;
    }
  }

  saveQueue(remaining);
  isSyncing = false;
  const failedCount = droppedCount + stillPendingFailures + networkFailures;
  notify({
    syncing: false,
    pendingCount: remaining.length,
    justSynced: true,
    studentsChanged,
    succeededCount,
    failedCount,
    droppedCount,
    stillPendingFailures,
    networkFailures,
  });

  setTimeout(() => {
    notify({ syncing: false, pendingCount: remaining.length, justSynced: false });
  }, 4000);
}

export async function queuedApiRequest(
  url: string,
  options?: { method?: string; body?: unknown },
  operationType = 'generic'
): Promise<any> {
  const method = options?.method || 'GET';
  const token = localStorage.getItem('auth_token');

  const headers: Record<string, string> = {};
  if (options?.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // If definitely offline, queue immediately (non-GET only)
  if (!navigator.onLine) {
    if (method !== 'GET') {
      const op = enqueue(url, method, options?.body, operationType);
      return { queued: true, offlineId: op.id, message: 'Saved offline. Will sync when connected.' };
    }
    throw new Error('Offline: no cached data available');
  }

  // navigator.onLine can lie (e.g. WiFi with no internet) — add a hard 8-second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: options?.body instanceof FormData
        ? options.body
        : options?.body ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text}`);
    }

    return res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);

    // Network error or timeout — treat as offline for mutations
    const isNetworkError = err?.name === 'AbortError' || err?.name === 'TypeError';
    if (isNetworkError && method !== 'GET') {
      const op = enqueue(url, method, options?.body, operationType);
      return { queued: true, offlineId: op.id, message: 'Saved offline. Will sync when connected.' };
    }

    throw err;
  }
}

export function getOfflineStudents(): OfflineStudent[] {
  try {
    const stored = localStorage.getItem(OFFLINE_STUDENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveOfflineStudent(studentData: Record<string, any>, queueOperationId: string): OfflineStudent {
  const student: OfflineStudent = {
    offlineId: `PENDING-${Date.now()}`,
    firstName: studentData.firstName || '',
    lastName: studentData.lastName || '',
    middleName: studentData.middleName,
    email: studentData.email,
    classId: studentData.classId || '',
    schoolId: studentData.schoolId,
    dateOfBirth: studentData.dateOfBirth,
    parentWhatsapp: studentData.parentWhatsapp || studentData.parentWhatsApp,
    address: studentData.address,
    createdAt: Date.now(),
    queueOperationId,
  };
  const students = getOfflineStudents();
  students.push(student);
  localStorage.setItem(OFFLINE_STUDENTS_KEY, JSON.stringify(students));
  return student;
}

function removeOfflineStudentByQueueId(queueOperationId: string): void {
  const students = getOfflineStudents().filter(s => s.queueOperationId !== queueOperationId);
  localStorage.setItem(OFFLINE_STUDENTS_KEY, JSON.stringify(students));
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setTimeout(() => processOfflineQueue(), 1000);
  });
  window.addEventListener('app:api-online', () => {
    setTimeout(() => processOfflineQueue(), 500);
  });
}
