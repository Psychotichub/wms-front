import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable, FlatList, ScrollView } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import EmptyState from '../components/ui/EmptyState';
import SkeletonBar from '../components/ui/SkeletonBar';

const TASK_ROW_HEIGHT = 100;

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

const getStatusColor = (status, colors) => {
  switch (status) {
    case 'completed':
      return colors.success;
    case 'in_progress':
      return colors.primary;
    case 'cancelled':
      return colors.danger;
    case 'pending':
    default:
      return colors.warning;
  }
};

const getPriorityColor = (priority, colors) => {
  switch (priority) {
    case 'urgent':
      return colors.danger;
    case 'high':
      return colors.warning;
    case 'medium':
      return colors.primary;
    case 'low':
    default:
      return colors.textSecondary;
  }
};

const TaskRow = React.memo(({ item, colors, onStatusUpdate, onViewDetails, currentEmployeeId }) => {
  if (item.__skeleton) {
    return (
      <View style={[styles.taskCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.taskHeader}>
          <SkeletonBar width="60%" height={16} />
          <SkeletonBar width="30%" height={12} />
        </View>
        <SkeletonBar width="80%" height={12} />
        <SkeletonBar width="50%" height={12} />
      </View>
    );
  }

  const statusColor = getStatusColor(item.status, colors);
  const priorityColor = getPriorityColor(item.priority, colors);
  const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status !== 'completed';

  const handleStatusChange = (newStatus) => {
    if (onStatusUpdate) {
      onStatusUpdate(item._id, newStatus);
    }
  };

  return (
    <View style={[styles.taskCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.taskHeader}>
        <View style={styles.taskTitleRow}>
          <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={[styles.priorityBadge, { backgroundColor: getRGBA(priorityColor, 0.15), borderColor: priorityColor }]}>
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {item.priority.toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getRGBA(statusColor, 0.15), borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {item.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      {item.description ? (
        <Text style={[styles.taskDescription, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      <View style={styles.taskMeta}>
        {item.dueDate && (
          <View style={styles.taskMetaItem}>
            <Ionicons name="calendar-outline" size={14} color={isOverdue ? colors.danger : colors.textSecondary} />
            <Text style={[styles.taskMetaText, { color: isOverdue ? colors.danger : colors.textSecondary }]}>
              Due: {new Date(item.dueDate).toLocaleDateString()}
            </Text>
            {isOverdue && (
              <Text style={[styles.overdueText, { color: colors.danger }]}> OVERDUE</Text>
            )}
          </View>
        )}
        {item.estimatedHours && (
          <View style={styles.taskMetaItem}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.taskMetaText, { color: colors.textSecondary }]}>
              Est: {item.estimatedHours}h
            </Text>
          </View>
        )}
        {item.category && (
          <View style={styles.taskMetaItem}>
            <Ionicons name="pricetag-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.taskMetaText, { color: colors.textSecondary }]}>
              {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
            </Text>
          </View>
        )}
      </View>

      {item.notes && (
        <View style={[styles.notesBox, { backgroundColor: getRGBA(colors.primary, 0.05) }]}>
          <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>Notes:</Text>
          <Text style={[styles.notesText, { color: colors.text }]}>{item.notes}</Text>
        </View>
      )}

      <View style={styles.taskActions}>
        <Pressable
          style={[styles.viewDetailsBtn, { backgroundColor: getRGBA(colors.primary, 0.1), borderColor: colors.primary }]}
          onPress={() => onViewDetails(item._id)}
        >
          <Ionicons name="eye-outline" size={16} color={colors.primary} />
          <Text style={[styles.viewDetailsText, { color: colors.primary }]}>View Details</Text>
        </Pressable>
        
        {item.status !== 'completed' && item.status !== 'cancelled' && (
          <View style={styles.statusActions}>
            {/* Only show "Start" button if current user is the assigned employee */}
            {item.status === 'pending' && 
             currentEmployeeId && 
             item.assignedTo?._id && 
             currentEmployeeId.toString() === item.assignedTo._id.toString() && (
              <Pressable
                style={[styles.statusBtn, { backgroundColor: getRGBA(colors.primary, 0.15), borderColor: colors.primary }]}
                onPress={() => handleStatusChange('in_progress')}
              >
                <Ionicons name="play-outline" size={16} color={colors.primary} />
                <Text style={[styles.statusBtnText, { color: colors.primary }]}>Start</Text>
              </Pressable>
            )}
            {item.status === 'in_progress' && (
              <Pressable
                style={[styles.statusBtn, { backgroundColor: getRGBA(colors.success, 0.15), borderColor: colors.success }]}
                onPress={() => handleStatusChange('completed')}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                <Text style={[styles.statusBtnText, { color: colors.success }]}>Complete</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
});
TaskRow.displayName = 'TaskRow';

const MyTasksScreen = () => {
  const { request, user } = useAuth();
  const t = useThemeTokens();
  const navigation = useNavigation();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [currentEmployeeId, setCurrentEmployeeId] = useState(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      const data = await request(`/api/tasks?${params.toString()}`);
      setTasks(data.tasks || []);
      
      // Load current user's employee ID to check if they can start tasks
      try {
        const employeesData = await request('/api/employees');
        const currentEmployee = employeesData.employees?.find(
          emp => emp.user === (user?.id || user?._id)
        );
        if (currentEmployee) {
          setCurrentEmployeeId(currentEmployee._id);
        }
      } catch (empErr) {
        // Silently fail - employee check is optional
        console.warn('Could not load employee info:', empErr);
      }
    } catch (error) {
      setMessage(error.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [request, statusFilter, user]);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  const handleStatusUpdate = useCallback(async (taskId, newStatus) => {
    try {
      await request(`/api/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      setMessage('Task status updated successfully');
      loadTasks();
    } catch (error) {
      setMessage(error.message || 'Failed to update task status');
    }
  }, [request, loadTasks]);

  const statusOptions = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Completed', value: 'completed' }
  ];

  const filteredTasks = useMemo(() => {
    return tasks;
  }, [tasks]);

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed').length
    };
  }, [tasks]);

  const handleViewDetails = useCallback((taskId) => {
    navigation.navigate('Task Detail', { taskId });
  }, [navigation]);

  const renderTaskItem = useCallback(({ item }) => (
    <TaskRow
      item={item}
      colors={t.colors}
      onStatusUpdate={handleStatusUpdate}
      onViewDetails={handleViewDetails}
      currentEmployeeId={currentEmployeeId}
    />
  ), [t.colors, handleStatusUpdate, handleViewDetails, currentEmployeeId]);

  const getItemLayout = useCallback((_, index) => ({
    length: TASK_ROW_HEIGHT,
    offset: TASK_ROW_HEIGHT * index,
    index
  }), []);

  return (
    <Screen>
      <ScrollView style={[styles.container, { backgroundColor: t.colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.colors.text }]}>My Tasks</Text>
        </View>

        {message ? (
          <View style={[styles.messageBox, { backgroundColor: getRGBA(t.colors.primary, 0.1) }]}>
            <Text style={[styles.messageText, { color: t.colors.text }]}>{message}</Text>
            <Pressable onPress={() => setMessage('')}>
              <Ionicons name="close" size={18} color={t.colors.text} />
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.statsContainer, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: t.colors.text }]}>{stats.total}</Text>
            <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: t.colors.warning }]}>{stats.pending}</Text>
            <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>Pending</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: t.colors.primary }]}>{stats.inProgress}</Text>
            <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>In Progress</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: t.colors.success }]}>{stats.completed}</Text>
            <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>Completed</Text>
          </View>
          {stats.overdue > 0 && (
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: t.colors.danger }]}>{stats.overdue}</Text>
              <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>Overdue</Text>
            </View>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: t.colors.text }]}>Filter by Status</Text>
        <View style={styles.roleRow}>
          {statusOptions.map((option) => (
            <Pressable
              key={option.value}
              style={[
                styles.roleChip,
                { borderColor: t.colors.border, backgroundColor: t.colors.card },
                statusFilter === option.value && {
                  borderColor: t.colors.primary,
                  backgroundColor: getRGBA(t.colors.primary, 0.1)
                }
              ]}
              onPress={() => setStatusFilter(option.value)}
            >
              <Text
                style={[
                  styles.roleText,
                  { color: t.colors.text },
                  statusFilter === option.value && { color: t.colors.primary, fontWeight: '700' }
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: t.colors.text }]}>
          Tasks ({filteredTasks.length})
        </Text>

        <FlatList
          data={loading ? Array.from({ length: 4 }).map((_, idx) => ({ id: `task-skeleton-${idx}`, __skeleton: true })) : filteredTasks}
          keyExtractor={(item) => (item.__skeleton ? item.id : item._id)}
          scrollEnabled={false}
          contentContainerStyle={styles.taskList}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews
          renderItem={renderTaskItem}
          getItemLayout={getItemLayout}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon="checkmark-done-outline"
                title="No tasks assigned"
                subtitle="You don't have any tasks yet. Check back later!"
              />
            ) : null
          }
        />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 32
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  title: {
    fontSize: 24,
    fontWeight: '700'
  },
  messageBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16
  },
  messageText: {
    flex: 1,
    fontSize: 14
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20
  },
  statItem: {
    alignItems: 'center'
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4
  },
  statLabel: {
    fontSize: 12
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1
  },
  roleText: {
    fontSize: 14
  },
  taskList: {
    gap: 12
  },
  taskCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700'
  },
  taskDescription: {
    fontSize: 14,
    marginBottom: 8
  },
  taskMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12
  },
  taskMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  taskMetaText: {
    fontSize: 12
  },
  overdueText: {
    fontSize: 12,
    fontWeight: '700'
  },
  notesBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4
  },
  notesText: {
    fontSize: 14
  },
  taskActions: {
    marginTop: 12,
    gap: 8
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginBottom: 8
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600'
  },
  statusActions: {
    flexDirection: 'row',
    gap: 8
  },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1
  },
  statusBtnText: {
    fontSize: 14,
    fontWeight: '600'
  }
});

export default MyTasksScreen;
