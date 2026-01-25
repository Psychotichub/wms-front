import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { booleanPointInPolygon, polygon as turfPolygon } from '@turf/turf';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { AppState, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { BACKGROUND_LOCATION_TASK } from '../tasks/backgroundLocationTask';

const LocationContext = createContext();

const getLocalDayKey = (date = new Date()) =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

const LEGACY_ATTENDANCE_KEY = 'currentAttendance';
const LEGACY_SELECTED_GEOFENCE_KEY = 'selectedGeofenceId';

// Haversine distance in meters between two lat/lon pairs
const haversineDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

export const LocationProvider = ({ children }) => {
  const { token, request, user, apiUrl } = useAuth();

  const [location, setLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  const [geofences, setGeofences] = useState([]);
  const [currentGeofence, setCurrentGeofence] = useState(null);

  const [attendanceStatus, setAttendanceStatus] = useState({
    isCheckedIn: false,
    checkInTime: null,
    checkOutTime: null,
    locationName: null,
    elapsedTime: 0,
    dayKey: null
  });

  const [selectedGeofenceId, setSelectedGeofenceId] = useState(null);
  const selectedGeofence = useMemo(
    () => geofences.find((g) => g.id === selectedGeofenceId) || null,
    [geofences, selectedGeofenceId]
  );

  const userId = user?.id || user?._id || user?.email || null;
  const storageKeys = useMemo(() => {
    if (!userId) return null;
    const safeApi = (apiUrl || 'default').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    return {
      attendance: `attendance:${safeApi}:${userId}`,
      selectedGeofenceId: `selectedGeofence:${safeApi}:${userId}`,
      workingHours: `workingHours:${safeApi}:${userId}`
    };
  }, [apiUrl, userId]);

  const [workingHours, setWorkingHoursState] = useState({ startTime: '08:00', endTime: '16:30' });

  const debounceTimerRef = useRef(null);
  const geofenceCooldownRef = useRef(new Map());
  const lastAttendanceActionRef = useRef(null);
  const locationSubscriptionRef = useRef(null);
  const notifReadyRef = useRef(false);
  const notifDisabledRef = useRef(false);
  const lastLocalNotifRef = useRef({ key: null, at: 0 });

  const isExpoGo = () =>
    Constants.executionEnvironment === 'storeClient' ||
    Constants.appOwnership === 'expo' ||
    !Constants.expoConfig?.hostUri;

  const ensureLocalNotificationsReady = async () => {
    if (notifReadyRef.current || notifDisabledRef.current) return;
    if (Platform.OS === 'web') {
      notifDisabledRef.current = true;
      return;
    }
    if (isExpoGo()) {
      // Expo Go has limited notifications behavior in newer SDKs; disable to avoid console spam.
      notifDisabledRef.current = true;
      return;
    }
    try {
      const perms = await Notifications.getPermissionsAsync();
      if (perms.status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        if (req.status !== 'granted') {
          // User denied -> stop attempting again and again.
          notifDisabledRef.current = true;
          return;
        }
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
      notifReadyRef.current = true;
    } catch {
      // Disable further attempts for this session to prevent repeated warnings.
      notifDisabledRef.current = true;
    }
  };

  const notifyGeofenceEvent = async ({ key, title, body }) => {
    if (Platform.OS === 'web') return;
    try {
      // Deduplicate: avoid firing the same notification repeatedly due to GPS jitter/retries.
      const now = Date.now();
      if (key && lastLocalNotifRef.current?.key === key && now - (lastLocalNotifRef.current?.at || 0) < 2 * 60 * 1000) {
        return;
      }

      await ensureLocalNotificationsReady();
      if (!notifReadyRef.current) return;
      // scheduleNotificationAsync still works without channel on iOS; on Android we set channel above.
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true },
        trigger: null,
      });

      if (key) {
        lastLocalNotifRef.current = { key, at: now };
      }
    } catch {
      // ignore
    }
  };

  // Check if geolocation is supported and in secure context (web only)
  const isGeolocationSupported = useCallback(() => {
    if (Platform.OS !== 'web') {
      return true; // Native platforms always support geolocation
    }
    
    // Check if geolocation API is available
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      console.error('[LocationContext] Geolocation API not supported in this browser');
      return false;
    }
    
    // Check for secure context (HTTPS or localhost)
    const isSecureContext = 
      window.isSecureContext || 
      window.location.protocol === 'https:' || 
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.localhost');
    
    if (!isSecureContext) {
      console.error('[LocationContext] Geolocation requires secure context (HTTPS or localhost)');
      return false;
    }
    
    return true;
  }, []);

  const requestPermissions = useCallback(async () => {
    try {
      // Check secure context on web
      if (Platform.OS === 'web' && !isGeolocationSupported()) {
        setLocationPermission(false);
        return false;
      }

      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      // On web, only request foreground permissions
      if (Platform.OS === 'web') {
        const granted = foregroundStatus === 'granted';
        setLocationPermission(granted);
        if (!granted) {
          console.warn('[LocationContext] Location permission denied by user');
        }
        return granted;
      }
      
      // On native, request both foreground and background
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      const granted = foregroundStatus === 'granted' && backgroundStatus === 'granted';
      setLocationPermission(granted);
      if (!granted) {
        console.warn('[LocationContext] Location permissions not fully granted:', {
          foreground: foregroundStatus,
          background: backgroundStatus
        });
      }
      return granted;
    } catch (error) {
      console.error('[LocationContext] Error requesting location permissions:', error);
      setLocationPermission(false);
      return false;
    }
  }, [isGeolocationSupported]);

  // Stop background location tracking (native only)
  const stopBackgroundLocationTracking = useCallback(async () => {
    // Skip on web - background tracking not supported
    if (Platform.OS === 'web') {
      return;
    }

    try {
      const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (isStarted) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        console.log('Background location tracking stopped');
      }
    } catch (error) {
      console.error('Error stopping background location tracking:', error);
    }
  }, []);

  const stopLocationTracking = useCallback(async () => {
    // Stop foreground tracking
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
    setIsTracking(false);

    // Stop background location tracking
    await stopBackgroundLocationTracking();
  }, [stopBackgroundLocationTracking]);

  const checkGeofenceStatus = (currentLoc, forceCheck = false) => {
    if (!currentLoc || geofences.length === 0) {
      console.log('[LocationContext] checkGeofenceStatus: No location or geofences available', {
        hasLocation: !!currentLoc,
        geofencesCount: geofences.length
      });
      return;
    }
    
    if (!selectedGeofenceId) {
      console.log('[LocationContext] checkGeofenceStatus: No geofence selected');
      if (currentGeofence) setCurrentGeofence(null);
      return;
    }

    // Check if within tracking window
    if (!isWithinTrackingWindow()) {
      console.log('[LocationContext] checkGeofenceStatus: Outside tracking window', {
        workingHours,
        currentTime: new Date().toTimeString()
      });
      return; // Don't check geofence if outside tracking window
    }

    const target = geofences.find((g) => g.id === selectedGeofenceId);
    if (!target) {
      console.warn('[LocationContext] checkGeofenceStatus: Selected geofence not found', {
        selectedGeofenceId,
        availableGeofenceIds: geofences.map(g => g.id)
      });
      if (currentGeofence) setCurrentGeofence(null);
      return;
    }

    const { latitude, longitude } = currentLoc.coords;
    const point = [longitude, latitude];

    let inside = null;

    try {
      if (target.type === 'circle' && target.center && target.radius) {
        const [centerLon, centerLat] = target.center;
        const distance = haversineDistanceMeters(latitude, longitude, centerLat, centerLon);
        console.log('[LocationContext] checkGeofenceStatus: Circle geofence check', {
          geofenceName: target.name,
          distance,
          radius: target.radius,
          isInside: distance <= target.radius
        });
        if (distance <= target.radius) {
          inside = target;
        }
      } else if (target.coordinates && target.coordinates.length > 0) {
        const polygon = turfPolygon([target.coordinates]);
        const isInside = booleanPointInPolygon(point, polygon);
        console.log('[LocationContext] checkGeofenceStatus: Polygon geofence check', {
          geofenceName: target.name,
          coordinatesCount: target.coordinates.length,
          isInside
        });
        if (isInside) {
          inside = target;
        }
      } else {
        console.warn('[LocationContext] checkGeofenceStatus: Geofence has invalid format', {
          geofenceId: target.id,
          geofenceName: target.name,
          type: target.type
        });
      }
    } catch (error) {
      console.error('[LocationContext] Error checking geofence:', error);
    }

    // If forceCheck is true, always trigger transition check (for when user is already inside)
    if (forceCheck && inside && !currentGeofence) {
      console.log('[LocationContext] checkGeofenceStatus: Force check - user already inside selected geofence');
      handleGeofenceTransition(inside, currentLoc);
    } else {
      handleGeofenceTransition(inside, currentLoc);
    }
  };

  const handleLocationUpdate = (newLocation) => {
    if (!newLocation?.coords?.accuracy || newLocation.coords.accuracy > 100) return;
    if (newLocation.coords.speed && newLocation.coords.speed > 27.8) return;

    if (attendanceStatus.isCheckedIn && attendanceStatus.dayKey) {
      const todayKey = getLocalDayKey();
      if (attendanceStatus.dayKey !== todayKey) {
        clearAttendanceState().catch(() => {});
        return;
      }
    }

    const hadLocation = !!location;
    const isFirstLocation = !hadLocation || !location;
    setLocation(newLocation);

    // AUTOMATIC CHECK: If a geofence is selected and this is the first location update, check immediately
    // This handles automatic check-in when app starts and location becomes available
    if (selectedGeofenceId && isFirstLocation && !attendanceStatus.isCheckedIn) {
      console.log('[LocationContext] handleLocationUpdate: AUTOMATIC CHECK - First location with saved geofence', {
        selectedGeofenceId,
        hadLocation,
        isCheckedIn: attendanceStatus.isCheckedIn
      });
      // Check immediately for automatic check-in
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        console.log('[LocationContext] handleLocationUpdate: AUTOMATIC CHECK - Triggering geofence check');
        // Check for early arrival first
        checkEarlyArrival(newLocation).catch((error) => {
          console.error('[LocationContext] handleLocationUpdate: Error checking early arrival', error);
        });
        // Then check geofence status (will trigger check-in if inside)
        checkGeofenceStatus(newLocation, true); // forceCheck = true to trigger check-in if inside
      }, 500); // Short debounce for automatic check
    } else if (selectedGeofenceId && !attendanceStatus.isCheckedIn) {
      // Check for early arrival on every location update if not checked in
      checkEarlyArrival(newLocation).catch((error) => {
        console.error('[LocationContext] handleLocationUpdate: Error checking early arrival', error);
      });
      
      // Normal debounced check for ongoing location updates
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        console.log('[LocationContext] handleLocationUpdate: Checking geofence status after debounce');
        checkGeofenceStatus(newLocation);
      }, 3000);
    } else if (selectedGeofenceId && attendanceStatus.isCheckedIn) {
      // Even if checked in, still check geofence status to detect if user left
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        checkGeofenceStatus(newLocation);
      }, 3000);
    }
  };

  // Store API config for background task
  const storeApiConfig = useCallback(async () => {
    if (!apiUrl || !token || !userId) return;
    try {
      await AsyncStorage.setItem('apiUrl', apiUrl);
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('userId', userId);
    } catch (error) {
      console.error('Error storing API config:', error);
    }
  }, [apiUrl, token, userId]);

  // Start background location tracking (native only, not supported on web)
  const startBackgroundLocationTracking = useCallback(async () => {
    // Skip background tracking on web
    if (Platform.OS === 'web') {
      console.log('Background location tracking skipped on web');
      return false;
    }

    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        console.log('Background location: Permissions not granted');
        return false;
      }

      // Check if task is already registered
      const isTaskDefined = TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK);
      if (!isTaskDefined) {
        console.log('Background location task not defined');
        return false;
      }

      // Check if already started
      const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (isStarted) {
        console.log('Background location tracking already started');
        return true;
      }

      // Start background location updates
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000, // 30 seconds
        distanceInterval: 50, // 50 meters
        foregroundService: {
          notificationTitle: 'Location Tracking Active',
          notificationBody: 'Tracking your location for automatic attendance',
          notificationColor: '#007AFF'
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true
      });

      console.log('Background location tracking started');
      return true;
    } catch (error) {
      console.error('Error starting background location tracking:', error);
      return false;
    }
  }, [requestPermissions]);

  // Get current location explicitly (one-time request)
  const getCurrentLocation = useCallback(async (options = {}) => {
    const {
      timeout = 15000, // 15 seconds default timeout
      maximumAge = 60000, // Accept cached location up to 1 minute old
      enableHighAccuracy = true
    } = options;

    try {
      // Check secure context on web
      if (Platform.OS === 'web' && !isGeolocationSupported()) {
        throw new Error('Geolocation not supported or not in secure context (HTTPS/localhost required)');
      }

      // Request permissions if not already granted
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      console.log('[LocationContext] Requesting current location...');
      
      // Use getCurrentPositionAsync for one-time location fetch
      const location = await Location.getCurrentPositionAsync({
        accuracy: enableHighAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced,
        maximumAge,
        timeout
      });

      if (!location || !location.coords) {
        throw new Error('Invalid location data received');
      }

      console.log('[LocationContext] Current location obtained:', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy
      });

      // Update location state
      setLocation(location);
      
      return location;
    } catch (error) {
      // Handle specific error types
      if (error.code === 'PERMISSION_DENIED' || error.message?.includes('permission')) {
        console.error('[LocationContext] Location permission denied');
        setLocationPermission(false);
        throw new Error('Location permission denied. Please enable location access in your browser/device settings.');
      } else if (error.code === 'POSITION_UNAVAILABLE' || error.message?.includes('unavailable')) {
        console.error('[LocationContext] Location unavailable');
        throw new Error('Location unavailable. Please check your GPS/network connection.');
      } else if (error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
        console.error('[LocationContext] Location request timeout');
        throw new Error('Location request timed out. Please try again.');
      } else if (error.message?.includes('secure context')) {
        console.error('[LocationContext] Not in secure context');
        throw new Error('Geolocation requires HTTPS or localhost. Please use a secure connection.');
      } else if (error.message?.includes('not supported')) {
        console.error('[LocationContext] Geolocation not supported');
        throw new Error('Geolocation is not supported in this browser.');
      } else {
        console.error('[LocationContext] Error getting current location:', error);
        throw new Error(error.message || 'Failed to get current location');
      }
    }
  }, [isGeolocationSupported, requestPermissions]);

  const startLocationTracking = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      throw new Error('Location permissions not granted');
    }

    // Store API config for background task (native only)
    if (Platform.OS !== 'web') {
      await storeApiConfig();
      // Start background location tracking (native only)
      await startBackgroundLocationTracking();
    }

    // Start foreground tracking for UI updates (works on all platforms including web)
    if (locationSubscriptionRef.current) return;

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: Platform.OS === 'web' ? 10000 : 5000, // Less frequent on web to save resources
        distanceInterval: Platform.OS === 'web' ? 20 : 10
      },
      handleLocationUpdate
    );

    locationSubscriptionRef.current = sub;
    setIsTracking(true);
    console.log(`[LocationContext] Foreground location tracking started on ${Platform.OS}`);
  };

  const getDeviceInfo = () => ({
    deviceId: Device.deviceName || `${Platform.OS}-${Constants.sessionId || 'unknown'}`,
    deviceName: Device.deviceName || 'Unknown Device',
    deviceType: Platform.OS,
    appVersion: Constants.expoConfig?.version || '1.0.0',
    osVersion: `${Platform.OS} ${Device.osVersion || 'unknown'}`
  });

  const bindDevice = async (deviceInfo) => {
    try {
      await request('/api/devices/bind', {
        method: 'POST',
        body: JSON.stringify(deviceInfo)
      });
    } catch (error) {
      console.error('Error binding device:', error);
    }
  };

  const handleCheckIn = async (geofence, currentLoc) => {
    const deviceInfo = getDeviceInfo();
    const checkInData = {
      locationId: geofence.id,
      locationName: geofence.name,
      latitude: currentLoc.coords.latitude,
      longitude: currentLoc.coords.longitude,
      timestamp: new Date().toISOString(),
      accuracy: currentLoc.coords.accuracy,
      deviceInfo
      // Removed speed, altitude, heading as they're not in the API schema
    };

    console.log('[LocationContext] handleCheckIn: Sending check-in request', {
      locationId: checkInData.locationId,
      locationName: checkInData.locationName,
      latitude: checkInData.latitude,
      longitude: checkInData.longitude,
      hasDeviceInfo: !!checkInData.deviceInfo
    });

    const result = await request('/api/employees/attendance/checkin', {
      method: 'POST',
      body: JSON.stringify(checkInData)
    });

    setAttendanceStatus({
      isCheckedIn: true,
      checkInTime: new Date(),
      checkOutTime: null,
      locationName: geofence.name,
      elapsedTime: 0,
      validationStatus: result.attendance?.validationStatus,
      dayKey: getLocalDayKey()
    });

    if (storageKeys?.attendance) {
      await AsyncStorage.setItem(
        storageKeys.attendance,
        JSON.stringify({
          ...checkInData,
          userId,
          checkInTime: new Date().toISOString(),
          dayKey: getLocalDayKey()
        })
      );
    }

    await bindDevice(deviceInfo);

    await notifyGeofenceEvent({
      key: `arrived:${geofence.id}`,
      title: 'Arrived',
      body: `You entered ${geofence.name}. Attendance check-in recorded.`,
    });
  };

  const handleCheckOut = async (geofence, currentLoc) => {
    const deviceInfo = getDeviceInfo();
    const checkOutData = {
      locationId: geofence.id,
      latitude: currentLoc.coords.latitude,
      longitude: currentLoc.coords.longitude,
      timestamp: new Date().toISOString(),
      accuracy: currentLoc.coords.accuracy,
      deviceInfo
    };

    await request('/api/employees/attendance/checkout', {
      method: 'POST',
      body: JSON.stringify(checkOutData)
    });

    setAttendanceStatus((prev) => ({
      ...prev,
      isCheckedIn: false,
      checkOutTime: new Date(),
      dayKey: null
    }));

    if (storageKeys?.attendance) {
      await AsyncStorage.removeItem(storageKeys.attendance);
    }

    try {
      await request('/api/time/stop', {
        method: 'POST',
        body: JSON.stringify({ notes: 'Auto-stopped due to check-out' })
      });
    } catch {
      // ignore if no active time entry
    }

    await notifyGeofenceEvent({
      key: `left:${geofence.id}`,
      title: 'Left',
      body: `You left ${geofence.name}. Attendance check-out recorded.`,
    });
  };

  const handleGeofenceTransition = (newGeofence, currentLoc) => {
    const now = Date.now();
    const wasInside = currentGeofence !== null;
    const isInside = newGeofence !== null;

    console.log('[LocationContext] handleGeofenceTransition', {
      wasInside,
      isInside,
      currentGeofenceName: currentGeofence?.name,
      newGeofenceName: newGeofence?.name,
      attendanceStatus: attendanceStatus.isCheckedIn ? 'checked in' : 'not checked in'
    });

    if (lastAttendanceActionRef.current && now - lastAttendanceActionRef.current < 30000) {
      console.log('[LocationContext] handleGeofenceTransition: Skipping - too soon after last action', {
        timeSinceLastAction: now - lastAttendanceActionRef.current
      });
      return;
    }

    if (!wasInside && isInside) {
      const cooldownKey = `checkin-${newGeofence.id}`;
      const last = geofenceCooldownRef.current.get(cooldownKey);
      if (!last || now - last > 60000) {
        console.log('[LocationContext] handleGeofenceTransition: Triggering check-in', {
          geofenceName: newGeofence.name,
          geofenceId: newGeofence.id
        });
        handleCheckIn(newGeofence, currentLoc).catch((error) => {
          console.error('[LocationContext] handleGeofenceTransition: Check-in failed', error);
        });
        geofenceCooldownRef.current.set(cooldownKey, now);
        lastAttendanceActionRef.current = now;
      } else {
        console.log('[LocationContext] handleGeofenceTransition: Check-in cooldown active', {
          timeSinceLastCheckIn: now - last
        });
      }
    } else if (wasInside && !isInside) {
      const cooldownKey = `checkout-${currentGeofence.id}`;
      const last = geofenceCooldownRef.current.get(cooldownKey);
      if (!last || now - last > 60000) {
        console.log('[LocationContext] handleGeofenceTransition: Triggering check-out', {
          geofenceName: currentGeofence.name,
          geofenceId: currentGeofence.id
        });
        handleCheckOut(currentGeofence, currentLoc).catch((error) => {
          console.error('[LocationContext] handleGeofenceTransition: Check-out failed', error);
        });
        geofenceCooldownRef.current.set(cooldownKey, now);
        lastAttendanceActionRef.current = now;
      } else {
        console.log('[LocationContext] handleGeofenceTransition: Check-out cooldown active', {
          timeSinceLastCheckOut: now - last
        });
      }
    } else if (wasInside && isInside && currentGeofence?.id === newGeofence?.id) {
      console.log('[LocationContext] handleGeofenceTransition: Already inside same geofence, no action needed');
    }

    setCurrentGeofence(newGeofence);
  };

  const clearAttendanceState = useCallback(async () => {
    setAttendanceStatus({
      isCheckedIn: false,
      checkInTime: null,
      checkOutTime: null,
      locationName: null,
      elapsedTime: 0,
      dayKey: null
    });
    setCurrentGeofence(null);
    if (storageKeys?.attendance) {
      await AsyncStorage.removeItem(storageKeys.attendance);
    }
  }, [storageKeys]);

  const loadGeofences = async () => {
    try {
      const data = await request('/api/locations/geofences');
      setGeofences(data.geofences || []);
      return data.geofences || [];
    } catch (error) {
      console.error('Error loading geofences:', error);
      throw error; // Re-throw so caller can handle it
    }
  };

  const manualCheckOut = async () => {
    if (!currentGeofence || !location) return;
    geofenceCooldownRef.current.delete(`checkout-${currentGeofence.id}`);
    lastAttendanceActionRef.current = null;
    await handleCheckOut(currentGeofence, location);
  };

  const clearGeofenceCooldowns = () => {
    geofenceCooldownRef.current.clear();
    lastAttendanceActionRef.current = null;
  };

  const verifyAttendanceStatus = async () => {
    if (!token) return;
    try {
      const data = await request('/api/employees/attendance/current');
      if (!data?.success) return;

      if (!data.isCheckedIn && attendanceStatus.isCheckedIn) {
        await clearAttendanceState();
      }
    } catch (error) {
      console.error('Error verifying attendance status:', error);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        if (!token || !storageKeys?.attendance) return;
        await AsyncStorage.multiRemove([LEGACY_ATTENDANCE_KEY, LEGACY_SELECTED_GEOFENCE_KEY]);
        const saved = await AsyncStorage.getItem(storageKeys.attendance);
        if (!saved) return;

        const data = JSON.parse(saved);
        if (data?.userId && data.userId !== userId) {
          await clearAttendanceState();
          return;
        }
        const checkInTime = new Date(data.checkInTime);
        const dayKey = data.dayKey || getLocalDayKey(checkInTime);
        const todayKey = getLocalDayKey();
        if (dayKey !== todayKey) {
          await clearAttendanceState();
          return;
        }

        setAttendanceStatus({
          isCheckedIn: true,
          checkInTime,
          checkOutTime: null,
          locationName: data.locationName,
          elapsedTime: Date.now() - checkInTime.getTime(),
          dayKey
        });

        if (token) {
          const gf = await loadGeofences();
          const current = gf.find((g) => g.name === data.locationName);
          if (current) setCurrentGeofence(current);
        }

        await startLocationTracking();
      } catch (error) {
        console.error('Error initializing location context:', error);
        if (storageKeys?.attendance) {
          await AsyncStorage.removeItem(storageKeys.attendance);
        }
      }
    };

    initialize();
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, storageKeys, userId]);

  useEffect(() => {
    const loadSelected = async () => {
      if (!token || !storageKeys?.selectedGeofenceId) {
        setSelectedGeofenceId(null);
        setWorkingHoursState({ startTime: '08:00', endTime: '16:30' });
        return;
      }
      const savedSelected = await AsyncStorage.getItem(storageKeys.selectedGeofenceId);
      if (savedSelected) {
        console.log('[LocationContext] AUTOMATIC: Loaded selected geofence from storage:', savedSelected);
        setSelectedGeofenceId(savedSelected);
        
        // AUTOMATIC CHECK: After loading saved geofence, load geofences and check status
        // This ensures automatic check-in when app starts if user is at the location
        console.log('[LocationContext] AUTOMATIC: Saved geofence loaded, loading geofences and checking status');
        
        // Load geofences first, then check status
        loadGeofences().then(async () => {
          console.log('[LocationContext] AUTOMATIC: Geofences loaded, checking status');
          // The useEffect at line 888 will handle the check when location becomes available
          // But we can also try to get location immediately if tracking is active
          if (isTracking && !attendanceStatus.isCheckedIn) {
            try {
              const currentLoc = await getCurrentLocation();
              if (currentLoc && currentLoc.coords) {
                console.log('[LocationContext] AUTOMATIC: Got location after loading geofences, checking status now');
                setTimeout(() => {
                  checkEarlyArrival(currentLoc).catch(() => {});
                  checkGeofenceStatus(currentLoc, true);
                }, 300);
              }
            } catch (error) {
              console.log('[LocationContext] AUTOMATIC: Location not available yet, will check when location updates:', error.message);
            }
          }
        }).catch((error) => {
          console.error('[LocationContext] AUTOMATIC: Failed to load geofences for automatic check', error);
        });
      }

      // Load working hours
      const savedWorkingHours = await AsyncStorage.getItem(storageKeys.workingHours);
      if (savedWorkingHours) {
        try {
          setWorkingHoursState(JSON.parse(savedWorkingHours));
        } catch (error) {
          console.error('Error loading working hours:', error);
        }
      }
    };
    loadSelected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, storageKeys, clearAttendanceState, isTracking, attendanceStatus.isCheckedIn]);

  useEffect(() => {
    const persistSelected = async () => {
      if (!token || !storageKeys?.selectedGeofenceId) return;
      if (selectedGeofenceId) {
        await AsyncStorage.setItem(storageKeys.selectedGeofenceId, selectedGeofenceId);
      } else {
        await AsyncStorage.removeItem(storageKeys.selectedGeofenceId);
        await AsyncStorage.removeItem(storageKeys.workingHours);
      }
    };
    persistSelected();
  }, [selectedGeofenceId, token, storageKeys]);

  useEffect(() => {
    const persistWorkingHours = async () => {
      if (!token || !storageKeys?.workingHours || !selectedGeofenceId) return;
      await AsyncStorage.setItem(storageKeys.workingHours, JSON.stringify(workingHours));
    };
    persistWorkingHours();
  }, [workingHours, token, storageKeys, selectedGeofenceId]);

  // Check geofence immediately when selectedGeofenceId changes and location is available
  // This also triggers automatically on app start if location and geofence are both available
  useEffect(() => {
    if (selectedGeofenceId && location && location.coords && isTracking && geofences.length > 0) {
      console.log('[LocationContext] AUTOMATIC: Selected geofence, location, and geofences available, checking status', {
        selectedGeofenceId,
        hasLocation: !!location,
        isTracking,
        isCheckedIn: attendanceStatus.isCheckedIn,
        geofencesCount: geofences.length,
        locationCoords: location.coords ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy
        } : null
      });
      // Small delay to ensure state is settled, but make it faster for immediate feedback
      const timer = setTimeout(() => {
        console.log('[LocationContext] AUTOMATIC: Triggering automatic geofence check');
        // First check for early arrival (before start time) - only if not already checked in
        if (!attendanceStatus.isCheckedIn) {
          checkEarlyArrival(location).catch((error) => {
            console.error('[LocationContext] AUTOMATIC: Error checking early arrival', error);
          });
        }
        // Then check geofence status normally (this will trigger check-in if user is inside and not checked in)
        // Use forceCheck = true to ensure check-in happens even if user is already inside
        checkGeofenceStatus(location, true); // forceCheck = true to trigger check-in if already inside
      }, 200); // Reduced delay for faster response
      return () => clearTimeout(timer);
    } else if (selectedGeofenceId && location && location.coords && isTracking && geofences.length === 0) {
      console.log('[LocationContext] AUTOMATIC: Geofence and location available but geofences not loaded yet, loading now');
      // Load geofences first, then check
      loadGeofences().then(() => {
        console.log('[LocationContext] AUTOMATIC: Geofences loaded, will check status');
        // The useEffect will trigger again once geofences are loaded
      }).catch((error) => {
        console.error('[LocationContext] AUTOMATIC: Failed to load geofences', error);
      });
    } else if (selectedGeofenceId && !location && isTracking) {
      console.log('[LocationContext] AUTOMATIC: Geofence selected but location not available yet, will check when location updates', {
        selectedGeofenceId,
        isTracking
      });
      // Try to get location if not available
      if (isTracking) {
        getCurrentLocation().then((currentLoc) => {
          if (currentLoc && currentLoc.coords) {
            console.log('[LocationContext] AUTOMATIC: Got location after geofence selection, checking status');
            // The useEffect will trigger again with the new location
          }
        }).catch((error) => {
          console.error('[LocationContext] AUTOMATIC: Failed to get location for automatic check', error);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGeofenceId, location, isTracking, attendanceStatus.isCheckedIn, geofences.length]);

  useEffect(() => {
    const persistWorkingHours = async () => {
      if (!token || !storageKeys?.workingHours || !selectedGeofenceId) return;
      await AsyncStorage.setItem(storageKeys.workingHours, JSON.stringify(workingHours));
    };
    persistWorkingHours();
  }, [workingHours, token, storageKeys, selectedGeofenceId]);

  useEffect(() => {
    if (!token || !storageKeys) {
      setSelectedGeofenceId(null);
      clearAttendanceState().catch(() => {});
      stopLocationTracking().catch(() => {});
      // Clear API config when logged out
      AsyncStorage.multiRemove(['apiUrl', 'authToken', 'userId']).catch(() => {});
    } else {
      // Store API config when logged in
      storeApiConfig();
    }
  }, [token, storageKeys, clearAttendanceState, storeApiConfig, stopLocationTracking]);

  useEffect(() => {
    if (!selectedGeofenceId && attendanceStatus.isCheckedIn) {
      if (location && currentGeofence) {
        handleCheckOut(currentGeofence, location).catch(() => {});
      } else {
        clearAttendanceState().catch(() => {});
      }
      return;
    }
    if (
      selectedGeofenceId &&
      attendanceStatus.isCheckedIn &&
      currentGeofence &&
      currentGeofence.id !== selectedGeofenceId
    ) {
      if (location) {
        handleCheckOut(currentGeofence, location).catch(() => {});
      } else {
        clearAttendanceState().catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGeofenceId]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        if (attendanceStatus.isCheckedIn && attendanceStatus.dayKey) {
          const todayKey = getLocalDayKey();
          if (attendanceStatus.dayKey !== todayKey) {
            clearAttendanceState().catch(() => {});
            return;
          }
        }
        verifyAttendanceStatus();
        if (attendanceStatus.isCheckedIn) startLocationTracking();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceStatus.isCheckedIn]);

  useEffect(() => {
    let interval;
    if (attendanceStatus.isCheckedIn && attendanceStatus.checkInTime) {
      interval = setInterval(() => {
        setAttendanceStatus((prev) => ({
          ...prev,
          elapsedTime: Date.now() - prev.checkInTime.getTime()
        }));
      }, 1000);
    }
    return () => interval && clearInterval(interval);
  }, [attendanceStatus.isCheckedIn, attendanceStatus.checkInTime]);

  useEffect(() => {
    if (!attendanceStatus.isCheckedIn || !attendanceStatus.dayKey) return;
    const todayKey = getLocalDayKey();
    if (attendanceStatus.dayKey !== todayKey) {
      clearAttendanceState().catch(() => {});
    }
  }, [attendanceStatus.isCheckedIn, attendanceStatus.dayKey, clearAttendanceState]);

  const setSelectedGeofence = async (geofence) => {
    const newId = geofence?.id || null;
    console.log('[LocationContext] setSelectedGeofence', {
      geofenceName: geofence?.name,
      geofenceId: newId,
      hasLocation: !!location,
      isTracking
    });
    setSelectedGeofenceId(newId);
    
    // If location is not available, try to get it
    if (newId && !location && isTracking) {
      console.log('[LocationContext] setSelectedGeofence: Location not available, attempting to get current location...');
      try {
        const currentLoc = await getCurrentLocation();
        if (currentLoc && currentLoc.coords) {
          console.log('[LocationContext] setSelectedGeofence: Got location, checking geofence status');
          setTimeout(() => {
            checkGeofenceStatus(currentLoc, true); // forceCheck = true
          }, 100);
        }
      } catch (error) {
        console.error('[LocationContext] setSelectedGeofence: Failed to get location', error);
      }
    } else if (newId && location && location.coords) {
      console.log('[LocationContext] setSelectedGeofence: Checking if already inside geofence');
      // Use setTimeout to ensure state is updated
      setTimeout(() => {
        // First check for early arrival (before start time)
        checkEarlyArrival(location).catch((error) => {
          console.error('[LocationContext] setSelectedGeofence: Error checking early arrival', error);
        });
        // Then check geofence status normally
        checkGeofenceStatus(location, true); // forceCheck = true
      }, 100);
    }
  };

  const setWorkingHoursForLocation = useCallback((hours) => {
    setWorkingHoursState(hours);
  }, []);

  // Check if current time is within tracking window (1 hour before start to 1 hour after end)
  const isWithinTrackingWindow = useCallback(() => {
    if (!workingHours.startTime || !workingHours.endTime) return true; // Default to always track if not set

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    // Parse start and end times
    const [startHour, startMinute] = workingHours.startTime.split(':').map(Number);
    const [endHour, endMinute] = workingHours.endTime.split(':').map(Number);

    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;

    // Tracking window: 1 hour before start to 1 hour after end
    const trackingStartMinutes = startTimeMinutes - 60; // 1 hour before
    const trackingEndMinutes = endTimeMinutes + 60; // 1 hour after

    // Handle case where tracking window spans midnight
    if (trackingStartMinutes < 0) {
      // Window starts previous day
      return currentTimeMinutes >= (24 * 60 + trackingStartMinutes) || currentTimeMinutes <= trackingEndMinutes;
    } else if (trackingEndMinutes >= 24 * 60) {
      // Window ends next day
      return currentTimeMinutes >= trackingStartMinutes || currentTimeMinutes <= (trackingEndMinutes - 24 * 60);
    } else {
      // Normal case: window within same day
      return currentTimeMinutes >= trackingStartMinutes && currentTimeMinutes <= trackingEndMinutes;
    }
  }, [workingHours]);

  // Check if user is already inside geofence before working hours start time and auto-check them in
  const checkEarlyArrival = useCallback(async (currentLoc) => {
    if (!currentLoc || !currentLoc.coords) {
      console.log('[LocationContext] checkEarlyArrival: No location available');
      return;
    }

    if (!selectedGeofenceId || !geofences.length) {
      console.log('[LocationContext] checkEarlyArrival: No geofence selected');
      return;
    }

    // Don't check if already checked in
    if (attendanceStatus.isCheckedIn) {
      console.log('[LocationContext] checkEarlyArrival: Already checked in, skipping');
      return;
    }

    // Check if we have working hours set
    if (!workingHours.startTime || !workingHours.endTime) {
      console.log('[LocationContext] checkEarlyArrival: No working hours set, skipping early arrival check');
      return;
    }

    // Get current time
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    // Parse start time
    const [startHour, startMinute] = workingHours.startTime.split(':').map(Number);
    const startTimeMinutes = startHour * 60 + startMinute;

    // Check if current time is before start time (within 2 hours before start)
    const twoHoursBeforeStart = startTimeMinutes - 120; // 2 hours before start
    const isBeforeStartTime = currentTimeMinutes < startTimeMinutes;
    const isWithinEarlyArrivalWindow = currentTimeMinutes >= twoHoursBeforeStart;

    if (!isBeforeStartTime || !isWithinEarlyArrivalWindow) {
      console.log('[LocationContext] checkEarlyArrival: Not in early arrival window', {
        currentTime: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`,
        startTime: workingHours.startTime,
        isBeforeStartTime,
        isWithinEarlyArrivalWindow
      });
      return;
    }

    // Find the selected geofence
    const target = geofences.find((g) => g.id === selectedGeofenceId);
    if (!target) {
      console.warn('[LocationContext] checkEarlyArrival: Selected geofence not found');
      return;
    }

    // Check if user is inside the geofence
    const { latitude, longitude } = currentLoc.coords;
    let isInside = false;

    try {
      if (target.type === 'circle' && target.center && target.radius) {
        const [centerLon, centerLat] = target.center;
        const distance = haversineDistanceMeters(latitude, longitude, centerLat, centerLon);
        isInside = distance <= target.radius;
        console.log('[LocationContext] checkEarlyArrival: Circle geofence check', {
          geofenceName: target.name,
          distance,
          radius: target.radius,
          isInside
        });
      } else if (target.coordinates && target.coordinates.length > 0) {
        const point = [longitude, latitude];
        const polygon = turfPolygon([target.coordinates]);
        isInside = booleanPointInPolygon(point, polygon);
        console.log('[LocationContext] checkEarlyArrival: Polygon geofence check', {
          geofenceName: target.name,
          isInside
        });
      }
    } catch (error) {
      console.error('[LocationContext] checkEarlyArrival: Error checking geofence', error);
      return;
    }

    // If user is inside and it's before start time, check them in
    if (isInside) {
      console.log('[LocationContext] checkEarlyArrival: User is inside geofence before start time, auto-checking in', {
        geofenceName: target.name,
        currentTime: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`,
        startTime: workingHours.startTime
      });

      // Check cooldown to avoid multiple check-ins
      const cooldownKey = `early-arrival-checkin-${target.id}`;
      const last = geofenceCooldownRef.current.get(cooldownKey);
      const now = Date.now();
      
      if (last && now - last < 300000) { // 5 minutes cooldown
        console.log('[LocationContext] checkEarlyArrival: Cooldown active, skipping');
        return;
      }

      try {
        // Call handleCheckIn directly (it's a stable function)
        const deviceInfo = getDeviceInfo();
        const checkInData = {
          locationId: target.id,
          locationName: target.name,
          latitude: currentLoc.coords.latitude,
          longitude: currentLoc.coords.longitude,
          timestamp: new Date().toISOString(),
          accuracy: currentLoc.coords.accuracy,
          deviceInfo,
          speed: currentLoc.coords.speed || 0,
          altitude: currentLoc.coords.altitude || 0,
          heading: currentLoc.coords.heading || 0
        };

        const result = await request('/api/employees/attendance/checkin', {
          method: 'POST',
          body: JSON.stringify(checkInData)
        });

        setAttendanceStatus({
          isCheckedIn: true,
          checkInTime: new Date(),
          checkOutTime: null,
          locationName: target.name,
          elapsedTime: 0,
          validationStatus: result.attendance?.validationStatus,
          dayKey: getLocalDayKey()
        });

        if (storageKeys?.attendance) {
          await AsyncStorage.setItem(
            storageKeys.attendance,
            JSON.stringify({
              ...checkInData,
              userId,
              checkInTime: new Date().toISOString(),
              dayKey: getLocalDayKey()
            })
          );
        }

        // Bind device (async, don't wait)
        request('/api/devices/bind', {
          method: 'POST',
          body: JSON.stringify(deviceInfo)
        }).catch((error) => {
          console.error('[LocationContext] checkEarlyArrival: Error binding device', error);
        });

        geofenceCooldownRef.current.set(cooldownKey, now);
        console.log('[LocationContext] checkEarlyArrival: Successfully checked in early arrival');
      } catch (error) {
        console.error('[LocationContext] checkEarlyArrival: Failed to check in early arrival', error);
      }
    } else {
      console.log('[LocationContext] checkEarlyArrival: User is not inside geofence yet');
    }
  }, [selectedGeofenceId, geofences, workingHours, attendanceStatus.isCheckedIn, request, storageKeys, userId]);

  const value = {
    location,
    locationPermission,
    isTracking,
    geofences,
    currentGeofence,
    selectedGeofence,
    selectedGeofenceId,
    attendanceStatus,
    workingHours,
    requestPermissions,
    getCurrentLocation,
    startLocationTracking,
    stopLocationTracking,
    loadGeofences,
    manualCheckOut,
    clearGeofenceCooldowns,
    verifyAttendanceStatus,
    setSelectedGeofence,
    setWorkingHoursForLocation,
    isWithinTrackingWindow
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};

export default LocationContext;


