// @ts-nocheck
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Animated, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLocation } from '../context/LocationContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import EmptyState from '../components/ui/EmptyState';

const AttendanceStatusScreen = ({ navigation }) => {
  const {
    attendanceStatus,
    currentGeofence,
    selectedGeofence,
    loadGeofences,
    manualCheckOut,
    startLocationTracking,
    stopLocationTracking,
    verifyAttendanceStatus
  } = useLocation();

  const t = useThemeTokens();
  const { t: tr, locale } = useI18n();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Native driver is only supported on iOS and Android, not on web
  // Explicitly set to false on web to prevent warnings
  const USE_NATIVE_DRIVER = Platform.OS === 'ios' || Platform.OS === 'android';

  // Verify attendance status when screen is focused
  useFocusEffect(
    useCallback(() => {
      verifyAttendanceStatus().catch(() => {
        // Silently handle errors
      });
    }, [verifyAttendanceStatus])
  );


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

  // Helper to get display geofence name (used before early return)
  const getDisplayGeofenceName = () => {
    const displayGeofence = currentGeofence || selectedGeofence;
    return attendanceStatus.locationName || displayGeofence?.name || tr('attendance.currentLocation');
  };

  const handleCheckOut = async () => {
    const locationName = getDisplayGeofenceName();

    // On web, Alert.alert might not work, so use window.confirm as fallback
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(tr('attendance.checkoutConfirmWeb', { place: locationName }));
      if (!confirmed) {
        return;
      }
      
      try {
        await manualCheckOut();
        window.alert(tr('attendance.checkedOutWeb'));
        // Small delay to ensure backend has processed the checkout before navigating
        setTimeout(() => {
          navigation.navigate('Attendance History', { refresh: true });
        }, 1000);
      } catch (error) {
        console.error('[AttendanceStatusScreen] Manual checkout failed:', error);
        const errorMessage = error?.message || tr('attendance.checkoutFail');
        window.alert(`${tr('attendance.errorPrefix')} ${errorMessage}`);
      }
    } else {
      Alert.alert(
        tr('attendance.checkoutTitle'),
        tr('attendance.checkoutConfirmWeb', { place: locationName }),
        [
          { text: tr('common.cancel'), style: 'cancel' },
          {
            text: tr('attendance.checkoutAction'),
            style: 'destructive',
            onPress: async () => {
              try {
                await manualCheckOut();
                Alert.alert(tr('attendance.success'), tr('attendance.checkedOutWeb'));
                // Small delay to ensure backend has processed the checkout before navigating
                setTimeout(() => {
                  navigation.navigate('Attendance History', { refresh: true });
                }, 1000);
              } catch (error) {
                console.error('[AttendanceStatusScreen] Manual checkout failed:', error);
                const errorMessage = error?.message || 'Failed to check out. Please try again.';
                Alert.alert('Error', errorMessage);
              }
            }
          }
        ]
      );
    }
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

      Alert.alert(tr('attendance.success'), tr('attendance.refreshOk'));
    } catch (_error) {
      Alert.alert(tr('attendance.error'), tr('attendance.refreshFail'));
    } finally {
      setIsRefreshing(false);
    }
  };


  const formatElapsedTime = (milliseconds) => {
    if (!milliseconds) return '00:00:00';

    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTime = (date) => {
    if (!date) return tr('attendance.na');
    return new Date(date).toLocaleTimeString(locale === 'es' ? 'es-ES' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getCurrentDate = () => {
    return new Date().toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // If user is not checked in, show status message
  // Only show message if truly not checked in
  // If checked in but currentGeofence is null, we'll use attendanceStatus.locationName
  if (!attendanceStatus.isCheckedIn) {
    const hasSelectedLocation = !!selectedGeofence;
    
    // If user is checked out, show checkout message (only for today)
    if (attendanceStatus.isCheckedOut && attendanceStatus.checkOutTime) {
      // Use UTC for consistent date comparison
      const now = new Date();
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const checkOutDate = new Date(attendanceStatus.checkOutTime);
      const checkOutDateUTC = new Date(Date.UTC(
        checkOutDate.getUTCFullYear(),
        checkOutDate.getUTCMonth(),
        checkOutDate.getUTCDate(),
        0, 0, 0, 0
      ));
      
      // Only show checkout message if checkout was today (in UTC)
      if (checkOutDateUTC.getTime() === today.getTime()) {
        // If manual checkout, show cooldown message
        if (attendanceStatus.isManualCheckout && attendanceStatus.nextCheckInTime) {
          const nextCheckInTime = new Date(attendanceStatus.nextCheckInTime);
          const now = new Date();
          const canCheckIn = now >= nextCheckInTime;
          
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
                  <Text style={[styles.headerTitle, { color: t.colors.text }]}>{tr('attendance.statusScreenTitle')}</Text>
                  <View style={styles.headerRight} />
                </View>

                <View style={styles.notCheckedInContainer}>
                  <EmptyState
                    icon="time-outline"
                    title={tr('attendance.cooldownTitle')}
                    subtitle={canCheckIn 
                      ? tr('attendance.cooldownSubtitleNow', { time: formatTime(attendanceStatus.checkOutTime) })
                      : tr('attendance.cooldownSubtitleWait', { time: formatTime(attendanceStatus.nextCheckInTime) })}
                  />
                  <View style={styles.infoMessage}>
                    <Ionicons name="information-circle-outline" size={20} color={t.colors.textSecondary} />
                    <Text style={[styles.infoText, { color: t.colors.textSecondary }]}>
                      {canCheckIn 
                        ? tr('attendance.cooldownInfoOk')
                        : tr('attendance.cooldownInfoWait', { time: formatTime(attendanceStatus.checkOutTime) })}
                    </Text>
                  </View>
                </View>
              </View>
            </Screen>
          );
        }
        
        // Automatic checkout - show default message
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
                <Text style={[styles.headerTitle, { color: t.colors.text }]}>{tr('attendance.statusScreenTitle')}</Text>
                <View style={styles.headerRight} />
              </View>

              <View style={styles.notCheckedInContainer}>
                <EmptyState
                  icon="log-out-outline"
                  title={tr('attendance.alreadyOutTitle')}
                  subtitle={tr('attendance.alreadyOutSubtitle', { time: formatTime(attendanceStatus.checkOutTime) })}
                />
                <View style={styles.infoMessage}>
                  <Ionicons name="information-circle-outline" size={20} color={t.colors.textSecondary} />
                  <Text style={[styles.infoText, { color: t.colors.textSecondary }]}>
                    {tr('attendance.alreadyOutInfo')}
                  </Text>
                </View>
              </View>
            </View>
          </Screen>
        );
      }
    }
    
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
            <Text style={[styles.headerTitle, { color: t.colors.text }]}>{tr('attendance.statusScreenTitle')}</Text>
            <View style={styles.headerRight} />
          </View>

          <View style={styles.notCheckedInContainer}>
            {hasSelectedLocation ? (
              <>
                <EmptyState
                  icon="time-outline"
                  title={tr('attendance.notInTitle')}
                  subtitle={tr('attendance.notInSubtitle', { name: selectedGeofence.name })}
                />
                <View style={styles.infoMessage}>
                  <Ionicons name="information-circle-outline" size={20} color={t.colors.textSecondary} />
                  <Text style={[styles.infoText, { color: t.colors.textSecondary }]}>
                    {tr('attendance.notInInfo')}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <EmptyState
                  icon="location-outline"
                  title={tr('attendance.noLocPickTitle')}
                  subtitle={tr('attendance.noLocPickSubtitle')}
                />
                <View style={styles.infoMessage}>
                  <Ionicons name="information-circle-outline" size={20} color={t.colors.textSecondary} />
                  <Text style={[styles.infoText, { color: t.colors.textSecondary }]}>
                    {tr('attendance.noLocPickHint')}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Screen>
    );
  }

  // If checked in but currentGeofence is not set yet, try to load it or use selectedGeofence
  // This can happen if user is already inside when they select the geofence
  const displayGeofence = currentGeofence || selectedGeofence;
  const displayGeofenceName = attendanceStatus.locationName || displayGeofence?.name || tr('attendance.currentLocation');

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
          <Text style={[styles.headerTitle, { color: t.colors.text }]}>{tr('attendance.statusScreenTitle')}</Text>
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
                {tr('attendance.checkedInHeader')}
              </Text>
              {attendanceStatus.isCheckedIn && (
                <View style={styles.activePulse}>
                  <View style={styles.activeDot} />
                </View>
              )}
            </Animated.View>

            <Text style={[styles.locationName, { color: t.colors.text }]}>
              {displayGeofenceName}
            </Text>

            <View style={styles.elapsedTimeContainer}>
              <Ionicons name="time-outline" size={20} color="#3b82f6" />
              <Text style={[styles.elapsedTimeLabel, { color: t.colors.textSecondary }]}>
                {tr('attendance.timeElapsed')}:
              </Text>
              <Text style={[styles.elapsedTime, { color: t.colors.primary }]}>
                {formatElapsedTime(attendanceStatus.elapsedTime)}
              </Text>
            </View>

            <View style={styles.checkInInfo}>
              <Text style={[styles.checkInLabel, { color: t.colors.textSecondary }]}>
                {tr('attendance.checkedInAt', { time: formatTime(attendanceStatus.checkInTime) })}
              </Text>
              <Text style={[styles.dateLabel, { color: t.colors.textSecondary }]}>
                {getCurrentDate()}
              </Text>
            </View>
          </Animated.View>

          {/* Quick Actions */}
          <View style={[styles.actionsCard, { backgroundColor: t.colors.card }]}>
            <Text style={[styles.actionsTitle, { color: t.colors.text }]}>
              {tr('attendance.quickActions')}
            </Text>

            <View style={styles.actionButtons}>
              <Pressable
                style={[styles.actionButton, { backgroundColor: '#3b82f6' }]}
                onPress={() => navigation.navigate('Location Selection')}
              >
                <Ionicons name="location-outline" size={20} color="#ffffff" />
                <Text style={styles.actionButtonText}>{tr('attendance.changeLocation')}</Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, { backgroundColor: '#f59e0b' }]}
                onPress={handleRefreshStatus}
                disabled={isRefreshing}
              >
                <Ionicons name={isRefreshing ? "sync" : "refresh"} size={20} color="#ffffff" />
                <Text style={styles.actionButtonText}>
                  {isRefreshing ? tr('attendance.refreshing') : tr('attendance.refreshStatus')}
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
            <Text style={styles.checkOutText}>{tr('attendance.checkoutAction')}</Text>
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
  infoMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    maxWidth: '90%',
  },
  infoText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
});

export default AttendanceStatusScreen;
