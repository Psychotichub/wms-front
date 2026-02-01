import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useNotifications } from '../context/NotificationContext';
import EmptyState from '../components/ui/EmptyState';
import SkeletonBar from '../components/ui/SkeletonBar';
import { navigateFromNotification } from '../utils/notificationNavigation';

const NOTIFICATION_ITEM_HEIGHT = 120;

// Helper to convert hex to RGBA for web compatibility
const getRGBA = (hex, alpha) => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex;
  let fullHex = hex;
  if (hex.length === 4) {
    fullHex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  const r = parseInt(fullHex.slice(1, 3), 16);
  const g = parseInt(fullHex.slice(3, 5), 16);
  const b = parseInt(fullHex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getNotificationIcon = (type) => {
  switch (type) {
    case 'task_assigned': return 'clipboard-outline';
    case 'task_completed': return 'checkmark-circle-outline';
    case 'deadline_approaching': return 'alarm-outline';
    case 'deadline_overdue': return 'alert-circle-outline';
    case 'time_approved': return 'thumbs-up-outline';
    case 'time_rejected': return 'thumbs-down-outline';
    case 'system_announcement': return 'megaphone-outline';
    case 'reminder': return 'notifications-outline';
    case 'overtime_alert': return 'time-outline';
    case 'schedule_change': return 'calendar-outline';
    case 'low_stock': return 'warning-outline';
    case 'daily_report_missing': return 'document-text-outline';
    default: return 'notifications-outline';
  }
};

const getNotificationColor = (type, colors) => {
  switch (type) {
    case 'task_assigned': return colors.primary;
    case 'task_completed': return colors.success;
    case 'deadline_approaching': return colors.warning;
    case 'deadline_overdue': return colors.danger;
    case 'time_approved': return colors.success;
    case 'time_rejected': return colors.danger;
    case 'system_announcement': return colors.info;
    case 'reminder': return colors.warning;
    case 'overtime_alert': return colors.warning;
    case 'schedule_change': return colors.info;
    case 'low_stock': return colors.warning;
    case 'daily_report_missing': return colors.danger;
    default: return colors.primary;
  }
};

const formatTimeAgo = (date) => {
  const now = new Date();
  const notificationDate = new Date(date);
  const diffInSeconds = Math.floor((now - notificationDate) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return notificationDate.toLocaleDateString();
};

const NotificationItem = React.memo(({ item, colors, onPress }) => {
  if (item.__skeleton) {
    return (
      <View
        style={[styles.notificationCard, { backgroundColor: getRGBA(colors.card, 0.5), borderColor: colors.border }]}
      >
        <View style={styles.notificationIcon}>
          <SkeletonBar width={24} height={24} />
        </View>
        <View style={styles.notificationContent}>
          <SkeletonBar width="60%" height={12} />
          <SkeletonBar width="90%" height={10} style={{ marginTop: 6 }} />
          <SkeletonBar width="40%" height={10} style={{ marginTop: 6 }} />
        </View>
      </View>
    );
  }

  const color = getNotificationColor(item.type, colors);

  return (
    <Pressable
      style={[
        styles.notificationCard,
        {
          backgroundColor: getRGBA(colors.card, 0.5),
          borderColor: colors.border
        },
        item.status !== 'read' && {
          borderLeftColor: color,
          borderLeftWidth: 4
        }
      ]}
      onPress={() => onPress(item)}
    >
      <View style={styles.notificationIcon}>
        <Ionicons name={getNotificationIcon(item.type)} size={24} color={color} />
      </View>

      <View style={styles.notificationContent}>
        <Text style={[styles.notificationTitle, { color: colors.text }]}>
          {item.title}
        </Text>
        <Text style={[styles.notificationMessage, { color: colors.textSecondary }]}>
          {item.message}
        </Text>
        <View style={styles.notificationMeta}>
          <Text style={[styles.notificationType, {
            color,
            backgroundColor: getRGBA(color, 0.1)
          }]}>
            {item.type.replace('_', ' ').toUpperCase()}
          </Text>
          <Text style={[styles.notificationTime, { color: colors.textSecondary }]}>
            {formatTimeAgo(item.createdAt)}
          </Text>
        </View>
        {item.sender && (
          <Text style={[styles.notificationSender, { color: colors.textSecondary }]}>
            From: {item.sender.name}
          </Text>
        )}
      </View>

      {item.status !== 'read' && (
        <View style={[styles.unreadIndicator, { backgroundColor: colors.primary }]} />
      )}
    </Pressable>
  );
});
NotificationItem.displayName = 'NotificationItem';

const NotificationsScreen = () => {
  const t = useThemeTokens();
  const {
    notifications,
    unreadCount,
    loadNotifications,
    markAsRead,
    markAllAsRead
  } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);
  const isLoading = refreshing && notifications.length === 0;
  const listData = useMemo(() => {
    if (isLoading) {
      return Array.from({ length: 4 }).map((_, idx) => ({ id: `skeleton-${idx}`, __skeleton: true }));
    }
    return notifications;
  }, [isLoading, notifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications(1, 20);
    setRefreshing(false);
  };

  const handleMarkAllRead = () => {
    const isWeb = Platform.OS === 'web';
    
    if (isWeb) {
      const shouldMarkAll = window.confirm('Are you sure you want to mark all notifications as read?');
      if (shouldMarkAll) {
        markAllAsRead();
      }
    } else {
      // For iOS and Android, use Alert.alert
      Alert.alert(
        'Mark All as Read',
        'Are you sure you want to mark all notifications as read?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark All Read',
            onPress: markAllAsRead
          }
        ]
      );
    }
  };

  const handleNotificationPress = useCallback((notification) => {
    // Mark as read
    markAsRead(notification._id);
    // Navigate to related screen
    navigateFromNotification(notification);
  }, [markAsRead]);

  const renderItem = useCallback(
    ({ item }) => (
      <NotificationItem item={item} colors={t.colors} onPress={handleNotificationPress} />
    ),
    [handleNotificationPress, t.colors]
  );
  const getItemLayout = useCallback((_, index) => ({
    length: NOTIFICATION_ITEM_HEIGHT,
    offset: NOTIFICATION_ITEM_HEIGHT * index,
    index
  }), []);

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.colors.text }]}>
            Notifications
          </Text>
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: t.colors.primary }]}>
              <Text style={[styles.badgeText, { color: '#fff' }]}>
                {unreadCount}
              </Text>
            </View>
          )}
          {notifications.length > 0 && (
            <Pressable
              style={[styles.markAllBtn, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}
              onPress={handleMarkAllRead}
            >
              <Text style={[styles.markAllText, { color: t.colors.text }]}>
                Mark All Read
              </Text>
            </Pressable>
          )}
        </View>

        {/* Notifications List */}
        <FlatList
          data={listData}
          keyExtractor={(item) => (item.__skeleton ? item.id : item._id)}
          style={styles.notificationsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={t.colors.primary}
            />
          }
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          ListEmptyComponent={
            !isLoading ? (
              <EmptyState
                icon="notifications-off-outline"
                title="No notifications yet"
                subtitle="You'll receive notifications for tasks, deadlines, and system updates here."
              />
            ) : null
          }
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  badge: {
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  notificationsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    position: 'relative',
    minHeight: NOTIFICATION_ITEM_HEIGHT - 8,
  },
  notificationIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notificationType: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  notificationTime: {
    fontSize: 12,
  },
  notificationSender: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  unreadIndicator: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
});

export default NotificationsScreen;
