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

  const requestPermissions = useCallback(async () => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      // On web, only request foreground permissions
      if (Platform.OS === 'web') {
        const granted = foregroundStatus === 'granted';
        setLocationPermission(granted);
        return granted;
      }
      
      // On native, request both foreground and background
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      const granted = foregroundStatus === 'granted' && backgroundStatus === 'granted';
      setLocationPermission(granted);
      return granted;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }, []);

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

  const checkGeofenceStatus = (currentLoc) => {
    if (!currentLoc || geofences.length === 0) return;
    if (!selectedGeofenceId) {
      if (currentGeofence) setCurrentGeofence(null);
      return;
    }

    // Check if within tracking window
    if (!isWithinTrackingWindow()) {
      return; // Don't check geofence if outside tracking window
    }

    const target = geofences.find((g) => g.id === selectedGeofenceId);
    if (!target) {
      if (currentGeofence) setCurrentGeofence(null);
      return;
    }

    const { latitude, longitude } = currentLoc.coords;
    const point = [longitude, latitude];

    let inside = null;

    for (const geofence of [target]) {
      try {
        if (geofence.type === 'circle' && geofence.center && geofence.radius) {
          const [centerLon, centerLat] = geofence.center;
          const distance = haversineDistanceMeters(latitude, longitude, centerLat, centerLon);
          if (distance <= geofence.radius) {
            inside = geofence;
            break;
          }
        } else if (geofence.coordinates && geofence.coordinates.length > 0) {
          const polygon = turfPolygon([geofence.coordinates]);
          if (booleanPointInPolygon(point, polygon)) {
            inside = geofence;
            break;
          }
        }
      } catch (error) {
        console.error('Error checking geofence:', error);
      }
    }

    handleGeofenceTransition(inside, currentLoc);
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

    setLocation(newLocation);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => checkGeofenceStatus(newLocation), 3000);
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
    console.log(`Foreground location tracking started on ${Platform.OS}`);
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

    if (lastAttendanceActionRef.current && now - lastAttendanceActionRef.current < 30000) return;

    if (!wasInside && isInside) {
      const cooldownKey = `checkin-${newGeofence.id}`;
      const last = geofenceCooldownRef.current.get(cooldownKey);
      if (!last || now - last > 60000) {
        handleCheckIn(newGeofence, currentLoc).catch(() => {});
        geofenceCooldownRef.current.set(cooldownKey, now);
        lastAttendanceActionRef.current = now;
      }
    } else if (wasInside && !isInside) {
      const cooldownKey = `checkout-${currentGeofence.id}`;
      const last = geofenceCooldownRef.current.get(cooldownKey);
      if (!last || now - last > 60000) {
        handleCheckOut(currentGeofence, currentLoc).catch(() => {});
        geofenceCooldownRef.current.set(cooldownKey, now);
        lastAttendanceActionRef.current = now;
      }
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
      if (savedSelected) setSelectedGeofenceId(savedSelected);

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
  }, [token, storageKeys, clearAttendanceState]);

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

  const setSelectedGeofence = (geofence) => {
    setSelectedGeofenceId(geofence?.id || null);
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


