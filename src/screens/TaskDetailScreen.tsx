// @ts-nocheck
import React, { useCallback, useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import Button from '../components/ui/Button';
import AutocompleteInput from '../components/ui/AutocompleteInput';

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

const TaskDetailScreen = () => {
  const { request, user } = useAuth();
  const t = useThemeTokens();
  const { t: tr, locale } = useI18n();
  const localeTag = locale === 'es' ? 'es-ES' : 'en-US';
  const navigation = useNavigation();
  const route = useRoute();
  const taskId = route.params?.taskId;

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [currentEmployeeId, setCurrentEmployeeId] = useState(null);
  const [currentEmployeeRole, setCurrentEmployeeRole] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [transferEmployeeId, setTransferEmployeeId] = useState('');
  const [transferEmployeeDisplay, setTransferEmployeeDisplay] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [transferring, setTransferring] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isAssignedEmployee = currentEmployeeId && task?.assignedTo?._id && 
    currentEmployeeId.toString() === task.assignedTo._id.toString();

  const loadTask = useCallback(async () => {
    if (!taskId) {
      setError(tr('taskDetail.taskIdRequired'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Load task
      const data = await request(`/api/tasks/${taskId}`);
      setTask(data.task);
      
      // Load current user's employee ID and all employees for transfer
      try {
        const employeesData = await request('/api/employees');
        setEmployees(employeesData.employees || []);
        const currentEmployee = employeesData.employees?.find(
          emp => emp.user === (user?.id || user?._id)
        );
        if (currentEmployee) {
          setCurrentEmployeeId(currentEmployee._id);
          setCurrentEmployeeRole(currentEmployee.role);
        }
      } catch (empErr) {
        // Silently fail - employee check is optional
        console.warn('Could not load employee info:', empErr);
      }
    } catch (err) {
      setError(err.message || tr('taskDetail.loadFail'));
    } finally {
      setLoading(false);
    }
  }, [request, taskId, user, tr]);

  useFocusEffect(
    useCallback(() => {
      loadTask();
    }, [loadTask])
  );

  const handleStatusUpdate = async (newStatus) => {
    // Only the assigned employee can start a task (change status to 'in_progress')
    if (newStatus === 'in_progress' && task?.assignedTo?._id) {
      if (!currentEmployeeId || task.assignedTo._id.toString() !== currentEmployeeId.toString()) {
        Alert.alert(tr('common.permissionDenied'), tr('taskDetail.onlyAssignee'));
        return;
      }
    }

    if (!isAdmin && newStatus !== 'in_progress' && newStatus !== 'completed') {
      Alert.alert(tr('common.permissionDenied'), tr('taskDetail.statusDenied'));
      return;
    }

    setUpdating(true);
    try {
      await request(`/api/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      await loadTask();
      Alert.alert(tr('common.success'), tr('taskDetail.statusOk'));
    } catch (err) {
      Alert.alert(tr('common.error'), err.message || tr('taskDetail.statusFail'));
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return tr('common.notSet');
    return new Date(dateString).toLocaleDateString(localeTag, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return tr('common.notSet');
    return new Date(dateString).toLocaleString(localeTag, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleTransfer = async () => {
    if (!transferEmployeeId) {
      Alert.alert('Error', 'Please select an employee to transfer the task to');
      return;
    }
    if (!transferNote || transferNote.trim().length < 10) {
      Alert.alert('Error', 'Please provide a transfer note (at least 10 characters) explaining why you are transferring this task');
      return;
    }

    setTransferring(true);
    try {
      await request(`/api/tasks/${taskId}/transfer`, {
        method: 'POST',
        body: JSON.stringify({
          newEmployeeId: transferEmployeeId,
          transferNote: transferNote.trim()
        })
      });
      setShowTransferModal(false);
      setTransferEmployeeId('');
      setTransferEmployeeDisplay('');
      setTransferNote('');
      await loadTask();
      Alert.alert(tr('common.success'), tr('taskDetail.transferOk'));
    } catch (err) {
      Alert.alert(tr('common.error'), err.message || tr('taskDetail.transferFail'));
    } finally {
      setTransferring(false);
    }
  };

  // Filter employees based on transfer rules:
  // - Workers can only transfer to workers
  // - Managers can only transfer to managers
  // - Supervisors can only transfer to supervisors
  // - Admins can transfer to anyone
  const employeeOptions = useMemo(() => {
    let filtered = employees.filter(emp => {
      // Exclude current assigned employee
      if (emp._id === task?.assignedTo?._id) return false;
      
      // If admin, can transfer to anyone
      if (isAdmin) return true;
      
      // If current employee role is set, filter by role
      if (currentEmployeeRole) {
        // Worker can only transfer to worker
        if (currentEmployeeRole === 'worker') {
          return emp.role === 'worker';
        }
        // Manager can only transfer to manager
        if (currentEmployeeRole === 'manager') {
          return emp.role === 'manager';
        }
        // Supervisor can only transfer to supervisor
        if (currentEmployeeRole === 'supervisor') {
          return emp.role === 'supervisor';
        }
      }
      
      return true;
    });
    
    return filtered.map(emp => ({
      label: `${emp.name}${emp.email ? ` (${emp.email})` : ''}${emp.role ? ` - ${emp.role}` : ''}`,
      value: emp._id
    }));
  }, [employees, task?.assignedTo?._id, currentEmployeeRole, isAdmin]);

  const transferEmptyHint = useMemo(() => {
    let extra = '';
    if (currentEmployeeRole === 'worker') extra = tr('taskDetail.transferRuleWorker');
    else if (currentEmployeeRole === 'manager') extra = tr('taskDetail.transferRuleManager');
    else if (currentEmployeeRole === 'supervisor') extra = tr('taskDetail.transferRuleSupervisor');
    return `${tr('taskDetail.noEmployeesTransfer')} ${extra}`.trim();
  }, [currentEmployeeRole, tr]);

  if (loading) {
    return (
      <Screen>
        <View style={[styles.centerContainer, { backgroundColor: 'transparent' }]}>
          <ActivityIndicator size="large" color={t.colors.primary} />
          <Text style={[styles.loadingText, { color: t.colors.textSecondary }]}>{tr('taskDetail.loading')}</Text>
        </View>
      </Screen>
    );
  }

  if (error || !task) {
    return (
      <Screen>
        <View style={[styles.centerContainer, { backgroundColor: 'transparent' }]}>
          <Ionicons name="alert-circle-outline" size={48} color={t.colors.danger} />
          <Text style={[styles.errorText, { color: t.colors.danger }]}>
            {error || tr('taskDetail.notFound')}
          </Text>
          <Button
            title={tr('taskDetail.goBack')}
            onPress={() => navigation.goBack()}
            style={{ marginTop: 16 }}
          />
        </View>
      </Screen>
    );
  }

  const statusColor = getStatusColor(task.status, t.colors);
  const priorityColor = getPriorityColor(task.priority, t.colors);
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

  return (
    <Screen>
      <ScrollView style={[styles.container, { backgroundColor: 'transparent' }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={t.colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: t.colors.text }]}>{tr('taskDetail.headerTitle')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Task Card */}
        <View style={[styles.taskCard, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          {/* Title and Status */}
          <View style={styles.titleRow}>
            <Text style={[styles.taskTitle, { color: t.colors.text }]}>{task.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getRGBA(statusColor, 0.15), borderColor: statusColor }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {(TASK_STATUS_I18N[task.status] ? tr(TASK_STATUS_I18N[task.status]) : task.status.replace('_', ' ')).toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Priority Badge */}
          <View style={styles.badgeRow}>
            <View style={[styles.priorityBadge, { backgroundColor: getRGBA(priorityColor, 0.15), borderColor: priorityColor }]}>
              <Ionicons name="flag-outline" size={14} color={priorityColor} />
              <Text style={[styles.priorityText, { color: priorityColor }]}>
                {(TASK_PRIORITY_I18N[task.priority] ? tr(TASK_PRIORITY_I18N[task.priority]) : task.priority).toUpperCase()}{' '}
                {tr('taskDetail.prioritySuffix').toUpperCase()}
              </Text>
            </View>
            {isOverdue && (
              <View style={[styles.overdueBadge, { backgroundColor: getRGBA(t.colors.danger, 0.15), borderColor: t.colors.danger }]}>
                <Ionicons name="alert-circle-outline" size={14} color={t.colors.danger} />
                <Text style={[styles.overdueText, { color: t.colors.danger }]}>{tr('taskDetail.overdue').toUpperCase()}</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {task.description && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: t.colors.text }]}>{tr('taskDetail.sectionDescription')}</Text>
              <Text style={[styles.sectionContent, { color: t.colors.textSecondary }]}>
                {task.description}
              </Text>
            </View>
          )}

          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: t.colors.text }]}>{tr('taskDetail.sectionBasicInfo')}</Text>
            
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={18} color={t.colors.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: t.colors.textSecondary }]}>{tr('taskDetail.assignedTo')}</Text>
                <Text style={[styles.infoValue, { color: t.colors.text }]}>
                  {task.assignedTo?.name || tr('taskDetail.unknown')}
                </Text>
              </View>
            </View>

            {task.assignedBy && (
              <View style={styles.infoRow}>
                <Ionicons name="person-add-outline" size={18} color={t.colors.textSecondary} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: t.colors.textSecondary }]}>{tr('taskDetail.assignedBy')}</Text>
                  <Text style={[styles.infoValue, { color: t.colors.text }]}>
                    {task.assignedBy?.name || tr('taskDetail.unknown')}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.infoRow}>
              <Ionicons name="pricetag-outline" size={18} color={t.colors.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: t.colors.textSecondary }]}>{tr('taskDetail.category')}</Text>
                <Text style={[styles.infoValue, { color: t.colors.text }]}>
                  {task.category ? task.category.charAt(0).toUpperCase() + task.category.slice(1) : tr('taskDetail.categoryOther')}
                </Text>
              </View>
            </View>

            {task.location && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color={t.colors.textSecondary} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: t.colors.textSecondary }]}>{tr('taskDetail.location')}</Text>
                  <Text style={[styles.infoValue, { color: t.colors.text }]}>
                    {task.location?.name || task.location?.address || tr('taskDetail.unknown')}
                  </Text>
                </View>
              </View>
            )}

            {task.site && (
              <View style={styles.infoRow}>
                <Ionicons name="business-outline" size={18} color={t.colors.textSecondary} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: t.colors.textSecondary }]}>Site</Text>
                  <Text style={[styles.infoValue, { color: t.colors.text }]}>{task.site}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Dates */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: t.colors.text }]}>{tr('taskDetail.sectionDatesTime')}</Text>
            
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={18} color={isOverdue ? t.colors.danger : t.colors.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: t.colors.textSecondary }]}>{tr('taskDetail.dueDate')}</Text>
                <Text style={[styles.infoValue, { color: isOverdue ? t.colors.danger : t.colors.text }]}>
                  {formatDate(task.dueDate)}
                </Text>
              </View>
            </View>

            {task.estimatedHours && (
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={18} color={t.colors.textSecondary} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: t.colors.textSecondary }]}>{tr('taskDetail.estimatedHours')}</Text>
                  <Text style={[styles.infoValue, { color: t.colors.text }]}>
                    {task.estimatedHours} {tr('taskDetail.hoursUnit')}
                  </Text>
                </View>
              </View>
            )}

            {task.actualHours && (
              <View style={styles.infoRow}>
                <Ionicons name="hourglass-outline" size={18} color={t.colors.textSecondary} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: t.colors.textSecondary }]}>{tr('taskDetail.actualHours')}</Text>
                  <Text style={[styles.infoValue, { color: t.colors.text }]}>
                    {task.actualHours} {tr('taskDetail.hoursUnit')}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.infoRow}>
              <Ionicons name="create-outline" size={18} color={t.colors.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: t.colors.textSecondary }]}>{tr('taskDetail.createdAt')}</Text>
                <Text style={[styles.infoValue, { color: t.colors.text }]}>
                  {formatDateTime(task.createdAt)}
                </Text>
              </View>
            </View>

            {task.completedAt && (
              <View style={styles.infoRow}>
                <Ionicons name="checkmark-circle-outline" size={18} color={t.colors.success} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: t.colors.textSecondary }]}>{tr('taskDetail.completedAt')}</Text>
                  <Text style={[styles.infoValue, { color: t.colors.text }]}>
                    {formatDateTime(task.completedAt)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Notes */}
          {task.notes && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: t.colors.text }]}>{tr('taskDetail.sectionNotes')}</Text>
              <View style={[styles.notesBox, { backgroundColor: getRGBA(t.colors.primary, 0.05) }]}>
                <Text style={[styles.notesText, { color: t.colors.text }]}>{task.notes}</Text>
              </View>
            </View>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: t.colors.text }]}>{tr('taskDetail.sectionTags')}</Text>
              <View style={styles.tagsContainer}>
                {task.tags.map((tag, index) => (
                  <View
                    key={index}
                    style={[styles.tag, { backgroundColor: getRGBA(t.colors.primary, 0.1), borderColor: t.colors.primary }]}
                  >
                    <Text style={[styles.tagText, { color: t.colors.primary }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Related Materials */}
          {task.relatedMaterials && task.relatedMaterials.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: t.colors.text }]}>{tr('taskDetail.relatedMaterials')}</Text>
              {task.relatedMaterials.map((item, index) => (
                <View key={index} style={[styles.materialItem, { borderColor: t.colors.border }]}>
                  <Text style={[styles.materialName, { color: t.colors.text }]}>
                    {item.material?.name || 'Unknown Material'}
                  </Text>
                  <Text style={[styles.materialQuantity, { color: t.colors.textSecondary }]}>
                    Quantity: {item.quantity || 0} {item.material?.unit || ''}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Checklist */}
          {task.checklist && task.checklist.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: t.colors.text }]}>{tr('taskDetail.sectionChecklist')}</Text>
              {task.checklist.map((item, index) => (
                <View key={index} style={styles.checklistItem}>
                  <Ionicons
                    name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={item.completed ? t.colors.success : t.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.checklistText,
                      { color: item.completed ? t.colors.textSecondary : t.colors.text },
                      item.completed && styles.checklistTextCompleted
                    ]}
                  >
                    {item.item}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Status Actions - Only for non-completed/cancelled tasks */}
          {task.status !== 'completed' && task.status !== 'cancelled' && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: t.colors.text }]}>{tr('taskDetail.sectionActions')}</Text>
              <View style={styles.actionsContainer}>
                {/* Only show "Start Task" button if current user is the assigned employee */}
                {task.status === 'pending' && 
                 currentEmployeeId && 
                 task.assignedTo?._id && 
                 currentEmployeeId.toString() === task.assignedTo._id.toString() && (
                  <Button
                    title={tr('taskDetail.startTask')}
                    onPress={() => handleStatusUpdate('in_progress')}
                    disabled={updating}
                    style={[styles.actionButton, { backgroundColor: t.colors.primary }]}
                    textStyle={{ color: '#fff' }}
                  />
                )}
                {/* Only assigned employee can complete their own task */}
                {task.status === 'in_progress' && 
                 currentEmployeeId && 
                 task.assignedTo?._id && 
                 currentEmployeeId.toString() === task.assignedTo._id.toString() && (
                  <Button
                    title={tr('taskDetail.completeTask')}
                    onPress={() => handleStatusUpdate('completed')}
                    disabled={updating}
                    style={[styles.actionButton, { backgroundColor: t.colors.success }]}
                    textStyle={{ color: '#fff' }}
                  />
                )}
                {/* Transfer button - only for assigned employee */}
                {isAssignedEmployee && (
                  <Button
                    title={tr('taskDetail.transferTask')}
                    onPress={() => setShowTransferModal(true)}
                    disabled={updating}
                    style={[styles.actionButton, { backgroundColor: t.colors.warning }]}
                    textStyle={{ color: '#fff' }}
                  />
                )}
                {isAdmin && (
                  <Button
                    title={tr('taskDetail.cancelTask')}
                    onPress={() => {
                      const isWeb = Platform.OS === 'web';
                      
                      if (isWeb) {
                        const shouldCancel = window.confirm(tr('taskDetail.cancelConfirmWeb'));
                        if (shouldCancel) {
                          handleStatusUpdate('cancelled');
                        }
                      } else {
                        // For iOS and Android, use Alert.alert
                        Alert.alert(
                          tr('taskDetail.cancelConfirmTitle'),
                          tr('taskDetail.cancelConfirmMessage'),
                          [
                            { text: tr('taskDetail.cancelNo'), style: 'cancel' },
                            { text: tr('taskDetail.cancelYes'), onPress: () => handleStatusUpdate('cancelled') }
                          ]
                        );
                      }
                    }}
                    disabled={updating}
                    style={[styles.actionButton, { backgroundColor: t.colors.danger }]}
                    textStyle={{ color: '#fff' }}
                  />
                )}
              </View>
            </View>
          )}

          {/* Assignment History */}
          {task.assignmentHistory && task.assignmentHistory.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: t.colors.text }]}>{tr('taskDetail.sectionAssignmentHistory')}</Text>
              {task.assignmentHistory.map((entry, index) => (
                <View key={index} style={[styles.historyItem, { borderColor: t.colors.border, backgroundColor: getRGBA(t.colors.primary, 0.05) }]}>
                  <View style={styles.historyHeader}>
                    <View style={styles.historyHeaderLeft}>
                      <Ionicons name="person-outline" size={18} color={t.colors.primary} />
                      <View style={styles.historyInfo}>
                        <Text style={[styles.historyEmployee, { color: t.colors.text }]}>
                          {entry.assignedTo?.name || tr('taskDetail.unknown')}
                        </Text>
                        <Text style={[styles.historyDate, { color: t.colors.textSecondary }]}>
                          {formatDateTime(entry.assignedAt)}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.historyStatusBadge, { backgroundColor: getRGBA(getStatusColor(entry.status, t.colors), 0.15), borderColor: getStatusColor(entry.status, t.colors) }]}>
                      <Text style={[styles.historyStatusText, { color: getStatusColor(entry.status, t.colors) }]}>
                        {(TASK_STATUS_I18N[entry.status] ? tr(TASK_STATUS_I18N[entry.status]) : entry.status.replace('_', ' ')).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  
                  {entry.transferredBy && (
                    <View style={styles.historyMeta}>
                      <Ionicons name="swap-horizontal-outline" size={14} color={t.colors.textSecondary} />
                      <Text style={[styles.historyMetaText, { color: t.colors.textSecondary }]}>
                        {tr('taskDetail.transferredBy', { name: entry.transferredBy?.name || tr('taskDetail.unknown') })}
                      </Text>
                    </View>
                  )}
                  
                  {entry.transferNote && (
                    <View style={[styles.transferNoteBox, { backgroundColor: getRGBA(t.colors.warning, 0.1) }]}>
                      <Text style={[styles.transferNoteLabel, { color: t.colors.textSecondary }]}>{tr('taskDetail.transferNoteHeading')}</Text>
                      <Text style={[styles.transferNoteText, { color: t.colors.text }]}>{entry.transferNote}</Text>
                    </View>
                  )}
                  
                  {entry.assignedBy && (
                    <View style={styles.historyMeta}>
                      <Ionicons name="person-add-outline" size={14} color={t.colors.textSecondary} />
                      <Text style={[styles.historyMetaText, { color: t.colors.textSecondary }]}>
                        {tr('taskDetail.assignedByLine', { name: entry.assignedBy?.name || tr('taskDetail.unknown') })}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Transfer Modal */}
      <Modal
        visible={showTransferModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTransferModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.colors.text }]}>{tr('taskDetail.modalTransferTitle')}</Text>
              <Pressable onPress={() => setShowTransferModal(false)}>
                <Ionicons name="close" size={24} color={t.colors.text} />
              </Pressable>
            </View>

            <Text style={[styles.modalLabel, { color: t.colors.text }]}>{tr('taskDetail.modalEmployeeLabel')}</Text>
            {employeeOptions.length === 0 ? (
              <View style={[styles.modalInput, { borderColor: t.colors.border, backgroundColor: getRGBA(t.colors.warning, 0.1), padding: 12 }]}>
                <Text style={[styles.modalHint, { color: t.colors.warning }]}>{transferEmptyHint}</Text>
              </View>
            ) : (
              <AutocompleteInput
                data={employeeOptions}
                value={transferEmployeeDisplay}
                onChange={(text) => {
                  setTransferEmployeeDisplay(text);
                  // Try to find matching employee
                  const found = employeeOptions.find(e => e.label.toLowerCase().includes(text.toLowerCase()));
                  if (found) {
                    setTransferEmployeeId(found.value);
                  } else {
                    setTransferEmployeeId('');
                  }
                }}
                onSelect={(item) => {
                  setTransferEmployeeId(item.value);
                  setTransferEmployeeDisplay(item.label);
                }}
                placeholder={tr('tasks.placeholderEmployee')}
                containerStyle={{ marginBottom: 12, zIndex: 1000 }}
              />
            )}

            <Text style={[styles.modalLabel, { color: t.colors.text }]}>{tr('taskDetail.modalNoteLabel')}</Text>
            <TextInput
              style={[styles.modalTextArea, { borderColor: t.colors.border, backgroundColor: t.colors.background, color: t.colors.text }]}
              value={transferNote}
              onChangeText={setTransferNote}
              placeholder={tr('taskDetail.modalNotePlaceholder')}
              placeholderTextColor={t.colors.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={[styles.modalHint, { color: t.colors.textSecondary }]}>
              {tr('taskDetail.noteMinProgress', { current: transferNote.length })}
            </Text>

            <View style={styles.modalActions}>
              <Button
                title={tr('taskDetail.modalCancel')}
                onPress={() => {
                  setShowTransferModal(false);
                  setTransferEmployeeId('');
                  setTransferEmployeeDisplay('');
                  setTransferNote('');
                }}
                style={[styles.modalButton, { backgroundColor: t.colors.border }]}
                textStyle={{ color: t.colors.text }}
              />
              <Button
                title={tr('taskDetail.modalTransferBtn')}
                onPress={handleTransfer}
                disabled={transferring || !transferEmployeeId || transferNote.trim().length < 10}
                style={[styles.modalButton, { backgroundColor: t.colors.warning }]}
                textStyle={{ color: '#fff' }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  backButton: {
    padding: 8
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700'
  },
  taskCard: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  taskTitle: {
    fontSize: 22,
    fontWeight: '700',
    flex: 1,
    marginRight: 12
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700'
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700'
  },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  overdueText: {
    fontSize: 11,
    fontWeight: '700'
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12
  },
  sectionContent: {
    fontSize: 14,
    lineHeight: 20
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12
  },
  infoContent: {
    flex: 1
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500'
  },
  notesBox: {
    padding: 12,
    borderRadius: 8
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600'
  },
  materialItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8
  },
  materialName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4
  },
  materialQuantity: {
    fontSize: 12
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12
  },
  checklistText: {
    fontSize: 14,
    flex: 1
  },
  checklistTextCompleted: {
    textDecorationLine: 'line-through'
  },
  actionsContainer: {
    gap: 12
  },
  actionButton: {
    marginTop: 8
  },
  historyItem: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  historyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1
  },
  historyInfo: {
    flex: 1
  },
  historyEmployee: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  historyDate: {
    fontSize: 12
  },
  historyStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1
  },
  historyStatusText: {
    fontSize: 10,
    fontWeight: '700'
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8
  },
  historyMetaText: {
    fontSize: 12
  },
  transferNoteBox: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8
  },
  transferNoteLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4
  },
  transferNoteText: {
    fontSize: 14,
    lineHeight: 20
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700'
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14
  },
  modalTextArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100
  },
  modalHint: {
    fontSize: 12,
    marginTop: 4
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20
  },
  modalButton: {
    flex: 1
  }
});

export default TaskDetailScreen;
