import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import SkeletonBar from '../components/ui/SkeletonBar';

const ENTRY_ITEM_HEIGHT = 120;

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

const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

const getStatusColor = (status, colors) => {
  switch (status) {
    case 'active': return colors.warning;
    case 'completed': return colors.success;
    case 'approved': return colors.primary;
    case 'rejected': return colors.danger;
    default: return colors.textSecondary;
  }
};

const getCategoryIcon = (category) => {
  switch (category) {
    case 'work': return 'hammer-outline';
    case 'meeting': return 'people-outline';
    case 'training': return 'school-outline';
    case 'break': return 'cafe-outline';
    default: return 'time-outline';
  }
};

const TimeEntryItem = React.memo(({ item, colors }) => {
  if (item.__skeleton) {
    return (
      <View style={[styles.entryCard, { backgroundColor: getRGBA(colors.card, 0.5) }]}>
        <SkeletonBar width="60%" height={12} />
        <SkeletonBar width="40%" height={10} style={{ marginTop: 8 }} />
        <SkeletonBar width="70%" height={10} style={{ marginTop: 8 }} />
      </View>
    );
  }

  return (
    <View style={[styles.entryCard, { backgroundColor: getRGBA(colors.card, 0.5) }]}>
      <View style={styles.entryHeader}>
        <View style={styles.entryInfo}>
          <Text style={[styles.entryDescription, { color: colors.text }]}>
            {item.description}
          </Text>
          <Text style={[styles.entryMeta, { color: colors.textSecondary }]}>
            {new Date(item.startTime).toLocaleDateString()} • {item.category}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status, colors) }]}>
          <Text style={[styles.statusText, { color: '#fff' }]}>
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.entryDetails}>
        <View style={styles.detailItem}>
          <Ionicons name={getCategoryIcon(item.category)} size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.text }]}>
            {formatDuration(item.duration)}
          </Text>
        </View>

        {item.overtime?.isOvertime && (
          <View style={styles.detailItem}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
            <Text style={[styles.detailText, { color: colors.warning }]}>
              {item.overtime.overtimeHours.toFixed(1)}h OT
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});
TimeEntryItem.displayName = 'TimeEntryItem';

const TimeTrackingScreen = () => {
  const { request } = useAuth();
  const { attendanceStatus } = useLocation();
  const t = useThemeTokens();

  const [activeEntry, setActiveEntry] = useState(null);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(null);
  const entryList = useMemo(() => {
    if (loading) {
      return Array.from({ length: 4 }).map((_, idx) => ({ id: `time-skeleton-${idx}`, __skeleton: true }));
    }
    return timeEntries;
  }, [loading, timeEntries]);

  const isCheckedIn = Boolean(attendanceStatus?.isCheckedIn);
  const canWork = useMemo(() => isCheckedIn, [isCheckedIn]);

  // Modal states
  const [showStartModal, setShowStartModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  // Form states
  const [startForm, setStartForm] = useState({
    taskId: '',
    taskType: 'daily_report',
    description: '',
    category: 'work',
    isBillable: true
  });

  const [manualForm, setManualForm] = useState({
    taskId: '',
    taskType: 'daily_report',
    description: '',
    startTime: '',
    endTime: '',
    category: 'work',
    isBillable: true
  });

  // Timer functions
  const startTimer = useCallback(() => {
    if (timer) clearInterval(timer);
    const newTimer = setInterval(() => {
      setCurrentDuration(prev => prev + 1); // Add 1 minute every minute
    }, 60000); // Update every minute
    setTimer(newTimer);
  }, [timer]);

  const stopTimer = useCallback(() => {
    if (timer) {
      clearInterval(timer);
      setTimer(null);
    }
  }, [timer]);

  // Load active time entry and recent entries
  const loadTimeData = useCallback(async () => {
    try {
      setLoading(true);

      // Load active entry
      const activeResponse = await request('/api/time/active');
      setActiveEntry(activeResponse.activeEntry);
      setCurrentDuration(activeResponse.currentDuration || 0);

      // Start timer if there's an active entry
      if (activeResponse.activeEntry) {
        startTimer();
      } else {
        stopTimer();
      }

      // Load recent time entries (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const entriesResponse = await request(
        `/api/time/entries?startDate=${sevenDaysAgo.toISOString().split('T')[0]}&limit=20`
      );
      setTimeEntries(entriesResponse.entries || []);
    } catch (error) {
      console.error('Failed to load time data:', error);
    } finally {
      setLoading(false);
    }
  }, [request, startTimer, stopTimer]);

  useFocusEffect(
    useCallback(() => {
      loadTimeData();
      return () => stopTimer(); // Cleanup on blur/unmount
    }, [loadTimeData, stopTimer])
  );

  // Handle start time tracking
  const handleStartTracking = async () => {
    try {
      if (!canWork) {
        Alert.alert('Check in required', 'Please check in at a work location first.');
        return;
      }
      if (!startForm.description.trim()) {
        Alert.alert('Error', 'Please enter a description');
        return;
      }

      const response = await request('/api/time/start', {
        method: 'POST',
        body: JSON.stringify(startForm)
      });

      setActiveEntry(response.timeEntry);
      setCurrentDuration(0);
      startTimer();
      setShowStartModal(false);

      // Reset form
      setStartForm({
        taskId: '',
        taskType: 'daily_report',
        description: '',
        category: 'work',
        isBillable: true
      });

      Alert.alert('Success', 'Time tracking started!');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to start time tracking');
    }
  };

  // Handle stop time tracking
  const handleStopTracking = async () => {
    try {
      const response = await request('/api/time/stop', {
        method: 'POST',
        body: JSON.stringify({})
      });

      stopTimer();
      setActiveEntry(null);
      setCurrentDuration(0);

      // Reload entries
      loadTimeData();

      Alert.alert('Success', `Time tracking stopped! Duration: ${formatDuration(response.timeEntry.duration)}`);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to stop time tracking');
    }
  };

  // Handle manual time entry
  const handleManualEntry = async () => {
    try {
      if (!canWork) {
        Alert.alert('Check in required', 'Please check in at a work location first.');
        return;
      }
      if (!manualForm.description.trim() || !manualForm.startTime || !manualForm.endTime) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      await request('/api/time/manual', {
        method: 'POST',
        body: JSON.stringify(manualForm)
      });

      setShowManualModal(false);

      // Reset form
      setManualForm({
        taskId: '',
        taskType: 'daily_report',
        description: '',
        startTime: '',
        endTime: '',
        category: 'work',
        isBillable: true
      });

      // Reload entries
      loadTimeData();

      Alert.alert('Success', 'Manual time entry created!');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create manual entry');
    }
  };

  const renderEntryItem = useCallback(
    ({ item }) => <TimeEntryItem item={item} colors={t.colors} />,
    [t.colors]
  );
  const getItemLayout = useCallback((_, index) => ({
    length: ENTRY_ITEM_HEIGHT,
    offset: ENTRY_ITEM_HEIGHT * index,
    index
  }), []);

  return (
    <Screen>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Active Timer Section */}
        <View style={[styles.section, { backgroundColor: getRGBA(t.colors.card, 0.5) }]}>
          <Text style={[styles.sectionTitle, { color: t.colors.text }]}>
            Current Session
          </Text>

          {activeEntry ? (
            <View style={[styles.timerCard, { backgroundColor: getRGBA(t.colors.warning, 0.1) }]}>
              <View style={styles.timerHeader}>
                <Ionicons name="timer-outline" size={24} color={t.colors.warning} />
                <Text style={[styles.timerTitle, { color: t.colors.text }]}>
                  Tracking Active
                </Text>
              </View>

              <Text style={[styles.timerDescription, { color: t.colors.textSecondary }]}>
                {activeEntry.description}
              </Text>

              <Text style={[styles.timerDuration, { color: t.colors.text }]}>
                {formatDuration(currentDuration)}
              </Text>

              <View style={styles.timerActions}>
                <Button
                  title="Stop Tracking"
                  onPress={handleStopTracking}
                  variant="secondary"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Add Note"
                  onPress={() => {/* TODO: Add note functionality */}}
                  variant="outline"
                  style={{ flex: 1, marginLeft: 8 }}
                />
              </View>
            </View>
          ) : (
            <View style={styles.noActiveCard}>
              <EmptyState
                icon="timer-outline"
                title="No active time tracking"
                subtitle="Start tracking time for your tasks."
              />
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.colors.text }]}>Quick Actions</Text>
          <View style={styles.actionRow}>
            <Pressable
              style={[
                styles.actionCard,
                { backgroundColor: getRGBA(t.colors.success, canWork ? 0.1 : 0.05) },
                !canWork && styles.actionDisabled
              ]}
              onPress={() => {
                if (!canWork) {
                  Alert.alert('Check in required', 'Please check in at a work location first.');
                  return;
                }
                setShowStartModal(true);
              }}
              disabled={!canWork}
            >
              <Ionicons name="play-circle-outline" size={24} color={t.colors.success} />
              <Text style={[styles.actionText, { color: t.colors.text }]}>Start Tracking</Text>
            </Pressable>

            <Pressable
              style={[
                styles.actionCard,
                { backgroundColor: getRGBA(t.colors.primary, canWork ? 0.1 : 0.05) },
                !canWork && styles.actionDisabled
              ]}
              onPress={() => {
                if (!canWork) {
                  Alert.alert('Check in required', 'Please check in at a work location first.');
                  return;
                }
                setShowManualModal(true);
              }}
              disabled={!canWork}
            >
              <Ionicons name="add-circle-outline" size={24} color={t.colors.primary} />
              <Text style={[styles.actionText, { color: t.colors.text }]}>Manual Entry</Text>
            </Pressable>
          </View>
        </View>

        {/* Recent Time Entries */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.colors.text }]}>
            Recent Entries ({timeEntries.length})
          </Text>

          <FlatList
            data={entryList}
            keyExtractor={(item) => (item.__skeleton ? item.id : item._id)}
            scrollEnabled={false}
            contentContainerStyle={styles.entriesList}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={7}
            removeClippedSubviews
            renderItem={renderEntryItem}
            getItemLayout={getItemLayout}
            ListEmptyComponent={
              !loading ? (
                <EmptyState
                  icon="time-outline"
                  title="No time entries yet"
                  subtitle="Start tracking time to see entries here."
                />
              ) : null
            }
          />
        </View>
      </ScrollView>

      {/* Start Tracking Modal */}
      <Modal
        visible={showStartModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStartModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: t.colors.card }]}>
            <Text style={[styles.modalTitle, { color: t.colors.text }]}>Start Time Tracking</Text>

            <TextInput
              style={[styles.modalInput, { borderColor: t.colors.border, color: t.colors.text }]}
              placeholder="Task Description"
              value={startForm.description}
              onChangeText={(text) => setStartForm({ ...startForm, description: text })}
              placeholderTextColor={t.colors.textSecondary}
            />

            <TextInput
              style={[styles.modalInput, { borderColor: t.colors.border, color: t.colors.text }]}
              placeholder="Task ID (optional)"
              value={startForm.taskId}
              onChangeText={(text) => setStartForm({ ...startForm, taskId: text })}
              placeholderTextColor={t.colors.textSecondary}
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowStartModal(false)}
                variant="secondary"
              />
              <Button
                title="Start"
                onPress={handleStartTracking}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Manual Entry Modal */}
      <Modal
        visible={showManualModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowManualModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: t.colors.card }]}>
            <Text style={[styles.modalTitle, { color: t.colors.text }]}>Manual Time Entry</Text>

            <TextInput
              style={[styles.modalInput, { borderColor: t.colors.border, color: t.colors.text }]}
              placeholder="Task Description"
              value={manualForm.description}
              onChangeText={(text) => setManualForm({ ...manualForm, description: text })}
              placeholderTextColor={t.colors.textSecondary}
            />

            <TextInput
              style={[styles.modalInput, { borderColor: t.colors.border, color: t.colors.text }]}
              placeholder="Start Time (YYYY-MM-DD HH:mm)"
              value={manualForm.startTime}
              onChangeText={(text) => setManualForm({ ...manualForm, startTime: text })}
              placeholderTextColor={t.colors.textSecondary}
            />

            <TextInput
              style={[styles.modalInput, { borderColor: t.colors.border, color: t.colors.text }]}
              placeholder="End Time (YYYY-MM-DD HH:mm)"
              value={manualForm.endTime}
              onChangeText={(text) => setManualForm({ ...manualForm, endTime: text })}
              placeholderTextColor={t.colors.textSecondary}
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowManualModal(false)}
                variant="secondary"
              />
              <Button
                title="Create Entry"
                onPress={handleManualEntry}
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
    flex: 1,
    paddingBottom: 32
  },
  section: {
    marginTop: 12
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10
  },

  // Timer Section
  timerCard: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center'
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  timerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8
  },
  timerDescription: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center'
  },
  timerDuration: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 20
  },
  timerActions: {
    flexDirection: 'row',
    width: '100%'
  },

  noActiveCard: {
    alignItems: 'center',
    padding: 40
  },
  noActiveText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8
  },
  noActiveSubtext: {
    fontSize: 14,
    textAlign: 'center'
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    gap: 12
  },
  actionCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)'
  },
  actionDisabled: {
    opacity: 0.6
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8
  },

  // Entries List
  entriesList: {
    gap: 12
  },
  entryCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    minHeight: ENTRY_ITEM_HEIGHT - 12
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  entryInfo: {
    flex: 1
  },
  entryDescription: {
    fontSize: 16,
    fontWeight: '600'
  },
  entryMeta: {
    fontSize: 12,
    marginTop: 2
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize'
  },
  entryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  detailText: {
    fontSize: 14,
    marginLeft: 4
  },

  noEntries: {
    textAlign: 'center',
    padding: 40,
    fontStyle: 'italic'
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center'
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20
  }
});

export default TimeTrackingScreen;
