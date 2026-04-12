import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@wms_offline_queue_v1';
const MAX_ITEMS = 40;

export type QueuedMutation = {
  id: string;
  path: string;
  method: string;
  body: string | null;
  headers: Record<string, string>;
  createdAt: number;
};

async function loadAll(): Promise<QueuedMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedMutation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAll(items: QueuedMutation[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
}

export async function enqueueOfflineMutation(payload: {
  path: string;
  method: string;
  body: string | null;
  headers?: Record<string, string>;
}): Promise<void> {
  const list = await loadAll();
  const item: QueuedMutation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    path: payload.path,
    method: payload.method,
    body: payload.body,
    headers: { 'Content-Type': 'application/json', ...(payload.headers || {}) },
    createdAt: Date.now()
  };
  list.push(item);
  await saveAll(list);
}

export async function drainOfflineQueue(
  requestFn: (path: string, options: Record<string, unknown>) => Promise<unknown>
): Promise<{ ok: number; fail: number }> {
  const list = await loadAll();
  if (list.length === 0) return { ok: 0, fail: 0 };
  await AsyncStorage.removeItem(STORAGE_KEY);
  const failed: QueuedMutation[] = [];
  let ok = 0;
  for (const item of list) {
    try {
      await requestFn(item.path, {
        method: item.method,
        body: item.body || undefined,
        headers: item.headers
      });
      ok += 1;
    } catch {
      failed.push(item);
    }
  }
  if (failed.length) {
    await saveAll(failed);
  }
  return { ok, fail: failed.length };
}
