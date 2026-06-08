// @ts-nocheck
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable, FlatList, ScrollView, useWindowDimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import EmptyState from '../components/ui/EmptyState';
import SkeletonBar from '../components/ui/SkeletonBar';
import AnimatedListItem from '../components/ui/AnimatedListItem';
import Animated from 'react-native-reanimated';
import KanbanBoard from '../components/ui/KanbanBoard';

const TASK_ROW_HEIGHT = 100;

const TASK_STATUS_I18N = {
  pending: 'tasks.statusPending',
  in_progress: 'tasks.statusInProgress',
  completed: 'tasks.statusCompleted',
  cancelled: 'tasks.statusCancelled'
};

const TASK_PRIORITY_I18N = {
  low: 'tasks.priorityLow',
  medium: 'tasks.priorityMedium',
  high: 'tasks.priorityHigh',
  urgent: 'tasks.priorityUrgent'
};

const SKELETON_TASKS = Array.from({ length: 4 }).map((_, idx) => ({ id: `task-skeleton-${idx}`, __skeleton: true }));

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
      return colors.statusCompleted;
    case 'in_progress':
      return colors.statusInProgress;
    case 'cancelled':
      return colors.statusCancelled;
    case 'pending':
    default:
      return colors.statusPending;
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

const TaskRow = React.memo(({ item, colors, onStatusUpdate, onViewDetails, currentEmployeeId, tr, localeTag, isKanban, columnWidth }) => {
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

  // Responsive styling variables
  const isCompact = isKanban && columnWidth < 260;
  const cardPadding = isKanban ? (columnWidth < 220 ? 8 : 10) : 16;
  const titleSize = isKanban ? (columnWidth < 220 ? 12 : columnWidth < 260 ? 13 : 14) : 16;
  const descSize = isKanban ? (columnWidth < 220 ? 11 : 12) : 14;
  const metaGap = isKanban ? 8 : 16;
  const metaIconSize = isKanban ? 12 : 14;
  const showBtnText = !isCompact;
  const btnPaddingVer = isKanban ? 6 : 8;
  const btnPaddingHor = isKanban ? 8 : 12;
  const btnFontSize = isKanban ? 11 : 14;

  return (
    <View style={[styles.taskCard, { borderColor: colors.border, backgroundColor: colors.card, padding: cardPadding }]}>
      <View style={styles.taskHeader}>
        <View style={styles.taskTitleRow}>
          <Animated.Text
            sharedTransitionTag={`task-title-${item._id}`}
            style={[styles.taskTitle, { color: colors.text, fontSize: titleSize }]}
            numberOfLines={1}
          >
            {item.title}
          </Animated.Text>
          <View style={[styles.priorityBadge, { backgroundColor: getRGBA(priorityColor, 0.15), borderColor: priorityColor, paddingHorizontal: isKanban ? 4 : 8, paddingVertical: isKanban ? 2 : 4 }]}>
            <Text style={[styles.priorityText, { color: priorityColor, fontSize: isKanban ? 8 : 10 }]}>
              {(TASK_PRIORITY_I18N[item.priority] ? tr(TASK_PRIORITY_I18N[item.priority]) : item.priority).toUpperCase()}
            </Text>
          </View>
        </View>
        {!isKanban && (
          <View style={[styles.statusBadge, { backgroundColor: getRGBA(statusColor, 0.15), borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {(TASK_STATUS_I18N[item.status] ? tr(TASK_STATUS_I18N[item.status]) : item.status.replace('_', ' ')).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {item.description ? (
        <Text style={[styles.taskDescription, { color: colors.textSecondary, fontSize: descSize }]} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      <View style={[styles.taskMeta, { gap: metaGap }]}>
        {item.dueDate && (
          <View style={styles.taskMetaItem}>
            <Ionicons name="calendar-outline" size={metaIconSize} color={isOverdue ? colors.danger : colors.textSecondary} />
            <Text style={[styles.taskMetaText, { color: isOverdue ? colors.danger : colors.textSecondary, fontSize: descSize - 2 }]}>
              {tr('myTasks.duePrefix')} {new Date(item.dueDate).toLocaleDateString(localeTag)}
            </Text>
            {isOverdue && !isCompact && (
              <Text style={[styles.overdueText, { color: colors.danger, fontSize: descSize - 2 }]}> {tr('taskDetail.overdue').toUpperCase()}</Text>
            )}
          </View>
        )}
        {item.estimatedHours && (
          <View style={styles.taskMetaItem}>
            <Ionicons name="time-outline" size={metaIconSize} color={colors.textSecondary} />
            <Text style={[styles.taskMetaText, { color: colors.textSecondary, fontSize: descSize - 2 }]}>
              {tr('myTasks.estPrefix')} {item.estimatedHours}h
            </Text>
          </View>
        )}
        {item.category && !isCompact && (
          <View style={styles.taskMetaItem}>
            <Ionicons name="pricetag-outline" size={metaIconSize} color={colors.textSecondary} />
            <Text style={[styles.taskMetaText, { color: colors.textSecondary, fontSize: descSize - 2 }]}>
              {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
            </Text>
          </View>
        )}
      </View>

      {item.notes && !isCompact && (
        <View style={[styles.notesBox, { backgroundColor: getRGBA(colors.primary, 0.05) }]}>
          <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>{tr('myTasks.notesLabel')}</Text>
          <Text style={[styles.notesText, { color: colors.text }]}>{item.notes}</Text>
        </View>
      )}

      <View style={[styles.taskActions, { flexDirection: 'row', gap: 6, flexWrap: 'wrap' }]}>
        <Pressable
          style={[styles.viewDetailsBtn, { backgroundColor: getRGBA(colors.primary, 0.1), borderColor: colors.primary, paddingVertical: btnPaddingVer, paddingHorizontal: btnPaddingHor, marginBottom: 0 }]}
          onPress={() => onViewDetails(item._id)}
        >
          <Ionicons name="eye-outline" size={isKanban ? 13 : 16} color={colors.primary} />
          {showBtnText && <Text style={[styles.viewDetailsText, { color: colors.primary, fontSize: btnFontSize }]}>{tr('tasks.viewDetails')}</Text>}
        </Pressable>
        
        {item.status !== 'completed' && item.status !== 'cancelled' && (
          <View style={[styles.statusActions, { flexDirection: 'row', gap: 6 }]}>
            {/* Only show "Start" button if current user is the assigned employee */}
            {item.status === 'pending' && 
             currentEmployeeId && 
             item.assignedTo?._id && 
             currentEmployeeId.toString() === item.assignedTo._id.toString() && (
              <Pressable
                style={[styles.statusBtn, { backgroundColor: getRGBA(colors.primary, 0.15), borderColor: colors.primary, paddingVertical: btnPaddingVer, paddingHorizontal: btnPaddingHor }]}
                onPress={() => handleStatusChange('in_progress')}
              >
                <Ionicons name="play-outline" size={isKanban ? 13 : 16} color={colors.primary} />
                {showBtnText && <Text style={[styles.statusBtnText, { color: colors.primary, fontSize: btnFontSize }]}>{tr('myTasks.start')}</Text>}
              </Pressable>
            )}
            {item.status === 'in_progress' && (
              <Pressable
                style={[styles.statusBtn, { backgroundColor: getRGBA(colors.success, 0.15), borderColor: colors.success, paddingVertical: btnPaddingVer, paddingHorizontal: btnPaddingHor }]}
                onPress={() => handleStatusChange('completed')}
              >
                <Ionicons name="checkmark-circle-outline" size={isKanban ? 13 : 16} color={colors.success} />
                {showBtnText && <Text style={[styles.statusBtnText, { color: colors.success, fontSize: btnFontSize }]}>{tr('myTasks.complete')}</Text>}
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.item?._id === nextProps.item?._id &&
    prevProps.item?.status === nextProps.item?.status &&
    prevProps.item?.priority === nextProps.item?.priority &&
    prevProps.item?.title === nextProps.item?.title &&
    prevProps.item?.description === nextProps.item?.description &&
    prevProps.item?.dueDate === nextProps.item?.dueDate &&
    prevProps.item?.notes === nextProps.item?.notes &&
    prevProps.item?.estimatedHours === nextProps.item?.estimatedHours &&
    prevProps.item?.category === nextProps.item?.category &&
    prevProps.item?.__skeleton === nextProps.item?.__skeleton &&
    prevProps.colors === nextProps.colors &&
    prevProps.currentEmployeeId === nextProps.currentEmployeeId &&
    prevProps.localeTag === nextProps.localeTag
  );
});
TaskRow.displayName = 'TaskRow';


const MyTasksScreen = () => {
  const { request, user } = useAuth();
  const t = useThemeTokens();
  const { t: tr, locale } = useI18n();
  const { width: windowWidth } = useWindowDimensions();
  const localeTag = locale === 'es' ? 'es-ES' : 'en-US';
  const navigation = useNavigation();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [currentEmployeeId, setCurrentEmployeeId] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'kanban'

  const kanbanColumns = useMemo(() => [
    { key: 'pending', label: tr('tasks.statusPending'), color: t.colors.statusPending },
    { key: 'in_progress', label: tr('tasks.statusInProgress'), color: t.colors.statusInProgress },
    { key: 'completed', label: tr('tasks.statusCompleted'), color: t.colors.statusCompleted }
  ], [tr, t.colors]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      params.append('limit', '100');
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
      setMessage(error.message || tr('myTasks.loadFail'));
    } finally {
      setLoading(false);
    }
  }, [request, statusFilter, user, tr]);

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
      setMessage(tr('myTasks.statusUpdated'));
      loadTasks();
    } catch (error) {
      setMessage(error.message || tr('myTasks.statusUpdateFail'));
    }
  }, [request, loadTasks, tr]);

  const statusOptions = useMemo(
    () => [
      { label: tr('tasks.statusAll'), value: 'all' },
      { label: tr('tasks.statusPending'), value: 'pending' },
      { label: tr('tasks.statusInProgress'), value: 'in_progress' },
      { label: tr('tasks.statusCompleted'), value: 'completed' }
    ],
    [tr]
  );

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

  const keyExtractor = useCallback((item) => (item.__skeleton ? item.id : item._id), []);

  const renderTaskItem = useCallback(({ item, index }) => (
    <AnimatedListItem index={index}>
      <TaskRow
        item={item}
        colors={t.colors}
        onStatusUpdate={handleStatusUpdate}
        onViewDetails={handleViewDetails}
        currentEmployeeId={currentEmployeeId}
        tr={tr}
        localeTag={localeTag}
        isKanban={false}
        columnWidth={windowWidth}
      />
    </AnimatedListItem>
  ), [t.colors, handleStatusUpdate, handleViewDetails, currentEmployeeId, tr, localeTag, windowWidth]);

  const getItemLayout = useCallback((_, index) => ({
    length: TASK_ROW_HEIGHT,
    offset: TASK_ROW_HEIGHT * index,
    index
  }), []);

  return (
    <Screen noScroll={viewMode === 'kanban'}>
      <View style={[styles.container, { backgroundColor: 'transparent', flex: 1 }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.colors.text }]}>{tr('myTasks.screenTitle')}</Text>
          <View style={[styles.toggleContainer, { borderColor: t.colors.border, backgroundColor: getRGBA(t.colors.card, 0.5) }]}>
            <Pressable
              style={[
                styles.toggleBtn,
                viewMode === 'list' && { backgroundColor: t.colors.primary }
              ]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons
                name="list"
                size={16}
                color={viewMode === 'list' ? '#fff' : t.colors.textSecondary}
              />
            </Pressable>
            <Pressable
              style={[
                styles.toggleBtn,
                viewMode === 'kanban' && { backgroundColor: t.colors.primary }
              ]}
              onPress={() => setViewMode('kanban')}
            >
              <Ionicons
                name="grid"
                size={16}
                color={viewMode === 'kanban' ? '#fff' : t.colors.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        {message ? (
          <View style={[styles.messageBox, { backgroundColor: getRGBA(t.colors.primary, 0.1) }]}>
            <Text style={[styles.messageText, { color: t.colors.text }]}>{message}</Text>
            <Pressable onPress={() => setMessage('')}>
              <Ionicons name="close" size={18} color={t.colors.text} />
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.statsContainer, { backgroundColor: t.colors.card, borderColor: t.colors.border, marginBottom: 12 }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: t.colors.text }]}>{stats.total}</Text>
            <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>{tr('myTasks.statTotal')}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: t.colors.warning }]}>{stats.pending}</Text>
            <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>{tr('myTasks.statPending')}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: t.colors.primary }]}>{stats.inProgress}</Text>
            <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>{tr('myTasks.statInProgress')}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: t.colors.statusCompleted }]}>{stats.completed}</Text>
            <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>{tr('myTasks.statCompleted')}</Text>
          </View>
          {stats.overdue > 0 && (
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: t.colors.danger }]}>{stats.overdue}</Text>
              <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>{tr('myTasks.statOverdue')}</Text>
            </View>
          )}
        </View>

        {viewMode === 'list' ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            <Text style={[styles.sectionTitle, { color: t.colors.text }]}>{tr('myTasks.filterByStatus')}</Text>
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
              {tr('myTasks.tasksListTitle', { count: filteredTasks.length })}
            </Text>

            <FlatList
              data={loading ? SKELETON_TASKS : filteredTasks}
              keyExtractor={keyExtractor}
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
                    title={tr('myTasks.emptyTitle')}
                    subtitle={tr('myTasks.emptySubtitle')}
                  />
                ) : null
              }
            />
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>
            <KanbanBoard
              columns={kanbanColumns}
              items={tasks}
              getColId={item => item.status}
              renderItem={(item, layoutInfo) => (
                <TaskRow
                  item={item}
                  colors={t.colors}
                  onStatusUpdate={handleStatusUpdate}
                  onViewDetails={handleViewDetails}
                  currentEmployeeId={currentEmployeeId}
                  tr={tr}
                  localeTag={localeTag}
                  isKanban={layoutInfo?.isKanban}
                  columnWidth={layoutInfo?.columnWidth}
                />
              )}
              onItemDrop={handleStatusUpdate}
              colors={t.colors}
              loading={loading}
              tr={tr}
            />
          </View>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 8
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 2,
    gap: 2
  },
  toggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center'
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
