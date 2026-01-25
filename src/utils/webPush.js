import { Platform } from 'react-native';

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export async function registerWebPush({ vapidPublicKey }) {
  if (Platform.OS !== 'web') return null;
  if (!vapidPublicKey) return null;
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;
  if (!('PushManager' in window)) return null;

  // Permissions
  if (!('Notification' in window)) return null;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return null;

  // Register SW (must be served at root for scope '/')
  const registration = await navigator.serviceWorker.register('/service-worker.js');
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  return subscription;
}


