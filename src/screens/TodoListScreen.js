import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, ScrollView, Alert, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import SkeletonBar from '../components/ui/SkeletonBar';

const TODO_ITEM_HEIGHT = 120;

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

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const isCompletedMoreThanWeekAgo = (todo) => {
  if (!todo.completed || !todo.completedAt) return false;
  const completedDate = new Date(todo.completedAt);
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  return completedDate < oneWeekAgo;
};

const TodoItem = React.memo(({ item, colors, onToggle, onEdit, onDelete }) => {
  if (item.__skeleton) {
    return (
      <View style={[styles.todoCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.todoHeader}>
          <SkeletonBar width="60%" height={16} />
          <SkeletonBar width="30%" height={12} />
        </View>
        <SkeletonBar width="80%" height={12} />
      </View>
    );
  }

  const priorityColor = getPriorityColor(item.priority, colors);
  const hasReminder = item.reminder?.enabled && item.reminder?.date;
  const reminderPassed = hasReminder && new Date(item.reminder.date) < new Date();
  const isLocked = isCompletedMoreThanWeekAgo(item);

  return (
    <View style={[styles.todoCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.todoHeader}>
        <View style={styles.todoTitleRow}>
          {item.completed ? (
            <Pressable
              style={[styles.actionButton, { backgroundColor: getRGBA(colors.success, 0.12) }]}
              onPress={() => onToggle(item._id)}
            >
              <Ionicons name="checkmark" size={20} color={colors.success} />
            </Pressable>
          ) : (
            <Pressable
              style={[styles.actionButton, { backgroundColor: getRGBA(colors.danger, 0.12) }]}
              onPress={() => onToggle(item._id)}
            >
              <Ionicons name="close" size={20} color={colors.danger} />
            </Pressable>
          )}
          <View style={styles.todoContent}>
            <Text
              style={[
                styles.todoTitle,
                { color: colors.text },
                item.completed && { textDecorationLine: 'line-through', opacity: 0.6 }
              ]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {item.description ? (
              <Text
                style={[
                  styles.todoDescription,
                  { color: colors.textSecondary },
                  item.completed && { opacity: 0.6 }
                ]}
                numberOfLines={2}
              >
                {item.description}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.todoActions} pointerEvents="box-none">
          {hasReminder && (
            <Ionicons
              name={reminderPassed ? "alarm" : "alarm-outline"}
              size={18}
              color={reminderPassed ? colors.warning : colors.textSecondary}
              style={{ marginRight: 8 }}
            />
          )}
          <Pressable
            style={[
              styles.actionBtn,
              { backgroundColor: getRGBA(colors.primary, 0.12) },
              isLocked && { opacity: 0.5 }
            ]}
            onPress={() => {
              if (isLocked) {
                Alert.alert(
                  'Cannot Edit',
                  'This todo was completed more than 1 week ago and cannot be edited.',
                  [{ text: 'OK' }]
                );
              } else {
                onEdit(item);
              }
            }}
            disabled={isLocked}
          >
            <Ionicons name="create-outline" size={16} color={colors.primary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: getRGBA(colors.danger, 0.12) },
              isLocked && { opacity: 0.5 },
              pressed && !isLocked && { opacity: 0.7 }
            ]}
            onPress={() => {
              if (isLocked) {
                Alert.alert(
                  'Cannot Delete',
                  'This todo was completed more than 1 week ago and cannot be deleted.',
                  [{ text: 'OK' }]
                );
                return;
              }
              
              if (!onDelete) {
                Alert.alert('Error', 'Delete function is not available');
                return;
              }
              
              if (!item._id) {
                Alert.alert('Error', 'Todo ID is missing');
                return;
              }
              
              onDelete(item._id);
            }}
            disabled={isLocked}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </Pressable>
        </View>
      </View>

      <View style={styles.todoMeta}>
        {isLocked && (
          <View style={[styles.lockedBadge, { backgroundColor: getRGBA(colors.textSecondary, 0.15) }]}>
            <Ionicons name="lock-closed" size={12} color={colors.textSecondary} />
            <Text style={[styles.lockedText, { color: colors.textSecondary }]}>
              Locked
            </Text>
          </View>
        )}
        <View style={[styles.priorityBadge, { backgroundColor: getRGBA(priorityColor, 0.15), borderColor: priorityColor }]}>
          <Text style={[styles.priorityText, { color: priorityColor }]}>
            {item.priority.toUpperCase()}
          </Text>
        </View>
        {item.category && (
          <Text style={[styles.categoryText, { color: colors.textSecondary }]}>
            {item.category}
          </Text>
        )}
        {hasReminder && (
          <View style={styles.reminderInfo}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.reminderText, { color: colors.textSecondary }]}>
              {formatDateTime(item.reminder.date)}
            </Text>
          </View>
        )}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {item.tags.slice(0, 3).map((tag, idx) => (
              <View key={idx} style={[styles.tag, { backgroundColor: getRGBA(colors.primary, 0.1) }]}>
                <Text style={[styles.tagText, { color: colors.primary }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
});

TodoItem.displayName = 'TodoItem';

const TodoListScreen = () => {
  const { request } = useAuth();
  const t = useThemeTokens();

  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('all'); // all, active, completed

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: '',
    tags: '',
    reminder: {
      enabled: false,
      date: '',
      time: ''
    }
  });

  const priorityOptions = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Urgent', value: 'urgent' }
  ];

  const filterOptions = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Completed', value: 'completed' }
  ];

  const loadTodos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === 'active') {
        params.append('completed', 'false');
      } else if (filter === 'completed') {
        params.append('completed', 'true');
      }
      if (searchValue) {
        params.append('search', searchValue);
      }

      const data = await request(`/api/todos?${params.toString()}`);
      setTodos(data.todos || []);
    } catch (error) {
      setMessage(error.message || 'Failed to load todos');
    } finally {
      setLoading(false);
    }
  }, [request, filter, searchValue]);

  useFocusEffect(
    useCallback(() => {
      loadTodos();
    }, [loadTodos])
  );

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      category: '',
      tags: '',
      reminder: {
        enabled: false,
        date: '',
        time: ''
      }
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      setMessage('Title is required');
      return;
    }

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        priority: formData.priority,
        category: formData.category.trim() || undefined,
        tags: formData.tags
          ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
          : undefined
      };

      // Handle reminder
      if (formData.reminder.enabled && formData.reminder.date && formData.reminder.time) {
        const [year, month, day] = formData.reminder.date.split('-');
        const [hours, minutes] = formData.reminder.time.split(':');
        const reminderDate = new Date(year, month - 1, day, hours, minutes);
        payload.reminder = {
          enabled: true,
          date: reminderDate.toISOString()
        };
      } else if (formData.reminder.enabled) {
        setMessage('Please provide both date and time for reminder');
        return;
      }

      if (editingId) {
        await request(`/api/todos/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        setMessage('Todo updated successfully');
      } else {
        await request('/api/todos', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setMessage('Todo created successfully');
      }

      resetForm();
      loadTodos();
    } catch (error) {
      setMessage(error.message || 'Failed to save todo');
    }
  };

  const handleEdit = useCallback((todo) => {
    if (isCompletedMoreThanWeekAgo(todo)) {
      Alert.alert(
        'Cannot Edit',
        'This todo was completed more than 1 week ago and cannot be edited.',
        [{ text: 'OK' }]
      );
      return;
    }
    const reminderDate = todo.reminder?.date ? new Date(todo.reminder.date) : null;
    setFormData({
      title: todo.title || '',
      description: todo.description || '',
      priority: todo.priority || 'medium',
      category: todo.category || '',
      tags: todo.tags ? todo.tags.join(', ') : '',
      reminder: {
        enabled: todo.reminder?.enabled || false,
        date: reminderDate ? reminderDate.toISOString().split('T')[0] : '',
        time: reminderDate ? reminderDate.toTimeString().slice(0, 5) : ''
      }
    });
    setEditingId(todo._id);
    setShowForm(true);
  }, []);

  const handleToggle = useCallback(async (id) => {
    try {
      await request(`/api/todos/${id}/complete`, { method: 'POST' });
      loadTodos();
    } catch (error) {
      setMessage(error.message || 'Failed to toggle todo');
    }
  }, [request, loadTodos]);

  const handleDelete = useCallback(async (id) => {
    if (!id) {
      return;
    }
    
    // For web compatibility, use window.confirm
    const isWeb = typeof window !== 'undefined';
    
    if (isWeb) {
      const shouldDelete = window.confirm('Are you sure you want to delete this todo?');
      
      if (!shouldDelete) {
        return;
      }
    } else {
      // For native, use Alert - but we need to handle it differently
      // Since Alert.alert is not async, we'll use a promise wrapper
      return new Promise((resolve) => {
        Alert.alert(
          'Delete Todo',
          'Are you sure you want to delete this todo?',
          [
            { 
              text: 'Cancel', 
              style: 'cancel',
              onPress: () => {
                resolve();
              }
            },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  await request(`/api/todos/${id}`, { method: 'DELETE' });
                  setMessage('Todo deleted successfully');
                  loadTodos();
                  resolve();
                } catch (error) {
                  setMessage(error.message || 'Failed to delete todo');
                  resolve();
                }
              }
            }
          ]
        );
      });
    }
    
    // Web path - execute delete
    try {
      await request(`/api/todos/${id}`, { method: 'DELETE' });
      setMessage('Todo deleted successfully');
      loadTodos();
    } catch (error) {
      setMessage(error.message || 'Failed to delete todo');
    }
  }, [request, loadTodos]);

  const filteredTodos = useMemo(() => {
    return todos;
  }, [todos]);

  const stats = useMemo(() => {
    return {
      total: todos.length,
      active: todos.filter(t => !t.completed).length,
      completed: todos.filter(t => t.completed).length,
      withReminders: todos.filter(t => t.reminder?.enabled && !t.completed).length
    };
  }, [todos]);

  const renderTodoItem = useCallback(
    ({ item }) => (
      <TodoItem
        item={item}
        colors={t.colors}
        onToggle={handleToggle}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    ),
    [t.colors, handleToggle, handleEdit, handleDelete]
  );

  const getItemLayout = useCallback((_, index) => ({
    length: TODO_ITEM_HEIGHT,
    offset: TODO_ITEM_HEIGHT * index,
    index
  }), []);

  return (
    <Screen>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.colors.text }]}>Todo List</Text>
          <Pressable
            style={[styles.addBtn, { backgroundColor: t.colors.primary }]}
            onPress={() => setShowForm(!showForm)}
          >
            <Ionicons name={showForm ? "close" : "add"} size={20} color="#fff" />
            <Text style={styles.addBtnText}>
              {showForm ? 'Cancel' : 'Add Todo'}
            </Text>
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
          <View style={[styles.form, { backgroundColor: getRGBA(t.colors.card, 0.5) }]}>
            <Text style={[styles.formTitle, { color: t.colors.text }]}>
              {editingId ? 'Edit Todo' : 'New Todo'}
            </Text>

            <Text style={[styles.label, { color: t.colors.text }]}>Title *</Text>
            <TextInput
              style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
              placeholder="Todo title"
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
              placeholderTextColor={t.colors.textSecondary}
            />

            <Text style={[styles.label, { color: t.colors.text }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
              placeholder="Todo description"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholderTextColor={t.colors.textSecondary}
              multiline
              numberOfLines={3}
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

            <Text style={[styles.label, { color: t.colors.text }]}>Category</Text>
            <TextInput
              style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
              placeholder="Category (optional)"
              value={formData.category}
              onChangeText={(text) => setFormData({ ...formData, category: text })}
              placeholderTextColor={t.colors.textSecondary}
            />

            <Text style={[styles.label, { color: t.colors.text }]}>Tags</Text>
            <TextInput
              style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
              placeholder="Tags (comma separated)"
              value={formData.tags}
              onChangeText={(text) => setFormData({ ...formData, tags: text })}
              placeholderTextColor={t.colors.textSecondary}
            />

            <View style={styles.reminderSection}>
              <Pressable
                style={styles.reminderToggle}
                onPress={() => setFormData({
                  ...formData,
                  reminder: {
                    ...formData.reminder,
                    enabled: !formData.reminder.enabled
                  }
                })}
              >
                <Ionicons
                  name={formData.reminder.enabled ? "checkbox" : "square-outline"}
                  size={20}
                  color={formData.reminder.enabled ? t.colors.primary : t.colors.textSecondary}
                />
                <Text style={[styles.reminderLabel, { color: t.colors.text }]}>
                  Set Reminder
                </Text>
              </Pressable>

              {formData.reminder.enabled && (
                <View style={styles.reminderInputs}>
                  <View style={styles.reminderInputRow}>
                    <Text style={[styles.miniLabel, { color: t.colors.textSecondary }]}>Date</Text>
                    <TextInput
                      style={[styles.input, styles.reminderInput, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
                      placeholder="YYYY-MM-DD"
                      value={formData.reminder.date}
                      onChangeText={(text) => setFormData({
                        ...formData,
                        reminder: { ...formData.reminder, date: text }
                      })}
                      placeholderTextColor={t.colors.textSecondary}
                    />
                  </View>
                  <View style={styles.reminderInputRow}>
                    <Text style={[styles.miniLabel, { color: t.colors.textSecondary }]}>Time</Text>
                    <TextInput
                      style={[styles.input, styles.reminderInput, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
                      placeholder="HH:MM"
                      value={formData.reminder.time}
                      onChangeText={(text) => setFormData({
                        ...formData,
                        reminder: { ...formData.reminder, time: text }
                      })}
                      placeholderTextColor={t.colors.textSecondary}
                    />
                  </View>
                </View>
              )}
            </View>

            <View style={styles.formActions}>
              <Button title="Cancel" onPress={resetForm} variant="secondary" />
              <Button title={editingId ? 'Update Todo' : 'Create Todo'} onPress={handleSubmit} />
            </View>
          </View>
        )}

        <View style={[styles.statsContainer, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: t.colors.text }]}>{stats.total}</Text>
            <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: t.colors.primary }]}>{stats.active}</Text>
            <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>Active</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: t.colors.success }]}>{stats.completed}</Text>
            <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>Completed</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: t.colors.warning }]}>{stats.withReminders}</Text>
            <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>Reminders</Text>
          </View>
        </View>

        <View style={styles.filtersContainer}>
          {filterOptions.map((option) => (
            <Pressable
              key={option.value}
              style={[
                styles.filterChip,
                { borderColor: t.colors.border, backgroundColor: t.colors.card },
                filter === option.value && {
                  borderColor: t.colors.primary,
                  backgroundColor: getRGBA(t.colors.primary, 0.1)
                }
              ]}
              onPress={() => setFilter(option.value)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: t.colors.text },
                  filter === option.value && { color: t.colors.primary, fontWeight: '700' }
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: t.colors.textSecondary }]}>Search todos</Text>
        <TextInput
          style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
          placeholder="Search by title, description, or tags"
          value={searchValue}
          onChangeText={setSearchValue}
          placeholderTextColor={t.colors.textSecondary}
        />

        <Text style={[styles.sectionTitle, { color: t.colors.text }]}>
          Todos ({filteredTodos.length})
        </Text>

        <FlatList
          data={loading ? Array.from({ length: 4 }).map((_, idx) => ({ id: `todo-skeleton-${idx}`, __skeleton: true })) : filteredTodos}
          keyExtractor={(item) => (item.__skeleton ? item.id : item._id)}
          scrollEnabled={false}
          contentContainerStyle={styles.todoList}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews
          renderItem={renderTodoItem}
          getItemLayout={getItemLayout}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon="checkmark-circle-outline"
                title="No todos yet"
                subtitle="Create a todo to get started with reminders and notifications."
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
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)'
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16
  },
  label: {
    marginBottom: 6,
    fontWeight: '600',
    fontSize: 14
  },
  miniLabel: {
    marginBottom: 4,
    fontSize: 12
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
    gap: 8,
    marginBottom: 12
  },
  roleChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center'
  },
  roleText: {
    fontSize: 14,
    fontWeight: '500'
  },
  reminderSection: {
    marginTop: 8,
    marginBottom: 12
  },
  reminderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  reminderLabel: {
    fontSize: 16,
    fontWeight: '500'
  },
  reminderInputs: {
    flexDirection: 'row',
    gap: 12
  },
  reminderInputRow: {
    flex: 1
  },
  reminderInput: {
    marginBottom: 0
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16
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
  filtersContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  filterChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center'
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500'
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8
  },
  todoList: {
    gap: 12
  },
  todoCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    minHeight: TODO_ITEM_HEIGHT - 12
  },
  todoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  todoTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  todoContent: {
    flex: 1
  },
  todoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  todoDescription: {
    fontSize: 14,
    lineHeight: 20
  },
  todoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  actionBtn: {
    padding: 8,
    borderRadius: 6,
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  todoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)'
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  lockedText: {
    fontSize: 10,
    fontWeight: '600'
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700'
  },
  categoryText: {
    fontSize: 12
  },
  reminderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  reminderText: {
    fontSize: 12
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8
  },
  tagText: {
    fontSize: 10
  }
});

export default TodoListScreen;
