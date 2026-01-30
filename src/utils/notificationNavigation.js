import { navigationRef } from '../navigation/navigationRef';

/**
 * Navigate to the relevant screen based on notification type and data
 * @param {Object} notification - The notification object
 */
export const navigateFromNotification = (notification) => {
  if (!notification) return;

  const { type, relatedEntity, data } = notification;
  const navigation = navigationRef.current;

  if (!navigation || !navigation.navigate) {
    console.warn('Navigation not available');
    return;
  }

  try {
    // Get the entity ID from relatedEntity or data
    const entityId = relatedEntity?.id || data?.taskId || data?.timeEntryId || data?.entityId;

    // Map notification types to screens
    switch (type) {
      case 'task_assigned':
      case 'task_completed':
      case 'deadline_approaching':
      case 'deadline_overdue':
        // If we have a task ID, navigate to task detail, otherwise to My Tasks
        if (entityId && relatedEntity?.type === 'task') {
          navigation.navigate('Task Detail', { taskId: entityId });
        } else {
          navigation.navigate('My Tasks');
        }
        break;

      case 'time_approved':
      case 'time_rejected':
        // Time tracking removed - stay on notifications screen
        break;

      case 'daily_report_missing':
        // Navigate to Daily Report screen
        navigation.navigate('Daily Report');
        break;

      case 'low_stock':
      case 'inventory_exceeded':
        // Navigate to Inventory screen
        navigation.navigate('Inventory');
        break;

      case 'contract_exceeded':
        // Navigate to Contract Quantity screen (admin only)
        // Note: This will show Access Denied if user is not admin
        navigation.navigate('Contract Quantity');
        break;

      case 'system_announcement':
      case 'reminder':
      case 'overtime_alert':
      case 'schedule_change':
        // For general notifications, check if there's a specific action in data
        if (data?.action === 'view_tasks') {
          navigation.navigate('My Tasks');
        } else if (data?.action === 'view_report') {
          navigation.navigate('Daily Report');
        } else if (data?.action === 'view_inventory') {
          navigation.navigate('Inventory');
        }
        // Otherwise, stay on notifications screen (no navigation)
        break;

      default:
        // Unknown notification type - stay on notifications screen
        break;
    }
  } catch (error) {
    console.warn('Failed to navigate from notification:', error);
  }
};
