import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Modal, TextInput } from 'react-native';
import GeofenceMap, { Polygon, Marker, PROVIDER_GOOGLE } from '../components/GeofenceMap';
import { useLocation } from '../context/LocationContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import EmptyState from '../components/ui/EmptyState';

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

const LOCATION_CARD_ITEM_WIDTH = 182;

// Time Input Component - Simple text input for time (HH:MM format)
const TimeInput = ({ label, value, onChange, colors, placeholder }) => {
  const [localValue, setLocalValue] = useState(value || '');

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleChange = (text) => {
    // Remove any non-digit characters except colon
    let cleaned = text.replace(/[^\d:]/g, '');
    
    // Auto-format as user types (HH:MM)
    if (cleaned.length <= 2) {
      setLocalValue(cleaned);
      if (cleaned.length === 2 && !cleaned.includes(':')) {
        cleaned = cleaned + ':';
        setLocalValue(cleaned);
      }
    } else if (cleaned.length <= 5) {
      // Format as HH:MM
      if (cleaned.length === 3 && !cleaned.includes(':')) {
        cleaned = cleaned.slice(0, 2) + ':' + cleaned.slice(2);
      }
      setLocalValue(cleaned);
    }

    // Validate and update parent
    if (cleaned.length === 5) {
      const [hours, minutes] = cleaned.split(':');
      if (hours && minutes) {
        const h = parseInt(hours, 10);
        const m = parseInt(minutes, 10);
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          onChange(cleaned);
        }
      }
    } else if (cleaned.length < 5) {
      onChange(cleaned);
    }
  };

  return (
    <View style={styles.timeInputContainer}>
      <Text style={[styles.timeInputLabel, { color: colors.text }]}>{label}</Text>
      <TextInput
        style={[
          styles.timeInput,
          {
            borderColor: colors.border,
            backgroundColor: colors.background,
            color: colors.text,
          }
        ]}
        value={localValue}
        onChangeText={handleChange}
        placeholder={placeholder || 'HH:MM'}
        placeholderTextColor={colors.textSecondary}
        keyboardType="numeric"
        maxLength={5}
      />
    </View>
  );
};

const LocationCardItem = React.memo(({
  geofence,
  colors,
  selectedId,
  currentId,
  isCheckedIn,
  elapsedTime,
  onSelect
}) => {
  const isSelected = selectedId === geofence.id;
  const isCurrent = currentId === geofence.id;
  const isCheckedInHere = isCheckedIn && isCurrent;

  return (
    <Pressable
      style={[
        styles.locationCard,
        {
          backgroundColor: isCurrent ? 'rgba(34, 197, 94, 0.05)' : colors.card,
          borderColor: isCurrent ? '#22c55e' : isSelected ? '#3b82f6' : colors.border,
          borderWidth: isSelected || isCurrent ? 2 : 1,
          shadowColor: isCurrent ? '#22c55e' : isSelected ? '#3b82f6' : '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isSelected || isCurrent ? 0.2 : 0.05,
          shadowRadius: 3,
          elevation: isSelected || isCurrent ? 4 : 2,
        }
      ]}
      onPress={() => onSelect(geofence)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <Text style={[
            styles.cardTitle,
            {
              color: colors.text,
              fontWeight: isCurrent ? '700' : '600'
            }
          ]}>
            {geofence.name}
          </Text>
          {isCurrent && (
            <View style={styles.currentBadge}>
              <Ionicons name="location" size={12} color="#22c55e" />
              <Text style={styles.currentBadgeText}>Current</Text>
            </View>
          )}
        </View>
        {isSelected && !isCurrent && (
          <View style={styles.selectedBadge}>
            <Ionicons name="radio-button-on" size={16} color="#3b82f6" />
          </View>
        )}
      </View>

      <Text style={[styles.cardAddress, { color: colors.textSecondary }]}>
        📍 {geofence.address || 'No address specified'}
      </Text>

      <View style={styles.cardStatus}>
        <View style={styles.statusContainer}>
          <View style={[
            styles.statusIndicator,
            {
              backgroundColor: isCheckedInHere ? '#22c55e' :
                             isCurrent ? '#f59e0b' : '#6b7280'
            }
          ]} />
          <Text style={[
            styles.cardStatusText,
            {
              color: isCheckedInHere ? '#22c55e' :
                   isCurrent ? '#f59e0b' : colors.textSecondary,
              fontWeight: isCheckedInHere ? '600' : '400'
            }
          ]}>
            {isCheckedInHere ? 'Checked In' : isCurrent ? 'At Location' : 'Available'}
          </Text>
        </View>

        {isCheckedInHere && (
          <View style={styles.elapsedContainer}>
            <Ionicons name="time-outline" size={14} color="#22c55e" />
            <Text style={styles.elapsedText}>
              {formatElapsedTime(elapsedTime)}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});
LocationCardItem.displayName = 'LocationCardItem';

const formatElapsedTime = (milliseconds) => {
  if (!milliseconds) return '00:00:00';

  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const LocationSelectionScreen = ({ navigation }) => {
  const {
    geofences,
    currentGeofence,
    selectedGeofence,
    attendanceStatus,
    location,
    locationPermission,
    isTracking,
    loadGeofences,
    startLocationTracking,
    stopLocationTracking,
    setSelectedGeofence,
    workingHours,
    setWorkingHoursForLocation
  } = useLocation();

  const t = useThemeTokens();
  const [lastCheckInTime, setLastCheckInTime] = useState(null);
  const [lastCheckOutTime, setLastCheckOutTime] = useState(null);
  const [geofenceError, setGeofenceError] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [showWorkingHoursModal, setShowWorkingHoursModal] = useState(false);
  const [tempStartTime, setTempStartTime] = useState('08:00');
  const [tempEndTime, setTempEndTime] = useState('16:30');
  const mapRef = useRef(null);

  useEffect(() => {
    // Load geofences with error handling
    loadGeofences().catch((error) => {
      console.error('Failed to load geofences:', error);
      setGeofenceError(error.message || 'Failed to load locations');
    });

    // Start location tracking when screen opens with error handling
    startLocationTracking().catch((error) => {
      console.error('Failed to start location tracking:', error);
      setLocationError(error.message || 'Location permissions not granted');
    });

    // Cleanup: stop location tracking when screen unmounts
    return () => {
      stopLocationTracking().catch(() => {
        // Ignore cleanup errors
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update timestamps when attendance status changes
  useEffect(() => {
    if (attendanceStatus.isCheckedIn) {
      setLastCheckInTime(attendanceStatus.checkInTime);
    } else if (attendanceStatus.checkOutTime) {
      setLastCheckOutTime(attendanceStatus.checkOutTime);
    }
  }, [attendanceStatus]);

  const handleGeofenceSelect = useCallback((geofence) => {
    setSelectedGeofence(geofence);
    // Show working hours modal when selecting a geofence
    if (geofence) {
      // Set initial time values
      setTempStartTime(workingHours.startTime || '08:00');
      setTempEndTime(workingHours.endTime || '16:30');
      setShowWorkingHoursModal(true);
    }
    // Animate map to selected geofence
    if (mapRef.current && geofence.coordinates && geofence.coordinates.length > 0) {
      const center = geofence.coordinates.reduce(
        (acc, coord) => ({
          latitude: acc.latitude + coord[1] / geofence.coordinates.length,
          longitude: acc.longitude + coord[0] / geofence.coordinates.length,
        }),
        { latitude: 0, longitude: 0 }
      );

      mapRef.current.animateToRegion(
        {
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        1000
      );
    }
  }, [setSelectedGeofence, workingHours]);

  const handleSaveWorkingHours = () => {
    // Validate times
    const validateTime = (timeStr) => {
      if (!timeStr || timeStr.length !== 5) return false;
      const [hours, minutes] = timeStr.split(':');
      if (!hours || !minutes) return false;
      const h = parseInt(hours, 10);
      const m = parseInt(minutes, 10);
      return h >= 0 && h <= 23 && m >= 0 && m <= 59;
    };

    if (!validateTime(tempStartTime) || !validateTime(tempEndTime)) {
      // Show error or use default
      return;
    }

    setWorkingHoursForLocation({
      startTime: tempStartTime,
      endTime: tempEndTime
    });
    
    setShowWorkingHoursModal(false);
  };

  const formatTimeForDisplay = (timeStr) => {
    if (!timeStr) return '08:00';
    const [hour, minute] = timeStr.split(':');
    return `${hour}:${minute}`;
  };

  const renderGeofenceItem = useCallback(
    ({ item }) => (
      <LocationCardItem
        geofence={item}
        colors={t.colors}
        selectedId={selectedGeofence?.id}
        currentId={currentGeofence?.id}
        isCheckedIn={attendanceStatus.isCheckedIn}
        elapsedTime={attendanceStatus.elapsedTime}
        onSelect={handleGeofenceSelect}
      />
    ),
    [attendanceStatus.elapsedTime, attendanceStatus.isCheckedIn, currentGeofence?.id, handleGeofenceSelect, selectedGeofence?.id, t.colors]
  );

  const getItemLayout = useCallback((_, index) => ({
    length: LOCATION_CARD_ITEM_WIDTH,
    offset: LOCATION_CARD_ITEM_WIDTH * index,
    index
  }), []);

  const handleRefreshLocation = async () => {
    try {
      setLocationError(null);
      if (!isTracking) {
        await startLocationTracking();
      } else {
        // Force a location refresh by stopping and starting
        await stopLocationTracking();
        setTimeout(() => {
          startLocationTracking().catch((error) => {
            setLocationError(error.message || 'Failed to start location tracking');
          });
        }, 1000);
      }
    } catch (error) {
      console.error('Error refreshing location:', error);
      setLocationError(error.message || 'Failed to refresh location');
    }
  };

  const getMapRegion = () => {
    if (location) {
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    // Default to first geofence center if available
    if (geofences.length > 0) {
      const firstGeofence = geofences[0];
      // Try polygon coordinates first
      if (firstGeofence.coordinates && firstGeofence.coordinates.length > 0) {
        const coords = firstGeofence.coordinates[0];
        return {
          latitude: coords[1],
          longitude: coords[0],
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
      }
      // Try circle center if available
      if (firstGeofence.center && firstGeofence.center.length === 2) {
        return {
          latitude: firstGeofence.center[1],
          longitude: firstGeofence.center[0],
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
      }
    }
    // Return null to indicate no valid region (map will handle this)
    return null;
  };

  const getPolygonColor = (geofence) => {
    if (currentGeofence?.id === geofence.id) {
      return 'rgba(34, 197, 94, 0.4)'; // Green for current location - more visible
    }
    if (selectedGeofence?.id === geofence.id) {
      return 'rgba(59, 130, 246, 0.4)'; // Blue for selected - more visible
    }
    return 'rgba(156, 163, 175, 0.2)'; // Gray for others - more subtle
  };

  const getPolygonBorderColor = (geofence) => {
    if (currentGeofence?.id === geofence.id) {
      return '#22c55e'; // Green border
    }
    if (selectedGeofence?.id === geofence.id) {
      return '#3b82f6'; // Blue border
    }
    return '#9ca3af'; // Gray border
  };

  const formatTime = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header with Location Status */}
        <View style={[styles.header, { backgroundColor: t.colors.card, borderBottomColor: t.colors.border }]}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={t.colors.text} />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: t.colors.text }]}>Location Selection</Text>
            {currentGeofence && (
              <Text style={[styles.headerSubtitle, { color: t.colors.textSecondary }]}>
                Current: {currentGeofence.name}
              </Text>
            )}
          </View>

          <View style={styles.headerRight}>
            <Pressable
              style={[styles.refreshButton, { backgroundColor: t.colors.background }]}
              onPress={handleRefreshLocation}
            >
              <Ionicons name="refresh" size={18} color={t.colors.text} />
            </Pressable>
          </View>
        </View>

        {/* Enhanced Status Bar with Animations */}
        <View style={[styles.statusBar, { backgroundColor: t.colors.card, borderBottomColor: t.colors.border, borderBottomWidth: 1 }]}>
          <View style={styles.statusItem}>
            <View style={[
              styles.statusIconContainer,
              { backgroundColor: locationPermission ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }
            ]}>
              <Ionicons
                name={locationPermission ? "location" : "location-outline"}
                size={16}
                color={locationPermission ? "#22c55e" : "#ef4444"}
              />
            </View>
            <Text style={[styles.statusText, { color: t.colors.text }]}>
              {locationPermission ? "Location Active" : locationError ? "Location Error" : "Location Disabled"}
            </Text>
          </View>

          <View style={styles.statusItem}>
            <View style={[
              styles.statusIconContainer,
              { backgroundColor: attendanceStatus.isCheckedIn ? 'rgba(34, 197, 94, 0.1)' : 'rgba(156, 163, 175, 0.1)' }
            ]}>
              <Ionicons
                name={attendanceStatus.isCheckedIn ? "time" : "time-outline"}
                size={16}
                color={attendanceStatus.isCheckedIn ? "#22c55e" : t.colors.textSecondary}
              />
            </View>
            <Text style={[styles.statusText, { color: t.colors.text }]}>
              {attendanceStatus.isCheckedIn ? formatElapsedTime(attendanceStatus.elapsedTime) : "Not Checked In"}
            </Text>
          </View>
        </View>

        {/* Map View */}
        <View style={styles.mapContainer}>
          {(() => {
            const mapRegion = getMapRegion();
            return mapRegion ? (
              <GeofenceMap
                ref={mapRef}
                style={styles.map}
                region={mapRegion}
                showsUserLocation={true}
                showsMyLocationButton={true}
                provider={PROVIDER_GOOGLE}
              >
            {/* User Location Marker */}
            {location && (
              <Marker
                coordinate={{
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                }}
                title="Your Location"
                description={`Accuracy: ${Math.round(location.coords.accuracy)}m`}
                pinColor={attendanceStatus.isCheckedIn ? "green" : "blue"}
              />
            )}

            {/* Geofence Polygons */}
            {geofences.map((geofence) => (
              geofence.coordinates && geofence.coordinates.length > 0 ? (
                <Polygon
                  key={geofence.id}
                  coordinates={geofence.coordinates.map(coord => ({
                    latitude: coord[1],
                    longitude: coord[0],
                  }))}
                  fillColor={getPolygonColor(geofence)}
                  strokeColor={getPolygonBorderColor(geofence)}
                  strokeWidth={3}
                  onPress={() => handleGeofenceSelect(geofence)}
                />
              ) : null
            ))}

            {/* Enhanced Geofence Labels with Better Design */}
            {geofences.map((geofence) => {
              if (!geofence.coordinates || geofence.coordinates.length === 0) return null;

              const center = geofence.coordinates.reduce(
                (acc, coord) => ({
                  latitude: acc.latitude + coord[1] / geofence.coordinates.length,
                  longitude: acc.longitude + coord[0] / geofence.coordinates.length,
                }),
                { latitude: 0, longitude: 0 }
              );

              const isSelected = selectedGeofence?.id === geofence.id;
              const isCurrent = currentGeofence?.id === geofence.id;

              return (
                <Marker
                  key={`label-${geofence.id}`}
                  coordinate={center}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={[
                    styles.geofenceLabel,
                    {
                      backgroundColor: isCurrent ? '#22c55e' : isSelected ? '#3b82f6' : t.colors.card,
                      borderColor: isCurrent ? '#22c55e' : isSelected ? '#3b82f6' : t.colors.border,
                      borderWidth: isSelected || isCurrent ? 2 : 1,
                      shadowColor: isCurrent ? '#22c55e' : isSelected ? '#3b82f6' : '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isSelected || isCurrent ? 0.3 : 0.1,
                      shadowRadius: 4,
                      elevation: isSelected || isCurrent ? 6 : 3,
                    }
                  ]}>
                    <Text style={[
                      styles.geofenceLabelText,
                      { color: isCurrent ? '#ffffff' : t.colors.text }
                    ]}>
                      {geofence.name}
                    </Text>
                    {isCurrent && (
                      <View style={styles.activeIndicator}>
                        <Ionicons name="checkmark-circle" size={14} color="#ffffff" />
                      </View>
                    )}
                    {isSelected && !isCurrent && (
                      <View style={styles.selectedIndicator}>
                        <Ionicons name="radio-button-on" size={12} color="#ffffff" />
                      </View>
                    )}
                  </View>
                </Marker>
              );
            })}
              </GeofenceMap>
            ) : (
              <View style={[styles.mapPlaceholder, { backgroundColor: t.colors.background }]}>
                <EmptyState
                  icon="map-outline"
                  title="No location data available"
                  subtitle={locationError || "Enable location services or wait for GPS signal"}
                />
              </View>
            );
          })()}
        </View>

        {/* Location List */}
        <View style={[styles.locationList, { backgroundColor: t.colors.background }]}>
          <Text style={[styles.listTitle, { color: t.colors.text }]}>Available Locations</Text>

          {geofenceError ? (
            <View style={styles.errorCard}>
              <View style={[styles.errorContainer, { backgroundColor: getRGBA(t.colors.danger, 0.1) }]}>
                <Ionicons name="alert-circle" size={20} color={t.colors.danger} />
                <Text style={[styles.errorText, { color: t.colors.danger }]}>
                  {geofenceError}
                </Text>
              </View>
              <Pressable
                style={[styles.retryButton, { backgroundColor: t.colors.primary }]}
                onPress={() => {
                  setGeofenceError(null);
                  loadGeofences().catch((error) => {
                    setGeofenceError(error.message || 'Failed to load locations');
                  });
                }}
              >
                <Ionicons name="refresh" size={16} color="#ffffff" />
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={geofences}
              keyExtractor={(item) => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.scrollContainer}
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={5}
              removeClippedSubviews
              renderItem={renderGeofenceItem}
              getItemLayout={getItemLayout}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <EmptyState
                    icon="location-outline"
                    title="No locations configured"
                    subtitle="Ask an admin to create a work location."
                  />
                </View>
              }
            />
          )}
        </View>

        {/* Action Panel */}
        {selectedGeofence && (
          <View style={[styles.actionPanel, { backgroundColor: t.colors.card, borderTopColor: t.colors.border }]}>
            <View style={styles.actionInfo}>
              <Text style={[styles.selectedLocation, { color: t.colors.text }]}>
                Selected: {selectedGeofence.name}
              </Text>
              <View style={styles.workingHoursRow}>
                <View style={styles.workingHoursInfo}>
                  <Ionicons name="time-outline" size={16} color={t.colors.textSecondary} />
                  <Text style={[styles.workingHoursText, { color: t.colors.text }]}>
                    Working Hours: {formatTimeForDisplay(workingHours.startTime)} - {formatTimeForDisplay(workingHours.endTime)}
                  </Text>
                </View>
                <Pressable
                  style={[styles.editHoursButton, { backgroundColor: getRGBA(t.colors.primary, 0.1), borderColor: t.colors.primary }]}
                  onPress={() => {
                    setTempStartTime(workingHours.startTime || '08:00');
                    setTempEndTime(workingHours.endTime || '16:30');
                    setShowWorkingHoursModal(true);
                  }}
                >
                  <Ionicons name="create-outline" size={14} color={t.colors.primary} />
                </Pressable>
              </View>
              <Text style={[styles.lastActivity, { color: t.colors.textSecondary }]}>
                Last check-in: {formatTime(lastCheckInTime)}
              </Text>
              <Text style={[styles.lastActivity, { color: t.colors.textSecondary }]}>
                Last check-out: {formatTime(lastCheckOutTime)}
              </Text>
              <Text style={[styles.lastActivity, { color: t.colors.textSecondary }]}>
                Auto check-in/out enabled. Resets daily.
              </Text>
            </View>
          </View>
        )}

        {/* Working Hours Modal */}
        <Modal
          visible={showWorkingHoursModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowWorkingHoursModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: t.colors.text }]}>Set Working Hours</Text>
                <Pressable onPress={() => setShowWorkingHoursModal(false)}>
                  <Ionicons name="close" size={20} color={t.colors.text} />
                </Pressable>
              </View>

              <TimeInput
                label="Start Time"
                value={tempStartTime}
                onChange={setTempStartTime}
                colors={t.colors}
                placeholder="08:00"
              />

              <TimeInput
                label="End Time"
                value={tempEndTime}
                onChange={setTempEndTime}
                colors={t.colors}
                placeholder="16:30"
              />

              <Text style={[styles.modalHint, { color: t.colors.textSecondary }]}>
                Location tracking will start 1 hour before start time and end 1 hour after end time.
              </Text>

              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalButton, { backgroundColor: t.colors.border }]}
                  onPress={() => setShowWorkingHoursModal(false)}
                >
                  <Text style={[styles.modalButtonText, { color: t.colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modalButton,
                    { backgroundColor: t.colors.primary },
                    (!tempStartTime || tempStartTime.length !== 5 || !tempEndTime || tempEndTime.length !== 5) && { opacity: 0.5 }
                  ]}
                  onPress={handleSaveWorkingHours}
                  disabled={!tempStartTime || tempStartTime.length !== 5 || !tempEndTime || tempEndTime.length !== 5}
                >
                  <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  refreshButton: {
    padding: 6,
    borderRadius: 6,
  },
  statusBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statusIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  geofenceLabel: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  geofenceLabelText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  activeIndicator: {
    marginLeft: 6,
  },
  selectedIndicator: {
    marginLeft: 6,
  },
  locationList: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  scrollContainer: {
    marginBottom: 8,
  },
  locationCard: {
    width: 170,
    padding: 14,
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardHeader: {
    marginBottom: 8,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    flex: 1,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  currentBadgeText: {
    fontSize: 10,
    color: '#22c55e',
    fontWeight: '600',
    marginLeft: 2,
  },
  selectedBadge: {
    marginLeft: 6,
  },
  cardAddress: {
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 16,
  },
  cardStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  cardStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  elapsedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  elapsedText: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyCardText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  actionPanel: {
    padding: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionInfo: {
    flex: 1,
  },
  selectedLocation: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  lastActivity: {
    fontSize: 12,
    marginBottom: 2,
  },
  mainActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 16,
  },
  mainActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  timeInputContainer: {
    marginBottom: 16,
  },
  timeInputLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    borderTopWidth: 1,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  modalHint: {
    fontSize: 10,
    marginTop: 6,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  modalButton: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LocationSelectionScreen;
