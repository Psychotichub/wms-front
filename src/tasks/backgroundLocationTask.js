import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { booleanPointInPolygon, polygon as turfPolygon } from '@turf/turf';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

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

const getLocalDayKey = (date = new Date()) =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

// Check if location is inside a geofence
const checkGeofence = (location, geofence) => {
  if (!location || !geofence) return false;

  const { latitude, longitude } = location.coords;
  const point = [longitude, latitude];

  try {
    if (geofence.type === 'circle' && geofence.center && geofence.radius) {
      const [centerLon, centerLat] = geofence.center;
      const distance = haversineDistanceMeters(latitude, longitude, centerLat, centerLon);
      return distance <= geofence.radius;
    } else if (geofence.coordinates && geofence.coordinates.length > 0) {
      const polygon = turfPolygon([geofence.coordinates]);
      return booleanPointInPolygon(point, polygon);
    }
  } catch (error) {
    console.error('Error checking geofence in background:', error);
  }
  return false;
};

// Get API URL and token from storage
const getApiConfig = async () => {
  try {
    const apiUrl = await AsyncStorage.getItem('apiUrl');
    const token = await AsyncStorage.getItem('authToken');
    const userId = await AsyncStorage.getItem('userId');
    return { apiUrl, token, userId };
  } catch (error) {
    console.error('Error getting API config:', error);
    return { apiUrl: null, token: null, userId: null };
  }
};

// Make API request from background
const makeBackgroundRequest = async (endpoint, method, body, token, apiUrl) => {
  try {
    const url = `${apiUrl}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Background API request failed:', error);
    throw error;
  }
};

// Send local notification
const sendLocalNotification = async (title, body) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

// Background location task handler
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }

  if (!data || !data.locations || data.locations.length === 0) {
    return;
  }

  const location = data.locations[data.locations.length - 1];
  
  // Filter out inaccurate locations
  if (!location.coords || location.coords.accuracy > 100) {
    return;
  }

  // Filter out if moving too fast (likely in vehicle)
  if (location.coords.speed && location.coords.speed > 27.8) {
    return;
  }

  try {
    // Get stored configuration
    const { apiUrl, token, userId } = await getApiConfig();
    
    if (!apiUrl || !token || !userId) {
      console.log('Background task: Missing API config, skipping');
      return;
    }

    // Get selected geofence ID from storage
    const safeApi = (apiUrl || 'default').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    const selectedGeofenceKey = `selectedGeofence:${safeApi}:${userId}`;
    const selectedGeofenceId = await AsyncStorage.getItem(selectedGeofenceKey);

    if (!selectedGeofenceId) {
      // No geofence selected, skip
      return;
    }

    // Get working hours from storage
    const workingHoursKey = `workingHours:${safeApi}:${userId}`;
    const workingHoursData = await AsyncStorage.getItem(workingHoursKey);
    let workingHours = { startTime: '08:00', endTime: '16:30' }; // Default
    if (workingHoursData) {
      try {
        workingHours = JSON.parse(workingHoursData);
      } catch (error) {
        console.error('Error parsing working hours:', error);
      }
    }

    // Check if current time is within tracking window (1 hour before start to 1 hour after end)
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = workingHours.startTime.split(':').map(Number);
    const [endHour, endMinute] = workingHours.endTime.split(':').map(Number);

    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;

    // Tracking window: 1 hour before start to 1 hour after end
    const trackingStartMinutes = startTimeMinutes - 60; // 1 hour before
    const trackingEndMinutes = endTimeMinutes + 60; // 1 hour after

    let isWithinWindow = false;
    // Handle case where tracking window spans midnight
    if (trackingStartMinutes < 0) {
      // Window starts previous day
      isWithinWindow = currentTimeMinutes >= (24 * 60 + trackingStartMinutes) || currentTimeMinutes <= trackingEndMinutes;
    } else if (trackingEndMinutes >= 24 * 60) {
      // Window ends next day
      isWithinWindow = currentTimeMinutes >= trackingStartMinutes || currentTimeMinutes <= (trackingEndMinutes - 24 * 60);
    } else {
      // Normal case: window within same day
      isWithinWindow = currentTimeMinutes >= trackingStartMinutes && currentTimeMinutes <= trackingEndMinutes;
    }

    if (!isWithinWindow) {
      // Outside tracking window, skip geofence checking
      return;
    }

    // Get current attendance status
    const attendanceKey = `attendance:${safeApi}:${userId}`;
    const attendanceData = await AsyncStorage.getItem(attendanceKey);
    const currentAttendance = attendanceData ? JSON.parse(attendanceData) : null;

    // Check if day changed
    const todayKey = getLocalDayKey();
    if (currentAttendance && currentAttendance.dayKey !== todayKey) {
      // Day changed, clear attendance
      await AsyncStorage.removeItem(attendanceKey);
      return;
    }

    // Load geofences from API
    let geofences = [];
    try {
      const geofencesData = await makeBackgroundRequest('/api/locations/geofences', 'GET', null, token, apiUrl);
      geofences = geofencesData.geofences || [];
    } catch (error) {
      console.error('Failed to load geofences in background:', error);
      return;
    }

    // Find the selected geofence
    const selectedGeofence = geofences.find(g => g.id === selectedGeofenceId);
    if (!selectedGeofence) {
      return;
    }

    // Check if inside geofence
    const isInside = checkGeofence(location, selectedGeofence);
    const wasInside = currentAttendance && currentAttendance.locationId === selectedGeofenceId;

    // Get device info
    const deviceInfo = {
      deviceId: `background-${Date.now()}`,
      deviceName: 'Background Location',
      deviceType: 'background',
      appVersion: '1.0.0',
      osVersion: 'background'
    };

    // Handle geofence transition
    const nowTimestamp = Date.now();
    const lastActionKey = `lastAction:${safeApi}:${userId}`;
    const lastAction = await AsyncStorage.getItem(lastActionKey);
    const lastActionTime = lastAction ? parseInt(lastAction, 10) : 0;

    // Cooldown: don't trigger if action happened recently (within 1 minute)
    if (nowTimestamp - lastActionTime < 60000) {
      return;
    }

    if (!wasInside && isInside) {
      // Entered geofence - check in
      try {
        const checkInData = {
          locationId: selectedGeofence.id,
          locationName: selectedGeofence.name,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: new Date().toISOString(),
          accuracy: location.coords.accuracy,
          deviceInfo,
          speed: location.coords.speed || 0,
          altitude: location.coords.altitude || 0,
          heading: location.coords.heading || 0
        };

        await makeBackgroundRequest('/api/employees/attendance/checkin', 'POST', checkInData, token, apiUrl);

        // Save attendance state
        await AsyncStorage.setItem(attendanceKey, JSON.stringify({
          ...checkInData,
          userId,
          checkInTime: new Date().toISOString(),
          dayKey: todayKey
        }));

        // Update last action time
        await AsyncStorage.setItem(lastActionKey, nowTimestamp.toString());

        // Send notification
        await sendLocalNotification(
          'Checked In',
          `You entered ${selectedGeofence.name}. Attendance recorded.`
        );
      } catch (error) {
        console.error('Background check-in failed:', error);
      }
    } else if (wasInside && !isInside) {
      // Left geofence - check out
      try {
        const checkOutData = {
          locationId: selectedGeofence.id,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: new Date().toISOString(),
          accuracy: location.coords.accuracy,
          deviceInfo
        };

        await makeBackgroundRequest('/api/employees/attendance/checkout', 'POST', checkOutData, token, apiUrl);

        // Clear attendance state
        await AsyncStorage.removeItem(attendanceKey);

        // Update last action time
        await AsyncStorage.setItem(lastActionKey, nowTimestamp.toString());

        // Send notification
        await sendLocalNotification(
          'Checked Out',
          `You left ${selectedGeofence.name}. Attendance recorded.`
        );
      } catch (error) {
        console.error('Background check-out failed:', error);
      }
    }
  } catch (error) {
    console.error('Background location task error:', error);
  }
});

export { BACKGROUND_LOCATION_TASK };
