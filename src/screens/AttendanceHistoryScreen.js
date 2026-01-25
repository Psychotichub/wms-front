import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import EmptyState from '../components/ui/EmptyState';
import SkeletonBar from '../components/ui/SkeletonBar';

const ATTENDANCE_ITEM_HEIGHT = 140;

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
};

const formatTime = (dateString) => {
  if (!dateString) return '--:--';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

const formatDuration = (hours) => {
  if (!hours) return '0h 0m';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
};

const AttendanceItem = React.memo(({ item, colors }) => (
  <View style={[styles.attendanceItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={styles.itemHeader}>
      <Text style={[styles.dateText, { color: colors.text }]}>
        {formatDate(item.date)}
      </Text>
      {item.location?.geofenceTriggered && (
        <View style={styles.geofenceBadge}>
          <Ionicons name="location" size={12} color="#22c55e" />
          <Text style={styles.geofenceText}>Auto</Text>
        </View>
      )}
    </View>

    <View style={styles.timeContainer}>
      <View style={styles.timeBlock}>
        <Ionicons name="log-in-outline" size={16} color="#22c55e" />
        <Text style={[styles.timeText, { color: colors.text }]}>
          {formatTime(item.clockInTime)}
        </Text>
      </View>

      <View style={styles.timeBlock}>
        <Ionicons name="log-out-outline" size={16} color="#ef4444" />
        <Text style={[styles.timeText, { color: colors.text }]}>
          {formatTime(item.clockOutTime)}
        </Text>
      </View>
    </View>

    <View style={styles.itemFooter}>
      <Text style={[styles.locationText, { color: colors.textSecondary }]}>
        📍 {item.location?.locationName || 'Unknown Location'}
      </Text>
      <Text style={[styles.durationText, { color: colors.primary }]}>
        ⏱️ {formatDuration(item.totalHours)}
      </Text>
    </View>
  </View>
));
AttendanceItem.displayName = 'AttendanceItem';

const AttendanceHistoryScreen = ({ navigation }) => {
  const { request } = useAuth();
  const t = useThemeTokens();

  const [, setAttendanceHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasFocusedRef = useRef(false);

  // Filter states
  const [selectedDateRange, setSelectedDateRange] = useState('week'); // 'week', 'month', 'custom'
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [startDate] = useState(null);
  const [endDate] = useState(null);
  const [availableLocations, setAvailableLocations] = useState([]);

  // Stats
  const [stats, setStats] = useState({
    totalDays: 0,
    totalHours: 0,
    averageHoursPerDay: 0
  });

  const getDateRange = useCallback((range) => {
    const now = new Date();
    const start = new Date();

    switch (range) {
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'custom':
        // Use custom dates if set
        return {
          startDate: startDate ? startDate.toISOString().split('T')[0] : start.toISOString().split('T')[0],
          endDate: endDate ? endDate.toISOString().split('T')[0] : now.toISOString().split('T')[0]
        };
      default:
        start.setDate(now.getDate() - 7);
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0]
    };
  }, [endDate, startDate]);

  const loadAttendanceHistory = useCallback(async () => {
    try {
      setLoading(true);

      // Calculate date range
      const dates = getDateRange(selectedDateRange);
      const locationParam = selectedLocation !== 'all' ? `&locationId=${selectedLocation}` : '';

      const data = await request(
        `/api/locations/attendance/history?startDate=${dates.startDate}&endDate=${dates.endDate}${locationParam}`
      );

      const records = data.records || [];

      setAttendanceHistory(records);
      setFilteredHistory(records);

      // Extract unique locations for filter
      const locations = [...new Set(records.map(record => record.location?.locationName).filter(Boolean))];
      setAvailableLocations(locations);

      // Calculate stats
      calculateStats(records);
    } catch (error) {
      console.error('Error loading attendance history:', error);
      Alert.alert('Error', 'Failed to load attendance history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getDateRange, request, selectedDateRange, selectedLocation]);

  useFocusEffect(
    useCallback(() => {
      hasFocusedRef.current = true;
      loadAttendanceHistory();
    }, [loadAttendanceHistory])
  );

  useEffect(() => {
    if (!hasFocusedRef.current) return;
    loadAttendanceHistory();
  }, [loadAttendanceHistory]);

  const calculateStats = (records) => {
    if (records.length === 0) {
      setStats({ totalDays: 0, totalHours: 0, averageHoursPerDay: 0 });
      return;
    }

    // Group by date
    const dailyRecords = {};
    records.forEach(record => {
      const date = new Date(record.date).toISOString().split('T')[0];
      if (!dailyRecords[date]) {
        dailyRecords[date] = [];
      }
      dailyRecords[date].push(record);
    });

    const totalDays = Object.keys(dailyRecords).length;
    const totalHours = records.reduce((sum, record) => sum + (record.totalHours || 0), 0);
    const averageHoursPerDay = totalDays > 0 ? totalHours / totalDays : 0;

    setStats({
      totalDays,
      totalHours: Math.round(totalHours * 10) / 10,
      averageHoursPerDay: Math.round(averageHoursPerDay * 10) / 10
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAttendanceHistory();
  };

  const exportToCSV = async () => {
    try {
      if (filteredHistory.length === 0) {
        Alert.alert('No Data', 'No attendance records to export');
        return;
      }

      // Create CSV content
      const headers = ['Date', 'Check In', 'Check Out', 'Duration (hours)', 'Location', 'Geofence Triggered'];
      const csvContent = [
        headers.join(','),
        ...filteredHistory.map(record => [
          new Date(record.date).toLocaleDateString(),
          record.clockInTime ? new Date(record.clockInTime).toLocaleTimeString() : 'N/A',
          record.clockOutTime ? new Date(record.clockOutTime).toLocaleTimeString() : 'N/A',
          record.totalHours?.toFixed(2) || '0.00',
          `"${record.location?.locationName || 'Unknown'}"`,
          record.location?.geofenceTriggered ? 'Yes' : 'No'
        ].join(','))
      ].join('\n');

      // Save to file
      const fileName = `attendance_history_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8
      });

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Attendance History'
        });
      } else {
        Alert.alert('Success', `CSV file saved to: ${fileUri}`);
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      Alert.alert('Error', 'Failed to export attendance history');
    }
  };

  const renderAttendanceItem = useCallback(
    ({ item }) => <AttendanceItem item={item} colors={t.colors} />,
    [t.colors]
  );
  const getItemLayout = useCallback((_, index) => ({
    length: ATTENDANCE_ITEM_HEIGHT,
    offset: ATTENDANCE_ITEM_HEIGHT * index,
    index
  }), []);

  const renderFilterButton = (range, label) => (
    <Pressable
      style={[
        styles.filterButton,
        { backgroundColor: selectedDateRange === range ? t.colors.primary : t.colors.card },
        { borderColor: t.colors.border }
      ]}
      onPress={() => setSelectedDateRange(range)}
    >
      <Text style={[
        styles.filterButtonText,
        { color: selectedDateRange === range ? '#ffffff' : t.colors.text }
      ]}>
        {label}
      </Text>
    </Pressable>
  );

  const renderLocationFilterButton = (location) => (
    <Pressable
      style={[
        styles.filterButton,
        { backgroundColor: selectedLocation === location ? t.colors.primary : t.colors.card },
        { borderColor: t.colors.border }
      ]}
      onPress={() => setSelectedLocation(location)}
    >
      <Text style={[
        styles.filterButtonText,
        { color: selectedLocation === location ? '#ffffff' : t.colors.text }
      ]}>
        {location === 'all' ? 'All Locations' : location}
      </Text>
    </Pressable>
  );

  return (
    <Screen>
      <View style={[styles.container, { backgroundColor: t.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: t.colors.card, borderBottomColor: t.colors.border }]}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={t.colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: t.colors.text }]}>Attendance History</Text>
          <Pressable
            style={[styles.exportButton, { backgroundColor: t.colors.background }]}
            onPress={exportToCSV}
          >
            <Ionicons name="download-outline" size={18} color={t.colors.text} />
          </Pressable>
        </View>

        {/* Stats Overview */}
        <View style={[styles.statsContainer, { backgroundColor: t.colors.card }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: t.colors.primary }]}>{stats.totalDays}</Text>
            <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>Days Worked</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: t.colors.primary }]}>{stats.totalHours}h</Text>
            <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>Total Hours</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: t.colors.primary }]}>{stats.averageHoursPerDay}h</Text>
            <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>Avg/Day</Text>
          </View>
        </View>

        {/* Filters */}
        <View style={[styles.filtersContainer, { backgroundColor: t.colors.background }]}>
          {/* Date Range Filter */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterTitle, { color: t.colors.text }]}>Time Period</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {renderFilterButton('week', 'This Week')}
              {renderFilterButton('month', 'This Month')}
              {renderFilterButton('custom', 'Custom')}
            </ScrollView>
          </View>

          {/* Location Filter */}
          {availableLocations.length > 1 && (
            <View style={styles.filterSection}>
              <Text style={[styles.filterTitle, { color: t.colors.text }]}>Location</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                {renderLocationFilterButton('all')}
                {availableLocations.map(location => (
                  <View key={location}>
                    {renderLocationFilterButton(location)}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Attendance List */}
        {loading && filteredHistory.length === 0 ? (
          <View style={styles.listContainer}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <View
                key={`attendance-skeleton-${idx}`}
                style={[styles.attendanceItem, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}
              >
                <SkeletonBar width="40%" height={12} />
                <SkeletonBar width="80%" height={10} style={{ marginTop: 8 }} />
                <SkeletonBar width="60%" height={10} style={{ marginTop: 8 }} />
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={filteredHistory}
            renderItem={renderAttendanceItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews
            getItemLayout={getItemLayout}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[t.colors.primary]}
                tintColor={t.colors.primary}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="document-text-outline"
                title="No attendance records"
                subtitle="Try adjusting your filters or check back later."
              />
            }
          />
        )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  exportButton: {
    padding: 6,
    borderRadius: 6,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterScroll: {
    marginBottom: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContainer: {
    padding: 16,
  },
  attendanceItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    minHeight: ATTENDANCE_ITEM_HEIGHT - 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
  },
  geofenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  geofenceText: {
    fontSize: 12,
    color: '#22c55e',
    marginLeft: 4,
    fontWeight: '500',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    flex: 1,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default AttendanceHistoryScreen;
