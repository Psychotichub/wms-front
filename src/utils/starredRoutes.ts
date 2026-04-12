import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@wms_starred_routes_v1';
const MAX = 20;

const SKIP = new Set([
  'Login',
  'Signup',
  'EmailVerification',
  'Access Denied',
  'Global Search',
  'Notifications',
  'Task Detail'
]);

export async function loadStarredRoutes(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as string[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function saveAll(list: string[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export async function toggleStarredRoute(
  name: string | null | undefined
): Promise<{ starred: boolean; routes: string[] }> {
  if (!name || SKIP.has(name)) {
    return { starred: false, routes: await loadStarredRoutes() };
  }
  const cur = await loadStarredRoutes();
  const idx = cur.indexOf(name);
  let next: string[];
  let starred: boolean;
  if (idx >= 0) {
    next = cur.filter((n) => n !== name);
    starred = false;
  } else {
    next = [name, ...cur.filter((n) => n !== name)].slice(0, MAX);
    starred = true;
  }
  await saveAll(next);
  return { starred, routes: next };
}

export async function isRouteStarred(name: string | null | undefined): Promise<boolean> {
  if (!name) return false;
  const cur = await loadStarredRoutes();
  return cur.includes(name);
}

export function isSkippableStarRoute(name: string | null | undefined): boolean {
  return !name || SKIP.has(name);
}
