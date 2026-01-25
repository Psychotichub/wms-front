import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Animated, Platform } from 'react-native';
import { useLocation } from '../context/LocationContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import GeofenceMap from '../components/GeofenceMap';
import EmptyState from '../components/ui/EmptyState';

const AttendanceStatusScreen = ({ navigation }) => {
  const {
    attendanceStatus,
    currentGeofence,
    location,
    loadGeofences,
    manualCheckOut,
    startLocationTracking,
    stopLocationTracking
  } = useLocation();

  const t = useThemeTokens();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentGeofenceData, setCurrentGeofenceData] = useState(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Native driver is only supported on iOS and Android, not on web
  // Explicitly set to false on web to prevent warnings
  const USE_NATIVE_DRIVER = Platform.OS === 'ios' || Platform.OS === 'android';

  // Load geofence data for current location
  useEffect(() => {
    const loadCurrentGeofenceData = async () => {
      if (currentGeofence) {
        const geofences = await loadGeofences();
        const currentData = geofences?.find(g => g.id === currentGeofence.id);
        setCurrentGeofenceData(currentData);
      }
    };

    loadCurrentGeofenceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGeofence]);

  // Entrance animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();

    // Pulse animation for active status
    if (attendanceStatus.isCheckedIn) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      pulseAnimation.start();

      return () => pulseAnimation.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceStatus.isCheckedIn]);

  const handleCheckOut = async () => {
    Alert.alert(
      'Check Out',
      `Are you sure you want to check out from ${currentGeofence?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await manualCheckOut();
              Alert.alert('Success', 'Successfully checked out');
              navigation.goBack();
            } catch (_error) {
              Alert.alert('Error', 'Failed to check out. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    try {
      // Refresh location tracking
      await stopLocationTracking();
      await new Promise(resolve => setTimeout(resolve, 1000));
      await startLocationTracking();

      // Reload geofences
      await loadGeofences();

      Alert.alert('Success', 'Status refreshed successfully');
    } catch (_error) {
      Alert.alert('Error', 'Failed to refresh status');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getMapRegion = () => {
    if (location) {
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
    }

    if (currentGeofenceData?.coordinates?.length > 0) {
      const coords = currentGeofenceData.coordinates[0];
      return {
        latitude: coords[1],
        longitude: coords[0],
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    return {
      latitude: 0,
      longitude: 0,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  };

  const formatElapsedTime = (milliseconds) => {
    if (!milliseconds) return '00:00:00';

    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTime = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getCurrentDate = () => {
    return new Date().toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // If user is not checked in, redirect to location selection
  if (!attendanceStatus.isCheckedIn || !currentGeofence) {
    return (
      <Screen>
        <View style={[styles.container, { backgroundColor: t.colors.background }]}>
          <View style={[styles.header, { backgroundColor: t.colors.card, borderBottomColor: t.colors.border }]}>
            <Pressable
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={t.colors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: t.colors.text }]}>Attendance Status</Text>
            <View style={styles.headerRight} />
          </View>

          <View style={styles.notCheckedInContainer}>
            <EmptyState
              icon="time-outline"
              title="Not currently checked in"
              subtitle="Select a location and arrive to auto check in."
            />

            <Pressable
              style={[styles.selectLocationButton, { backgroundColor: t.colors.primary }]}
              onPress={() => navigation.navigate('Location Selection')}
            >
              <Ionicons name="location-outline" size={20} color="#ffffff" />
              <Text style={styles.selectLocationText}>Select Location</Text>
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

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
          <Text style={[styles.headerTitle, { color: t.colors.text }]}>Attendance Status</Text>
          <Pressable
            style={[styles.refreshButton, { backgroundColor: t.colors.background }]}
            onPress={handleRefreshStatus}
            disabled={isRefreshing}
          >
            <Ionicons
              name={isRefreshing ? "sync" : "refresh"}
              size={18}
              color={t.colors.text}
              style={isRefreshing && styles.spinning}
            />
          </Pressable>
        </View>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Enhanced Status Overview with Animations */}
          <Animated.View
            style={[
              styles.statusCard,
              {
                backgroundColor: t.colors.card,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <Animated.View
              style={[
                styles.statusHeader,
                attendanceStatus.isCheckedIn && { transform: [{ scale: pulseAnim }] }
              ]}
            >
              <View style={styles.statusIconContainer}>
                <Ionicons name="location" size={24} color="#22c55e" />
              </View>
              <Text style={[styles.statusTitle, { color: t.colors.text }]}>
                Currently Checked In
              </Text>
              {attendanceStatus.isCheckedIn && (
                <View style={styles.activePulse}>
                  <View style={styles.activeDot} />
                </View>
              )}
            </Animated.View>

            <Text style={[styles.locationName, { color: t.colors.text }]}>
              {currentGeofence.name}
            </Text>

            <View style={styles.elapsedTimeContainer}>
              <Ionicons name="time-outline" size={20} color="#3b82f6" />
              <Text style={[styles.elapsedTimeLabel, { color: t.colors.textSecondary }]}>
                Time Elapsed:
              </Text>
              <Text style={[styles.elapsedTime, { color: t.colors.primary }]}>
                {formatElapsedTime(attendanceStatus.elapsedTime)}
              </Text>
            </View>

            <View style={styles.checkInInfo}>
              <Text style={[styles.checkInLabel, { color: t.colors.textSecondary }]}>
                Checked in at: {formatTime(attendanceStatus.checkInTime)}
              </Text>
              <Text style={[styles.dateLabel, { color: t.colors.textSecondary }]}>
                {getCurrentDate()}
              </Text>
            </View>
          </Animated.View>

          {/* Map Preview */}
          <View style={[styles.mapCard, { backgroundColor: t.colors.card }]}>
            <Text style={[styles.mapTitle, { color: t.colors.text }]}>
              Location Preview
            </Text>

            <View style={styles.mapContainer}>
              <GeofenceMap
                style={styles.map}
                region={getMapRegion()}
                location={location}
                geofenceData={currentGeofenceData}
                geofenceName={currentGeofence?.name}
              />
            </View>
          </View>

          {/* Quick Actions */}
          <View style={[styles.actionsCard, { backgroundColor: t.colors.card }]}>
            <Text style={[styles.actionsTitle, { color: t.colors.text }]}>
              Quick Actions
            </Text>

            <View style={styles.actionButtons}>
              <Pressable
                style={[styles.actionButton, { backgroundColor: '#3b82f6' }]}
                onPress={() => navigation.navigate('Location Selection')}
              >
                <Ionicons name="location-outline" size={20} color="#ffffff" />
                <Text style={styles.actionButtonText}>Change Location</Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, { backgroundColor: '#f59e0b' }]}
                onPress={handleRefreshStatus}
                disabled={isRefreshing}
              >
                <Ionicons name={isRefreshing ? "sync" : "refresh"} size={20} color="#ffffff" />
                <Text style={styles.actionButtonText}>
                  {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Check Out Button */}
          <Pressable
            style={[styles.checkOutButton, { backgroundColor: '#ef4444' }]}
            onPress={handleCheckOut}
          >
            <Ionicons name="log-out-outline" size={24} color="#ffffff" />
            <Text style={styles.checkOutText}>Check Out</Text>
          </Pressable>
        </ScrollView>
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
  headerRight: {
    width: 40,
  },
  refreshButton: {
    padding: 6,
    borderRadius: 6,
  },
  spinning: {
    transform: [{ rotate: '45deg' }],
  },
  scrollContainer: {
    flex: 1,
  },
  statusCard: {
    margin: 16,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.1)',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 16,
    flex: 1,
  },
  activePulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  locationName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  elapsedTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  elapsedTimeLabel: {
    fontSize: 14,
    marginLeft: 8,
  },
  elapsedTime: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 8,
  },
  checkInInfo: {
    marginTop: 8,
  },
  checkInLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 12,
  },
  mapCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1f2937',
  },
  mapContainer: {
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  actionsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    color: '#374151',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  checkOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 32,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  checkOutText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
    letterSpacing: 0.5,
  },
  notCheckedInContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  notCheckedInTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  notCheckedInSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  selectLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  selectLocationText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default AttendanceStatusScreen;
