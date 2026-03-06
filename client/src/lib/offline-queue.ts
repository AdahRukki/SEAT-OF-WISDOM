const QUEUE_KEY = 'sowa_offline_queue';

export interface QueuedOperation {
  id: string;
  url: string;
  method: string;
  body: unknown;
  timestamp: number;
  retryCount: number;
  type: string;
}

type SyncListener = (status: { syncing: boolean; pendingCount: number; justSynced: boolean }) => void;

const listeners: SyncListener[] = [];
let isSyncing = false;

export function addSyncListener(fn: SyncListener) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

function notify(status: { syncing: boolean; pendingCount: number; justSynced: boolean }) {
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

async function replayOperation(op: QueuedOperation, token: string | null): Promise<boolean> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(op.url, {
      method: op.method,
      headers,
      body: op.body ? JSON.stringify(op.body) : undefined,
      credentials: 'include',
    });

    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

export async function processOfflineQueue(): Promise<void> {
  if (isSyncing || !navigator.onLine) return;
  const queue = getQueue();
  if (queue.length === 0) return;

  isSyncing = true;
  notify({ syncing: true, pendingCount: queue.length, justSynced: false });

  const token = localStorage.getItem('auth_token');
  const remaining: QueuedOperation[] = [];

  for (const op of queue) {
    const success = await replayOperation(op, token);
    if (!success) {
      op.retryCount += 1;
      if (op.retryCount < 5) remaining.push(op);
    }
  }

  saveQueue(remaining);
  isSyncing = false;
  notify({ syncing: false, pendingCount: remaining.length, justSynced: true });

  setTimeout(() => {
    notify({ syncing: false, pendingCount: remaining.length, justSynced: false });
  }, 3000);
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

  if (!navigator.onLine) {
    if (method !== 'GET') {
      const op = enqueue(url, method, options?.body, operationType);
      return { queued: true, offlineId: op.id, message: 'Saved offline. Will sync when connected.' };
    }
    throw new Error('Offline: no cached data available');
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options?.body instanceof FormData
      ? options.body
      : options?.body ? JSON.stringify(options.body) : undefined,
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }

  return res.json();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setTimeout(processOfflineQueue, 1000);
  });
}
