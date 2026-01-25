import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, Alert, FlatList, Platform } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useLocation } from '../context/LocationContext';
import Screen from '../components/Screen';
import GeofenceMap, { Marker, Polygon } from '../components/GeofenceMap';
import SiteRequiredNotice from '../components/SiteRequiredNotice';
import { getGoogleMapsApiKey } from '../config/runtime';

const SEARCH_RESULT_ITEM_HEIGHT = 56;

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

const SearchResultItem = React.memo(({ item, colors, onSelect }) => (
  <Pressable style={styles.resultItem} onPress={() => onSelect(item)}>
    <Text style={[styles.resultText, { color: colors.text }]} numberOfLines={2}>
      {item.description}
    </Text>
  </Pressable>
));
SearchResultItem.displayName = 'SearchResultItem';

const parseCoordinates = (text) => {
  if (!text) return [];
  return text
    .split(/[\n;]+/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(pair => {
      const [lon, lat] = pair.split(',').map(v => parseFloat(v.trim()));
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        return [lon, lat];
      }
      return null;
    })
    .filter(Boolean);
};

const ManageLocationsScreen = () => {
  const navigation = useNavigation();
  const { token, request, user } = useAuth();
  const { loadGeofences, location: currentLocation } = useLocation();
  const t = useThemeTokens();
  const mapRef = useRef(null);
  // Get Google Maps API key - fails fast if missing (required for maps)
  const googleKey = getGoogleMapsApiKey();
  const hasSite = Boolean(user?.site);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState('polygon'); // 'polygon' | 'circle'
  const [coordinatesText, setCoordinatesText] = useState('');
  const [centerLon, setCenterLon] = useState('');
  const [centerLat, setCenterLat] = useState('');
  const [radius, setRadius] = useState('');
  const [loading, setLoading] = useState(false);
  const [mapRegion, setMapRegion] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchMarker, setSearchMarker] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const isLoadingRef = useRef(false);
  const [editingId, setEditingId] = useState(null);

  const isPolygon = type === 'polygon';
  const parsedCoords = useMemo(() => parseCoordinates(coordinatesText), [coordinatesText]);

  const buttonLabel = useMemo(() => (loading ? 'Saving...' : 'Save Location'), [loading]);

  const refreshGeofences = useCallback(() => {
    if (!hasSite) return;
    loadGeofences?.();
  }, [hasSite, loadGeofences]);

  const loadLocations = useCallback(async () => {
    if (!hasSite || !token) return;
    if (isLoadingRef.current) return; // Prevent concurrent loads
    try {
      isLoadingRef.current = true;
      setLoadingLocations(true);
      const data = await request('/api/locations');
      if (data?.locations) {
        // Filter out inactive locations (deleted locations have isActive: false)
        const activeLocations = data.locations.filter(loc => loc.isActive !== false);
        console.log('Loaded locations:', {
          total: data.locations.length,
          active: activeLocations.length,
          inactive: data.locations.length - activeLocations.length
        });
        setLocations(activeLocations);
      }
    } catch (err) {
      console.error('Failed to load locations:', err);
    } finally {
      isLoadingRef.current = false;
      setLoadingLocations(false);
    }
  }, [hasSite, token, request]);

  useEffect(() => {
    const region = getRegion();
    setMapRegion(region);
    // Log for debugging
    if (Platform.OS === 'web') {
      console.log('Map region updated:', region);
      if (!currentLocation?.coords) {
        console.warn('Current location not available. Using default region.');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinatesText, centerLat, centerLon, currentLocation]);

  useFocusEffect(
    useCallback(() => {
      if (hasSite) {
        refreshGeofences();
        if (!isLoadingRef.current) {
          loadLocations();
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasSite])
  );

  const getRegion = () => {
    if (isPolygon && parsedCoords.length > 0) {
      const [lon, lat] = parsedCoords[0];
      return { latitude: lat, longitude: lon, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    }
    if (!isPolygon && Number.isFinite(parseFloat(centerLat)) && Number.isFinite(parseFloat(centerLon))) {
      return {
        latitude: parseFloat(centerLat),
        longitude: parseFloat(centerLon),
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      };
    }
    if (currentLocation?.coords) {
      return {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      };
    }
    // Default to a well-known location (Singapore) instead of 0,0
    return { latitude: 1.3521, longitude: 103.8198, latitudeDelta: 0.1, longitudeDelta: 0.1 };
  };

  const handleMapPress = (event) => {
    const { latitude, longitude } = event.nativeEvent.coordinate || {};
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    if (isPolygon) {
      const newText = `${coordinatesText ? `${coordinatesText.trim()}\n` : ''}${longitude.toFixed(6)},${latitude.toFixed(6)}`;
      setCoordinatesText(newText);
    } else {
      setCenterLon(longitude.toFixed(6));
      setCenterLat(latitude.toFixed(6));
      if (!radius) setRadius('50');
    }
  };

  const clearPolygon = () => setCoordinatesText('');

  const animateToRegion = useCallback((region) => {
    if (!region) return;
    mapRef.current?.animateToRegion(region, 500);
    setMapRegion(region);
  }, []);

  const zoom = (factor) => {
    if (!mapRegion) return;
    animateToRegion({
      ...mapRegion,
      latitudeDelta: mapRegion.latitudeDelta * factor,
      longitudeDelta: mapRegion.longitudeDelta * factor,
    });
  };

  const goToCurrentLocation = () => {
    if (!currentLocation?.coords) return;
    animateToRegion({
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  const fetchPlaces = async (query) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    if (!googleKey) {
      console.error('Google Maps API key is missing');
      Alert.alert('Configuration Error', 'Google Maps API key is not configured. Please check your environment variables.');
      return;
    }
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${googleKey}`;
      const resp = await fetch(url);
      const data = await resp.json();
      
      if (data.error_message) {
        console.error('Google Places API error:', data.error_message);
        Alert.alert('Search Error', `Failed to search places: ${data.error_message}`);
        setSearchResults([]);
        return;
      }
      
      if (data.status === 'REQUEST_DENIED') {
        console.error('Google Places API request denied. Check API key and Places API enablement.');
        Alert.alert('API Error', 'Places API request denied. Please check:\n1. Places API is enabled in Google Cloud Console\n2. API key has Places API permission\n3. API key restrictions allow this domain');
        setSearchResults([]);
        return;
      }
      
      setSearchResults(data?.predictions || []);
    } catch (error) {
      console.error('Error fetching places:', error);
      Alert.alert('Network Error', 'Failed to search places. Please check your internet connection.');
      setSearchResults([]);
    }
  };

  const handleSearchSelect = useCallback(async (place) => {
    if (!place?.place_id) {
      console.error('Invalid place selected');
      return;
    }
    if (!googleKey) {
      Alert.alert('Configuration Error', 'Google Maps API key is not configured.');
      return;
    }
    
    setSearchQuery(place.description);
    setSearchResults([]);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&key=${googleKey}`;
      const resp = await fetch(url);
      const data = await resp.json();
      
      if (data.error_message) {
        console.error('Google Places Details API error:', data.error_message);
        Alert.alert('Error', `Failed to get place details: ${data.error_message}`);
        return;
      }
      
      if (data.status === 'REQUEST_DENIED') {
        console.error('Google Places API request denied');
        Alert.alert('API Error', 'Places API request denied. Please check API key configuration.');
        return;
      }
      
      const loc = data?.result?.geometry?.location;
      const placeName = data?.result?.name || place.description;
      
      if (placeName && !name) {
        setName(placeName);
      }
      
      if (loc?.lat && loc?.lng) {
        setSearchMarker({
          latitude: loc.lat,
          longitude: loc.lng,
          title: placeName || 'Selected place',
        });
        if (isPolygon) {
          const point = `${loc.lng.toFixed(6)},${loc.lat.toFixed(6)}`;
          setCoordinatesText((prev) => (prev ? `${prev.trim()}\n${point}` : point));
        } else {
          setCenterLon(loc.lng.toFixed(6));
          setCenterLat(loc.lat.toFixed(6));
          if (!radius) setRadius('50');
        }
        animateToRegion({
          latitude: loc.lat,
          longitude: loc.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } else {
        console.error('No location found for place:', place);
        Alert.alert('Error', 'Could not get location for selected place.');
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
      Alert.alert('Network Error', 'Failed to get place details. Please check your internet connection.');
    }
  }, [googleKey, isPolygon, name, radius, animateToRegion]);

  const submit = async () => {
    if (!token) {
      Alert.alert('Login required', 'Please log in again to save locations.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required');
      return;
    }

    const payload = {
      name: name.trim(),
      address: address.trim(),
      type,
    };

    if (isPolygon) {
      const coords = parseCoordinates(coordinatesText);
      if (coords.length < 3) {
        Alert.alert('Validation', 'Polygon requires at least 3 points (lon,lat)');
        return;
      }
      payload.coordinates = coords;
    } else {
      const lon = parseFloat(centerLon);
      const lat = parseFloat(centerLat);
      const rad = parseFloat(radius);

      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        Alert.alert('Validation', 'Center longitude and latitude are required');
        return;
      }
      if (!Number.isFinite(rad) || rad <= 0) {
        Alert.alert('Validation', 'Radius must be a positive number (meters)');
        return;
      }
      payload.center = [lon, lat];
      payload.radius = rad;
      payload.coordinates = [[lon, lat]]; // minimal coords to satisfy backend schema
    }

    try {
      setLoading(true);
      let data;
      if (editingId) {
        // Update existing location
        data = await request(`/api/locations/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        // Create new location
        data = await request('/api/locations', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      await loadGeofences?.();
      await loadLocations();

      Alert.alert('Success', data?.message || (editingId ? 'Location updated successfully' : 'Location saved'));
      setName('');
      setAddress('');
      setCoordinatesText('');
      setCenterLon('');
      setCenterLat('');
      setRadius('');
      setEditingId(null);
    } catch (err) {
      Alert.alert('Error', err.message || (editingId ? 'Unable to update location' : 'Unable to save location'));
    } finally {
      setLoading(false);
    }
  };

  const renderSearchResultItem = useCallback(
    ({ item }) => (
      <SearchResultItem item={item} colors={t.colors} onSelect={handleSearchSelect} />
    ),
    [handleSearchSelect, t.colors]
  );
  const getItemLayout = useCallback((_, index) => ({
    length: SEARCH_RESULT_ITEM_HEIGHT,
    offset: SEARCH_RESULT_ITEM_HEIGHT * index,
    index
  }), []);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }, []);

  const formatCoordinates = useCallback((location) => {
    if (location.type === 'circle' && location.center && location.radius) {
      return `Center: ${location.center[0].toFixed(6)}, ${location.center[1].toFixed(6)}\nRadius: ${location.radius}m`;
    }
    if (location.coordinates && location.coordinates.length > 0) {
      return `${location.coordinates.length} points`;
    }
    return 'No coordinates';
  }, []);

  const handleEdit = useCallback((location) => {
    setEditingId(location.id);
    setName(location.name || '');
    setAddress(location.address || '');
    setType(location.type || 'polygon');
    
    if (location.type === 'circle') {
      if (location.center && location.center.length === 2) {
        setCenterLon(location.center[0].toString());
        setCenterLat(location.center[1].toString());
      }
      setRadius(location.radius ? location.radius.toString() : '');
      setCoordinatesText('');
    } else {
      if (location.coordinates && location.coordinates.length > 0) {
        const coordsText = location.coordinates.map(coord => `${coord[0]},${coord[1]}`).join('\n');
        setCoordinatesText(coordsText);
      }
      setCenterLon('');
      setCenterLat('');
      setRadius('');
    }
    
    // Scroll to form
    setTimeout(() => {
      // You could add scroll to form here if needed
    }, 100);
  }, []);

  const performDelete = useCallback(async (locationId) => {
    if (!locationId) {
      console.error('performDelete called with invalid locationId:', locationId);
      Alert.alert('Error', 'Invalid location ID');
      return;
    }

    try {
      console.log('performDelete: Starting deletion for location:', locationId);
      console.log('performDelete: Making DELETE request to:', `/api/locations/${locationId}`);
      
      const response = await request(`/api/locations/${locationId}`, { method: 'DELETE' });
      
      console.log('performDelete: Delete response received:', response);
      
      // Clear form if editing the deleted location
      if (editingId === locationId) {
        console.log('performDelete: Clearing form for deleted location');
        setEditingId(null);
        setName('');
        setAddress('');
        setCoordinatesText('');
        setCenterLon('');
        setCenterLat('');
        setRadius('');
      }
      
      // Refresh lists
      console.log('performDelete: Refreshing locations list');
      await loadLocations();
      await loadGeofences?.();
      
      console.log('performDelete: Deletion successful');
      Alert.alert('Success', response?.message || 'Location deleted successfully');
    } catch (err) {
      console.error('performDelete: Delete error occurred:', err);
      console.error('performDelete: Error details:', {
        message: err.message,
        status: err.status,
        data: err.data,
        stack: err.stack
      });
      Alert.alert('Error', err.message || 'Failed to delete location');
    }
  }, [request, loadLocations, loadGeofences, editingId]);

  const handleDelete = useCallback((locationId) => {
    if (!locationId) {
      Alert.alert('Error', 'Invalid location ID');
      return;
    }

    console.log('Delete button clicked for location:', locationId);

    if (Platform.OS === 'web') {
      // On web, use window.confirm for better compatibility
      const confirmed = window.confirm('Are you sure you want to delete this location? This action cannot be undone.');
      if (confirmed) {
        console.log('User confirmed delete on web, calling performDelete');
        performDelete(locationId);
      } else {
        console.log('Delete cancelled by user on web');
      }
    } else {
      // On native, use Alert
      Alert.alert(
        'Delete Location',
        'Are you sure you want to delete this location? This action cannot be undone.',
        [
          { 
            text: 'Cancel', 
            style: 'cancel',
            onPress: () => {
              console.log('Delete cancelled by user');
            }
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              console.log('User confirmed delete, calling performDelete');
              performDelete(locationId);
            }
          }
        ],
        { cancelable: true }
      );
    }
  }, [performDelete]);

  const renderLocationItem = useCallback(({ item }) => (
    <View style={[styles.locationCard, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
      <View style={styles.locationHeader}>
        <View style={styles.locationTitleRow}>
          <Text style={[styles.locationName, { color: t.colors.text }]}>{item.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: item.isActive ? getRGBA('#22c55e', 0.15) : getRGBA(t.colors.textSecondary, 0.15) }]}>
            <Text style={[styles.statusText, { color: item.isActive ? '#22c55e' : t.colors.textSecondary }]}>
              {item.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
        <View style={styles.locationActions}>
          <View style={styles.typeBadge}>
            <Ionicons 
              name={item.type === 'circle' ? 'radio-button-on-outline' : 'git-branch-outline'} 
              size={14} 
              color={t.colors.textSecondary} 
            />
            <Text style={[styles.typeText, { color: t.colors.textSecondary }]}>{item.type === 'circle' ? 'Circle' : 'Polygon'}</Text>
          </View>
          <View style={styles.actionButtons}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: getRGBA(t.colors.primary, 0.12) }]}
              onPress={() => handleEdit(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="create-outline" size={18} color={t.colors.primary} />
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: getRGBA(t.colors.danger, 0.12) }]}
              onPress={() => {
                console.log('Delete button pressed, item:', item);
                const locationId = item.id || item._id;
                if (locationId) {
                  handleDelete(locationId);
                } else {
                  Alert.alert('Error', 'Location ID not found');
                }
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={18} color={t.colors.danger} />
            </Pressable>
          </View>
        </View>
      </View>

      {item.address && (
        <View style={styles.locationInfoRow}>
          <Ionicons name="location-outline" size={14} color={t.colors.textSecondary} />
          <Text style={[styles.locationInfo, { color: t.colors.textSecondary }]} numberOfLines={2}>
            {item.address}
          </Text>
        </View>
      )}

      <View style={styles.locationInfoRow}>
        <Ionicons name="map-outline" size={14} color={t.colors.textSecondary} />
        <Text style={[styles.locationInfo, { color: t.colors.textSecondary }]}>
          {formatCoordinates(item)}
        </Text>
      </View>

      <View style={styles.locationInfoRow}>
        <Ionicons name="calendar-outline" size={14} color={t.colors.textSecondary} />
        <Text style={[styles.locationInfo, { color: t.colors.textSecondary }]}>
          Created: {formatDate(item.createdAt)}
        </Text>
      </View>

      {item.createdBy && (
        <View style={styles.locationInfoRow}>
          <Ionicons name="person-outline" size={14} color={t.colors.textSecondary} />
          <Text style={[styles.locationInfo, { color: t.colors.textSecondary }]}>
            By: {item.createdBy.name || item.createdBy.email || 'Unknown'}
          </Text>
        </View>
      )}
    </View>
  ), [t.colors, formatCoordinates, formatDate, handleEdit, handleDelete]);

  if (!hasSite) {
    return (
      <Screen>
        <SiteRequiredNotice />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={[styles.header, { backgroundColor: t.colors.card, borderBottomColor: t.colors.border }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={t.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: t.colors.text }]}>Manage Locations</Text>
        <View style={styles.headerRight} />
      </View>
      <ScrollView
        style={[styles.container, { backgroundColor: t.colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Locations List Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: t.colors.text }]}>All Locations</Text>
            <Pressable
              onPress={loadLocations}
              disabled={loadingLocations}
              style={[styles.refreshButton, { backgroundColor: getRGBA(t.colors.primary, 0.1) }]}
            >
              <Ionicons name="refresh" size={16} color={t.colors.primary} />
            </Pressable>
          </View>
          {loadingLocations ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: t.colors.textSecondary }]}>Loading locations...</Text>
            </View>
          ) : locations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="location-outline" size={48} color={t.colors.textSecondary} />
              <Text style={[styles.emptyText, { color: t.colors.textSecondary }]}>No locations found</Text>
              <Text style={[styles.emptySubtext, { color: t.colors.textSecondary }]}>Create your first location below</Text>
            </View>
          ) : (
            <View>
              {locations.map((item, index) => (
                <View key={item.id}>
                  {renderLocationItem({ item })}
                  {index < locations.length - 1 && <View style={{ height: 12 }} />}
                </View>
              ))}
            </View>
          )}
        </View>

        <Text style={[styles.title, { color: t.colors.text }]}>
          {editingId ? 'Edit Location' : 'Create Geofence'}
        </Text>
        <Text style={[styles.subtitle, { color: t.colors.textSecondary }]}>
          Enter coordinates as "lon,lat" separated by new lines or semicolons. Use circle for simple radius zones.
        </Text>

        <View style={styles.row}>
          <Text style={[styles.label, { color: t.colors.text }]}>Name *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Office HQ"
            placeholderTextColor={t.colors.textSecondary}
            style={[styles.input, { color: t.colors.text, borderColor: t.colors.border }]}
          />
        </View>

        <View style={styles.row}>
          <Text style={[styles.label, { color: t.colors.text }]}>Address</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="123 Main St"
            placeholderTextColor={t.colors.textSecondary}
            style={[styles.input, { color: t.colors.text, borderColor: t.colors.border }]}
          />
        </View>

        <View style={styles.row}>
          <Text style={[styles.label, { color: t.colors.text }]}>Type</Text>
          <View style={styles.typeRow}>
            <Pressable
              style={[
                styles.typeChip,
                {
                  backgroundColor: isPolygon ? t.colors.primary : t.colors.card,
                  borderColor: t.colors.border,
                },
              ]}
              onPress={() => setType('polygon')}
            >
              <Ionicons name="git-branch-outline" size={16} color={isPolygon ? '#0b1220' : t.colors.text} />
              <Text style={[styles.typeText, { color: isPolygon ? '#0b1220' : t.colors.text }]}>Polygon</Text>
            </Pressable>
            <Pressable
              style={[
                styles.typeChip,
                {
                  backgroundColor: !isPolygon ? t.colors.primary : t.colors.card,
                  borderColor: t.colors.border,
                },
              ]}
              onPress={() => setType('circle')}
            >
              <Ionicons name="radio-button-on-outline" size={16} color={!isPolygon ? '#0b1220' : t.colors.text} />
              <Text style={[styles.typeText, { color: !isPolygon ? '#0b1220' : t.colors.text }]}>Circle</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={[styles.label, { color: t.colors.text }]}>
            Map (tap to add {isPolygon ? 'points' : 'center'})
          </Text>
          <View style={styles.mapCard}>
            <GeofenceMap
              ref={mapRef}
              style={styles.map}
              region={mapRegion || getRegion()}
              location={currentLocation}
              onPress={handleMapPress}
              scrollEnabled={true}
              zoomEnabled={true}
              onRegionChangeComplete={(region) => setMapRegion(region)}
            >
              {currentLocation?.coords && (
                <Marker
                  coordinate={{ 
                    latitude: currentLocation.coords.latitude, 
                    longitude: currentLocation.coords.longitude 
                  }}
                  title="Your Current Location"
                  pinColor="#22c55e"
                />
              )}
              {searchMarker && (
                <Marker
                  coordinate={{ latitude: searchMarker.latitude, longitude: searchMarker.longitude }}
                  title={searchMarker.title}
                  pinColor="#3b82f6"
                />
              )}
              {isPolygon &&
                parsedCoords.map((coord, idx) => (
                  <Marker
                    key={`${coord[0]}-${coord[1]}-${idx}`}
                    coordinate={{ latitude: coord[1], longitude: coord[0] }}
                    title={`Point ${idx + 1}`}
                  />
                ))}
              {isPolygon && parsedCoords.length >= 3 && (
                <Polygon
                  coordinates={parsedCoords.map(c => ({ latitude: c[1], longitude: c[0] }))}
                  fillColor="rgba(34,197,94,0.25)"
                  strokeColor="#22c55e"
                  strokeWidth={2}
                />
              )}
              {!isPolygon && Number.isFinite(parseFloat(centerLat)) && Number.isFinite(parseFloat(centerLon)) && (
                <Marker
                  coordinate={{ latitude: parseFloat(centerLat), longitude: parseFloat(centerLon) }}
                  title="Center"
                  description={radius ? `Radius ${radius}m` : undefined}
                  pinColor="#3b82f6"
                />
              )}
            </GeofenceMap>
            <View style={[styles.searchContainer, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
              <Ionicons name="search" size={16} color={t.colors.textSecondary} />
              <TextInput
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  fetchPlaces(text);
                }}
                placeholder="Search places"
                placeholderTextColor={t.colors.textSecondary}
                style={[styles.searchInput, { color: t.colors.text }]}
              />
            </View>
            {searchResults.length > 0 && (
              <View style={[styles.resultsList, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.place_id}
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={6}
                  maxToRenderPerBatch={6}
                  windowSize={5}
                  renderItem={renderSearchResultItem}
                  getItemLayout={getItemLayout}
                />
              </View>
            )}
            <View style={[styles.mapButtons, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
              <Pressable style={styles.iconBtn} onPress={() => zoom(0.7)}>
                <Ionicons name="add" size={18} color={t.colors.text} />
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => zoom(1.3)}>
                <Ionicons name="remove" size={18} color={t.colors.text} />
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={goToCurrentLocation}>
                <Ionicons name="locate-outline" size={18} color={t.colors.text} />
              </Pressable>
            </View>
            {isPolygon && parsedCoords.length > 0 && (
              <Pressable style={[styles.clearBtn, { borderColor: t.colors.border }]} onPress={clearPolygon}>
                <Ionicons name="trash-outline" size={14} color={t.colors.text} />
                <Text style={[styles.clearText, { color: t.colors.text }]}>Clear points</Text>
              </Pressable>
            )}
          </View>
        </View>

        {isPolygon ? (
          <View style={styles.row}>
            <Text style={[styles.label, { color: t.colors.text }]}>Coordinates (lon,lat)</Text>
            <TextInput
              value={coordinatesText}
              onChangeText={setCoordinatesText}
              multiline
              placeholder="103.851234,1.290123&#10;103.851800,1.290200&#10;103.851600,1.289700"
              placeholderTextColor={t.colors.textSecondary}
              style={[
                styles.textarea,
                { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.card },
              ]}
            />
          </View>
        ) : (
          <>
            <View style={styles.row}>
              <Text style={[styles.label, { color: t.colors.text }]}>Center (lon, lat)</Text>
              <View style={styles.centerRow}>
                <TextInput
                  value={centerLon}
                  onChangeText={setCenterLon}
                  placeholder="Longitude"
                  placeholderTextColor={t.colors.textSecondary}
                  keyboardType="numeric"
                  style={[styles.inputHalf, { color: t.colors.text, borderColor: t.colors.border }]}
                />
                <TextInput
                  value={centerLat}
                  onChangeText={setCenterLat}
                  placeholder="Latitude"
                  placeholderTextColor={t.colors.textSecondary}
                  keyboardType="numeric"
                  style={[styles.inputHalf, { color: t.colors.text, borderColor: t.colors.border }]}
                />
              </View>
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: t.colors.text }]}>Radius (meters)</Text>
              <TextInput
                value={radius}
                onChangeText={setRadius}
                placeholder="e.g. 120"
                placeholderTextColor={t.colors.textSecondary}
                keyboardType="numeric"
                style={[styles.input, { color: t.colors.text, borderColor: t.colors.border }]}
              />
            </View>
          </>
        )}

        <View style={styles.submitRow}>
          {editingId && (
            <Pressable
              style={[styles.cancelButton, { backgroundColor: t.colors.border }]}
              onPress={() => {
                setEditingId(null);
                setName('');
                setAddress('');
                setCoordinatesText('');
                setCenterLon('');
                setCenterLat('');
                setRadius('');
              }}
              disabled={loading}
            >
              <Ionicons name="close-outline" size={18} color={t.colors.text} />
              <Text style={[styles.cancelText, { color: t.colors.text }]}>Cancel</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.submit, { backgroundColor: loading ? t.colors.border : t.colors.primary, flex: editingId ? 1 : undefined }]}
            onPress={submit}
            disabled={loading}
          >
            <Ionicons name={editingId ? "checkmark-outline" : "save-outline"} size={18} color="#0b1220" />
            <Text style={styles.submitText}>{buttonLabel}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
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
  container: {
    flex: 1,
  },
  mapCard: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    height: 240,
    width: '100%',
  },
  clearBtn: {
    position: 'absolute',
    right: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  clearText: {
    fontWeight: '600',
    fontSize: 12,
  },
  searchContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    zIndex: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  resultsList: {
    position: 'absolute',
    top: 58,
    left: 12,
    right: 12,
    maxHeight: 180,
    borderRadius: 10,
    borderWidth: 1,
    zIndex: 3,
  },
  resultItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    minHeight: SEARCH_RESULT_ITEM_HEIGHT,
  },
  resultText: {
    fontSize: 13,
  },
  mapButtons: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 6,
    gap: 8,
    zIndex: 2,
  },
  iconBtn: {
    padding: 8,
    alignItems: 'center',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textarea: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeText: {
    fontWeight: '600',
  },
  centerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputHalf: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  submitRow: {
    flexDirection: 'row',
    gap: 12,
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    flex: 1,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    flex: 1,
  },
  cancelText: {
    fontWeight: '700',
  },
  submitText: {
    color: '#0b1220',
    fontWeight: '700',
  },
  locationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
  },
  locationCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  locationInfo: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 13,
  },
});

export default ManageLocationsScreen;

