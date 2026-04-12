// @ts-nocheck
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, FlatList } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import Button from '../components/ui/Button';
import AutocompleteInput from '../components/ui/AutocompleteInput';
import EmptyState from '../components/ui/EmptyState';
import SkeletonBar from '../components/ui/SkeletonBar';
import AnimatedListItem from '../components/ui/AnimatedListItem';

const TASK_ROW_HEIGHT = 80;

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

const TaskRow = React.memo(({ item, colors, onEdit, onViewDetails, tr }) => {
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

  return (
    <View style={[styles.taskCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.taskHeader}>
        <View style={styles.taskTitleRow}>
          <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={[styles.priorityBadge, { backgroundColor: getRGBA(priorityColor, 0.15), borderColor: priorityColor }]}>
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {(TASK_PRIORITY_I18N[item.priority] ? tr(TASK_PRIORITY_I18N[item.priority]) : item.priority).toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getRGBA(statusColor, 0.15), borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {(TASK_STATUS_I18N[item.status] ? tr(TASK_STATUS_I18N[item.status]) : item.status.replace('_', ' ')).toUpperCase()}
          </Text>
        </View>
      </View>

      {item.description ? (
        <Text style={[styles.taskDescription, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      <View style={styles.taskMeta}>
        <View style={styles.taskMetaItem}>
          <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.taskMetaText, { color: colors.textSecondary }]}>
            {item.assignedTo?.name || tr('tasks.unassigned')}
          </Text>
        </View>
        {item.dueDate && (
          <View style={styles.taskMetaItem}>
            <Ionicons name="calendar-outline" size={14} color={isOverdue ? colors.danger : colors.textSecondary} />
            <Text style={[styles.taskMetaText, { color: isOverdue ? colors.danger : colors.textSecondary }]}>
              {new Date(item.dueDate).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.taskActions}>
        <Pressable
          style={[styles.viewDetailsBtn, { backgroundColor: getRGBA(colors.primary, 0.1), borderColor: colors.primary }]}
          onPress={() => onViewDetails(item._id)}
        >
          <Ionicons name="eye-outline" size={16} color={colors.primary} />
          <Text style={[styles.viewDetailsText, { color: colors.primary }]}>View Details</Text>
        </Pressable>
        {item.status !== 'completed' && (
          <Pressable
            style={[styles.actionBtn, { backgroundColor: getRGBA(colors.primary, 0.12) }]}
            onPress={() => onEdit(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="create-outline" size={18} color={colors.primary} />
          </Pressable>
        )}
      </View>
    </View>
  );
});
TaskRow.displayName = 'TaskRow';

const TaskScreen = () => {
  const { request, user } = useAuth();
  const t = useThemeTokens();
  const { t: tr } = useI18n();
  const navigation = useNavigation();
  const isAdmin = user?.role === 'admin';

  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Helper to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'medium',
    dueDate: getTodayDate(),
    category: 'other',
    estimatedHours: '',
    notes: ''
  });

  const priorityOptions = useMemo(
    () => [
      { label: tr('tasks.priorityLow'), value: 'low' },
      { label: tr('tasks.priorityMedium'), value: 'medium' },
      { label: tr('tasks.priorityHigh'), value: 'high' },
      { label: tr('tasks.priorityUrgent'), value: 'urgent' }
    ],
    [tr]
  );

  const categoryOptions = useMemo(
    () => [
      { label: tr('tasks.catInstallation'), value: 'installation' },
      { label: tr('tasks.catMaintenance'), value: 'maintenance' },
      { label: tr('tasks.catInspection'), value: 'inspection' },
      { label: tr('tasks.catRepair'), value: 'repair' },
      { label: tr('tasks.catDelivery'), value: 'delivery' },
      { label: tr('tasks.catOther'), value: 'other' }
    ],
    [tr]
  );

  const statusOptions = useMemo(
    () => [
      { label: tr('tasks.statusAll'), value: 'all' },
      { label: tr('tasks.statusPending'), value: 'pending' },
      { label: tr('tasks.statusInProgress'), value: 'in_progress' },
      { label: tr('tasks.statusCompleted'), value: 'completed' },
      { label: tr('tasks.statusCancelled'), value: 'cancelled' }
    ],
    [tr]
  );

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
    } catch (error) {
      setMessage(error.message || tr('tasks.loadFail'));
    } finally {
      setLoading(false);
    }
  }, [request, statusFilter, tr]);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await request('/api/employees');
      setEmployees(data.employees || []);
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  }, [request]);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) {
        loadTasks();
        loadEmployees();
      }
    }, [loadTasks, loadEmployees, isAdmin])
  );

  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    if (searchValue.trim()) {
      const search = searchValue.toLowerCase();
      filtered = filtered.filter(
        task =>
          task.title?.toLowerCase().includes(search) ||
          task.description?.toLowerCase().includes(search) ||
          task.assignedTo?.name?.toLowerCase().includes(search)
      );
    }
    return filtered;
  }, [tasks, searchValue]);

  const employeeOptions = useMemo(() => {
    return employees
      .filter(emp => emp.isActive)
      .map(emp => ({
        label: `${emp.name} (${emp.email})`,
        value: emp._id
      }));
  }, [employees]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      assignedTo: '',
      priority: 'medium',
      dueDate: getTodayDate(),
      category: 'other',
      estimatedHours: '',
      notes: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      setMessage(tr('tasks.titleRequired'));
      return;
    }
    if (!formData.assignedTo) {
      setMessage(tr('tasks.selectEmployee'));
      return;
    }

    try {
      const payload = {
        ...formData,
        estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : undefined,
        dueDate: formData.dueDate || undefined
      };

      if (editingId) {
        await request(`/api/tasks/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        setMessage(tr('tasks.updated'));
      } else {
        await request('/api/tasks', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setMessage(tr('tasks.created'));
      }

      resetForm();
      loadTasks();
    } catch (error) {
      setMessage(error.message || tr('tasks.saveFail'));
    }
  };

  const handleEdit = useCallback((task) => {
    setFormData({
      title: task.title || '',
      description: task.description || '',
      assignedTo: task.assignedTo?._id || task.assignedTo || '',
      priority: task.priority || 'medium',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      category: task.category || 'other',
      estimatedHours: task.estimatedHours ? String(task.estimatedHours) : '',
      notes: task.notes || ''
    });
    setEditingId(task._id);
    setShowForm(true);
  }, []);

  const handleViewDetails = useCallback((taskId) => {
    navigation.navigate('Task Detail', { taskId });
  }, [navigation]);

  const renderTaskItem = useCallback(({ item, index }) => (
    <AnimatedListItem index={index}>
      <TaskRow
        item={item}
        colors={t.colors}
        onEdit={handleEdit}
        onViewDetails={handleViewDetails}
        tr={tr}
      />
    </AnimatedListItem>
  ), [t.colors, handleEdit, handleViewDetails, tr]);

  const getItemLayout = useCallback((_, index) => ({
    length: TASK_ROW_HEIGHT,
    offset: TASK_ROW_HEIGHT * index,
    index
  }), []);

  if (!isAdmin) {
    return (
      <Screen>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed-outline" size={48} color={t.colors.textSecondary} />
          <Text style={[styles.accessDeniedText, { color: t.colors.text }]}>{tr('tasks.adminOnly')}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        style={[styles.container, { backgroundColor: t.colors.background }]}
        data={loading ? Array.from({ length: 4 }).map((_, idx) => ({ id: `task-skeleton-${idx}`, __skeleton: true })) : filteredTasks}
        keyExtractor={(item) => (item.__skeleton ? item.id : item._id)}
        contentContainerStyle={{ paddingBottom: 32 }}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        renderItem={renderTaskItem}
        getItemLayout={getItemLayout}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: t.colors.text }]}>{tr('tasks.screenTitle')}</Text>
              <Pressable
                style={[styles.addBtn, { backgroundColor: t.colors.primary }]}
                onPress={() => {
                  if (!showForm) {
                    setFormData({
                      title: '',
                      description: '',
                      assignedTo: '',
                      priority: 'medium',
                      dueDate: getTodayDate(),
                      category: 'other',
                      estimatedHours: '',
                      notes: ''
                    });
                    setEditingId(null);
                  }
                  setShowForm(!showForm);
                }}
              >
                <Ionicons name={showForm ? 'close' : 'add'} size={20} color="#fff" />
                <Text style={styles.addBtnText}>{showForm ? tr('tasks.cancel') : tr('tasks.newTask')}</Text>
              </Pressable>
            </View>

            {message ? (
              <View style={[styles.messageBox, { backgroundColor: getRGBA(t.colors.primary, 0.1) }]}>
                <Text style={[styles.messageText, { color: t.colors.text }]}>{message}</Text>
                <Pressable onPress={() => setMessage('')}>
                  <Ionicons name="close" size={18} color={t.colors.text} />
                </Pressable>
              </View>
            ) : null}

            {showForm && (
              <View style={[styles.form, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
                <Text style={[styles.formTitle, { color: t.colors.text }]}>
                  {editingId ? tr('tasks.editFormTitle') : tr('tasks.createFormTitle')}
                </Text>

                <Text style={[styles.label, { color: t.colors.text }]}>{tr('tasks.labelTitle')}</Text>
                <TextInput
                  style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
                  placeholder={tr('tasks.placeholderTitle')}
                  value={formData.title}
                  onChangeText={(text) => setFormData({ ...formData, title: text })}
                  placeholderTextColor={t.colors.textSecondary}
                />

                <Text style={[styles.label, { color: t.colors.text }]}>{tr('tasks.labelDescription')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
                  placeholder={tr('tasks.placeholderDesc')}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholderTextColor={t.colors.textSecondary}
                  multiline
                  numberOfLines={3}
                />

                <Text style={[styles.label, { color: t.colors.text }]}>{tr('tasks.labelAssignTo')}</Text>
                <AutocompleteInput
                  data={employeeOptions}
                  value={formData.assignedTo ? employeeOptions.find(e => e.value === formData.assignedTo)?.label || '' : ''}
                  onChange={(text) => {
                    const found = employeeOptions.find(e => e.label.toLowerCase().includes(text.toLowerCase()));
                    if (found) {
                      setFormData({ ...formData, assignedTo: found.value });
                    }
                  }}
                  onSelect={(item) => {
                    setFormData({ ...formData, assignedTo: item.value });
                  }}
                  placeholder={tr('tasks.placeholderEmployee')}
                  containerStyle={{ marginBottom: 12, zIndex: 1000, elevation: 1000 }}
                />

                <Text style={[styles.label, { color: t.colors.text }]}>Priority</Text>
                <View style={styles.roleRow}>
                  {priorityOptions.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.roleChip,
                        { borderColor: t.colors.border, backgroundColor: t.colors.card },
                        formData.priority === option.value && {
                          borderColor: getPriorityColor(option.value, t.colors),
                          backgroundColor: getRGBA(getPriorityColor(option.value, t.colors), 0.1)
                        }
                      ]}
                      onPress={() => setFormData({ ...formData, priority: option.value })}
                    >
                      <Text
                        style={[
                          styles.roleText,
                          { color: t.colors.text },
                          formData.priority === option.value && { color: getPriorityColor(option.value, t.colors), fontWeight: '700' }
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.label, { color: t.colors.text }]}>{tr('tasks.labelDueDate')}</Text>
                <TextInput
                  style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
                  placeholder={tr('tasks.placeholderDate')}
                  value={formData.dueDate}
                  onChangeText={(text) => setFormData({ ...formData, dueDate: text })}
                  placeholderTextColor={t.colors.textSecondary}
                />

                <Text style={[styles.label, { color: t.colors.text }]}>Category</Text>
                <View style={styles.roleRow}>
                  {categoryOptions.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.roleChip,
                        { borderColor: t.colors.border, backgroundColor: t.colors.card },
                        formData.category === option.value && {
                          borderColor: t.colors.primary,
                          backgroundColor: getRGBA(t.colors.primary, 0.1)
                        }
                      ]}
                      onPress={() => setFormData({ ...formData, category: option.value })}
                    >
                      <Text
                        style={[
                          styles.roleText,
                          { color: t.colors.text },
                          formData.category === option.value && { color: t.colors.primary, fontWeight: '700' }
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.label, { color: t.colors.text }]}>{tr('tasks.labelEstimatedHours')}</Text>
                <TextInput
                  style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
                  placeholder={tr('tasks.placeholderHours')}
                  value={formData.estimatedHours}
                  onChangeText={(text) => setFormData({ ...formData, estimatedHours: text })}
                  placeholderTextColor={t.colors.textSecondary}
                  keyboardType="numeric"
                />

                <Text style={[styles.label, { color: t.colors.text }]}>{tr('tasks.labelNotes')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
                  placeholder={tr('tasks.placeholderNotes')}
                  value={formData.notes}
                  onChangeText={(text) => setFormData({ ...formData, notes: text })}
                  placeholderTextColor={t.colors.textSecondary}
                  multiline
                  numberOfLines={2}
                />

                <View style={styles.formActions}>
                  <Button title={tr('tasks.cancel')} onPress={resetForm} variant="secondary" />
                  <Button title={editingId ? tr('tasks.updateTask') : tr('tasks.createTask')} onPress={handleSubmit} />
                </View>
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: t.colors.text }]}>{tr('tasks.searchSection')}</Text>
            <AutocompleteInput
              data={filteredTasks.map((task) => task.title)}
              value={searchValue}
              onChange={setSearchValue}
              onSelect={(item) => setSearchValue(item.label)}
              placeholder={tr('tasks.searchPlaceholder')}
              containerStyle={{ marginBottom: 12 }}
            />

            <Text style={[styles.sectionTitle, { color: t.colors.text }]}>{tr('tasks.filterSection')}</Text>
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
              {tr('tasks.tasksListTitle', { count: filteredTasks.length })}
            </Text>
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="checkmark-done-outline"
              title={tr('tasks.emptyTitle')}
              subtitle={tr('tasks.emptySubtitle')}
            />
          ) : null
        }
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14
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
  form: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top'
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
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8
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
  taskActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600'
  },
  actionBtn: {
    padding: 8,
    borderRadius: 6
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32
  },
  accessDeniedText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center'
  }
});

export default TaskScreen;
