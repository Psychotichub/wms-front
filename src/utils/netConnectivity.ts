import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

/** Web: do not rely on NetInfo reachability probes (HEAD / external URLs often fail or are blocked). */
export function isWebNavigatorOnline(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

/** Interpret NetInfo snapshot for “can use network” (native includes isInternetReachable). */
export function isOnlineFromNetInfoState(state: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  if (Platform.OS === 'web') {
    return state.isConnected !== false;
  }
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/** For enqueue-offline gating: web uses navigator.onLine only; native uses NetInfo.fetch. */
export async function isOfflineForMutationQueue(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return !isWebNavigatorOnline();
  }
  const net = await NetInfo.fetch();
  return net.isConnected === false || net.isInternetReachable === false;
}
