import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from './AuthContext';
import { registerWebPush } from '../utils/webPush';
import { logError } from '../utils/telemetry';
import { getWebPushVapidPublicKey } from '../config/runtime';
import { navigateFromNotification } from '../utils/notificationNavigation';

const NotificationContext = createContext();

// Detect if running in Expo Go (limited notification support in SDK 53)
const isExpoGo = () => {
  // Expo Go has limited push notification support in SDK 53+
  // Check if we're in a managed workflow (Expo Go)
  return Constants.executionEnvironment === 'storeClient' ||
         Constants.appOwnership === 'expo' ||
         !Constants.expoConfig?.hostUri; // No hostUri indicates Expo Go
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Configure notification behavior (native only; skip web + Expo Go due to SDK limitations)
if (Platform.OS !== 'web' && !isExpoGo()) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (_error) {
    // Silently handle notification setup errors
  }
}

export const NotificationProvider = ({ children }) => {
  const { user, token, isAuthReady, request, apiUrl } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushToken, setPushToken] = useState(null);
  const [preferences, setPreferences] = useState({
    pushEnabled: true,
    notificationTypes: {
      task_assigned: true,
      task_completed: true,
      deadline_approaching: true,
      deadline_overdue: true,
      time_approved: true,
      time_rejected: true,
      system_announcement: true,
      reminder: true,
      overtime_alert: true,
      schedule_change: true,
      low_stock: true,
      daily_report_missing: true,
      contract_exceeded: true,
      inventory_exceeded: true,
      attendance_checkin: true,
      attendance_checkout: true
    }
  });

  // Register for push notifications
  const registerForPushNotificationsAsync = async () => {
    if (Platform.OS === 'web') {
      // Web does not use Expo push tokens; avoid noisy warnings.
      return;
    }
    if (isExpoGo()) {
      // Skip push notifications in Expo Go (limited SDK 53 support)
      return;
    }

    if (!Device.isDevice) {
      return;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return;
      }

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      setPushToken(token);

      // Send token to backend if user is logged in
      if (user && token) {
        try {
          await request('/api/notifications/preferences/push-token', {
            method: 'POST',
            body: JSON.stringify({ pushToken: token }),
            __suppress401Log: true
          });
        } catch (_error) {
          // Silently handle token update errors
        }
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
    } catch (error) {
      await logError({
        error,
        level: 'warn',
        context: 'Notification.registerPush',
        apiUrl
      });
    }
  };

  // Register for Web Push notifications (browser push)
  const registerForWebPushNotificationsAsync = async () => {
    if (Platform.OS !== 'web') return;
    if (!isAuthReady || !token || !user) return;

    const vapidPublicKey = getWebPushVapidPublicKey();
    if (!vapidPublicKey) {
      // Web Push is optional - fail silently if not configured
      return;
    }

    try {
      const subscription = await registerWebPush({ vapidPublicKey });
      if (!subscription) return;
      await request('/api/notifications/preferences/web-push-subscription', {
        method: 'POST',
        body: JSON.stringify({ subscription }),
        __suppress401Log: true
      });
    } catch (error) {
      const msg = error?.message || '';
      const isAuthError =
        error?.status === 401 ||
        msg.includes('Refresh token revoked') ||
        msg.includes('session has expired') ||
        msg.includes('Authentication required');
      const isAbortError = error?.name === 'AbortError';
      if (!isAuthError && !isAbortError) {
        await logError({
          error,
          level: 'warn',
          context: 'Notification.registerWebPush',
          apiUrl
        });
      }
    }
  };

  // Load notifications
  const loadNotifications = async (page = 1, limit = 20) => {
    if (!isAuthReady || !token) return;
    try {
      const response = await request(
        `/api/notifications?page=${page}&limit=${limit}`,
        { __suppress401Log: true }
      );
      if (page === 1) {
        setNotifications(response.notifications || []);
      } else {
        setNotifications(prev => [...prev, ...(response.notifications || [])]);
      }
      setUnreadCount(response.unreadCount || 0);
    } catch (_error) {
      // Silently handle notification loading errors
    }
  };

  // Load notification preferences
  const loadPreferences = async () => {
    if (!isAuthReady || !token) return;
    try {
      const response = await request('/api/notifications/preferences', {
        __suppress401Log: true
      });
      setPreferences(response.preferences);
    } catch (_error) {
      // Silently handle preference loading errors
    }
  };

  // Update notification preferences
  const updatePreferences = async (newPreferences) => {
    if (!isAuthReady || !token) {
      throw new Error('Not authenticated');
    }
    try {
      const response = await request('/api/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify(newPreferences),
        __suppress401Log: true
      });
      setPreferences(response.preferences);
    } catch (error) {
      throw error;
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    if (!isAuthReady || !token) return;
    try {
      await request(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        __suppress401Log: true
      });
      setNotifications(prev =>
        prev.map(notif =>
          notif._id === notificationId
            ? { ...notif, status: 'read', readAt: new Date() }
            : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (_error) {
      // Silently handle mark as read errors
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!isAuthReady || !token) return;
    try {
      await request('/api/notifications/read-all', {
        method: 'PUT',
        __suppress401Log: true
      });
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, status: 'read', readAt: new Date() }))
      );
      setUnreadCount(0);
    } catch (_error) {
      // Silently handle mark all as read errors
    }
  };

  // Send notification (admin function)
  const sendNotification = async (notificationData) => {
    if (!isAuthReady || !token) {
      throw new Error('Not authenticated');
    }
    try {
      const response = await request('/api/notifications/send', {
        method: 'POST',
        body: JSON.stringify(notificationData),
        __suppress401Log: true
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  // Send broadcast notification (admin function)
  const sendBroadcast = async (broadcastData) => {
    if (!isAuthReady || !token) {
      throw new Error('Not authenticated');
    }
    try {
      const response = await request('/api/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify(broadcastData),
        __suppress401Log: true
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  // Set up notification listeners (intentionally run once)
  useEffect(() => {
    if (isExpoGo()) {
      return;
    }

    let notificationListener, responseListener;

    try {
      // Handle notification received while app is foregrounded
      notificationListener = Notifications.addNotificationReceivedListener(notification => {
        // Refresh notifications (only if authenticated)
        if (isAuthReady && token) {
          loadNotifications();
        }
      });

      // Handle notification tapped
      responseListener = Notifications.addNotificationResponseReceivedListener(async response => {
        const notificationData = response.notification.request.content.data;
        const { notificationId, type, ...restData } = notificationData || {};
        
        if (notificationId && isAuthReady && token) {
          markAsRead(notificationId);
          
          // Try to fetch full notification data for navigation
          try {
            const notification = notifications.find(n => n._id === notificationId);
            if (notification) {
              navigateFromNotification(notification);
            } else {
              // If notification not in list, create a minimal notification object from push data
              navigateFromNotification({
                type: type || 'system_announcement',
                data: restData,
                relatedEntity: restData.relatedEntity
              });
            }
          } catch (error) {
            // If navigation fails, at least we marked it as read
            console.warn('Failed to navigate from notification:', error);
          }
        }
      });
    } catch (_error) {
      // Silently handle listener setup errors
    }

    return () => {
      try {
        if (notificationListener && typeof notificationListener.remove === 'function') {
          notificationListener.remove();
        }
        if (responseListener && typeof responseListener.remove === 'function') {
          responseListener.remove();
        }
      } catch (_error) {
        // Silently handle listener removal errors
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize when user logs in
  // Intentionally keyed only on user; avoid reloading on function identity changes.
  useEffect(() => {
    if (isAuthReady && token && user) {
      registerForPushNotificationsAsync();
      registerForWebPushNotificationsAsync();
      loadNotifications();
      loadPreferences();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token, isAuthReady]);

  const value = {
    notifications,
    unreadCount,
    preferences,
    pushToken,
    loadNotifications,
    loadPreferences,
    updatePreferences,
    markAsRead,
    markAllAsRead,
    sendNotification,
    sendBroadcast
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
