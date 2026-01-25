import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View, Text, Platform, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GeofenceMap, { Marker, Polygon } from '../GeofenceMap';
import { useAuth } from '../../context/AuthContext';
import { useThemeTokens } from '../../theme/ThemeProvider';
import EmptyState from './EmptyState';

const UPDATE_INTERVAL = 30000; // 30 seconds

const RealTimeMapWidget = ({ style }) => {
  const { request } = useAuth();
  const t = useThemeTokens();
  const mapRef = useRef(null);
  const [activeLocations, setActiveLocations] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [mapRegion, setMapRegion] = useState(null);

  const fetchMapData = useCallback(async () => {
    try {
      setError(null);
      const [locationsRes, geofencesRes] = await Promise.all([
        request('/api/employees/active-locations'),
        request('/api/locations/geofences')
      ]);

      if (locationsRes?.success) {
        setActiveLocations(locationsRes.locations || []);
      }

      if (geofencesRes?.success) {
        setGeofences(geofencesRes.geofences || []);
      }

      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching map data:', err);
      setError(err.message || 'Failed to load map data');
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    fetchMapData();
    const interval = setInterval(fetchMapData, UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchMapData]);

  // Calculate map region to fit all markers
  const calculatedRegion = useMemo(() => {
    const allPoints = [
      ...activeLocations.map(loc => ({ lat: loc.latitude, lon: loc.longitude })),
      ...geofences.flatMap(gf => {
        if (gf.type === 'circle' && gf.center) {
          return [{ lat: gf.center[1], lon: gf.center[0] }];
        }
        if (gf.coordinates && gf.coordinates.length > 0) {
          return gf.coordinates.map(coord => ({ lat: coord[1], lon: coord[0] }));
        }
        return [];
      })
    ];

    if (allPoints.length === 0) {
      // Default to Singapore instead of 0,0
      return {
        latitude: 1.3521,
        longitude: 103.8198,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1
      };
    }

    const lats = allPoints.map(p => p.lat).filter(Number.isFinite);
    const lons = allPoints.map(p => p.lon).filter(Number.isFinite);

    if (lats.length === 0 || lons.length === 0) {
      return {
        latitude: 1.3521,
        longitude: 103.8198,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1
      };
    }

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const latDelta = Math.max((maxLat - minLat) * 1.5, 0.01);
    const lonDelta = Math.max((maxLon - minLon) * 1.5, 0.01);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lonDelta
    };
  }, [activeLocations, geofences]);

  // Update map region when calculated region changes
  useEffect(() => {
    if (calculatedRegion) {
      setMapRegion(calculatedRegion);
    }
  }, [calculatedRegion]);

  // Zoom functions
  const animateToRegion = useCallback((region) => {
    if (!region) return;
    mapRef.current?.animateToRegion(region, 500);
    setMapRegion(region);
  }, []);

  const zoom = useCallback((factor) => {
    if (!mapRegion) return;
    animateToRegion({
      ...mapRegion,
      latitudeDelta: mapRegion.latitudeDelta * factor,
      longitudeDelta: mapRegion.longitudeDelta * factor,
    });
  }, [mapRegion, animateToRegion]);

  const formatElapsedTime = (ms) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading && activeLocations.length === 0 && geofences.length === 0) {
    return (
      <View style={[styles.container, style, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.colors.text }]}>Real-time Map</Text>
          <ActivityIndicator size="small" color={t.colors.primary} />
        </View>
        <View style={styles.mapContainer}>
          <ActivityIndicator size="large" color={t.colors.primary} />
        </View>
      </View>
    );
  }

  if (error && activeLocations.length === 0 && geofences.length === 0) {
    return (
      <View style={[styles.container, style, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.colors.text }]}>Real-time Map</Text>
        </View>
        <EmptyState
          icon="map-outline"
          title="Unable to load map"
          subtitle={error}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, style, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="map-outline" size={20} color={t.colors.primary} />
          <Text style={[styles.title, { color: t.colors.text }]}>Real-time Map</Text>
        </View>
        <View style={styles.headerRight}>
          {lastUpdate && (
            <Text style={[styles.updateTime, { color: t.colors.textSecondary }]}>
              Updated {lastUpdate.toLocaleTimeString()}
            </Text>
          )}
          <View style={[styles.badge, { backgroundColor: t.colors.primary + '20' }]}>
            <Text style={[styles.badgeText, { color: t.colors.primary }]}>
              {activeLocations.length} active
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.mapContainer}>
        {(mapRegion && (mapRegion.latitude !== 0 || mapRegion.longitude !== 0)) ? (
          <>
            <GeofenceMap
              ref={mapRef}
              region={mapRegion || calculatedRegion}
              style={styles.map}
              scrollEnabled={true}
              zoomEnabled={true}
              onRegionChangeComplete={(region) => setMapRegion(region)}
            >
            {/* Render geofences */}
            {geofences.map((geofence) => {
              if (geofence.type === 'circle' && geofence.center) {
                // For circles, we'll show a marker at the center
                // Note: react-native-maps doesn't support circle overlays directly in the same way
                // You might want to use a custom overlay or just show the center marker
                return (
                  <Marker
                    key={geofence.id}
                    coordinate={{
                      latitude: geofence.center[1],
                      longitude: geofence.center[0]
                    }}
                    title={geofence.name}
                    description={`Site (${geofence.radius || 'N/A'}m radius)`}
                    pinColor="#3b82f6"
                  />
                );
              }
              if (geofence.coordinates && geofence.coordinates.length > 0) {
                return (
                  <React.Fragment key={geofence.id}>
                    <Polygon
                      coordinates={geofence.coordinates.map(coord => ({
                        latitude: coord[1],
                        longitude: coord[0]
                      }))}
                      fillColor="rgba(59, 130, 246, 0.2)"
                      strokeColor="#3b82f6"
                      strokeWidth={2}
                    />
                    <Marker
                      coordinate={{
                        latitude:
                          geofence.coordinates.reduce((sum, coord) => sum + coord[1], 0) /
                          geofence.coordinates.length,
                        longitude:
                          geofence.coordinates.reduce((sum, coord) => sum + coord[0], 0) /
                          geofence.coordinates.length
                      }}
                      title={geofence.name}
                      description="Active Site"
                      pinColor="#3b82f6"
                    />
                  </React.Fragment>
                );
              }
              return null;
            })}

            {/* Render employee locations */}
            {activeLocations.map((location) => (
              <Marker
                key={location.employeeId}
                coordinate={{
                  latitude: location.latitude,
                  longitude: location.longitude
                }}
                title={location.employeeName}
                description={`${location.locationName} • ${formatElapsedTime(location.elapsedTime)}`}
                pinColor="#22c55e"
              />
            ))}
            </GeofenceMap>
            {/* Zoom Controls */}
            <View style={[styles.zoomControls, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
              <Pressable 
                style={styles.zoomButton} 
                onPress={() => zoom(0.7)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="add" size={18} color={t.colors.text} />
              </Pressable>
              <Pressable 
                style={styles.zoomButton} 
                onPress={() => zoom(1.3)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="remove" size={18} color={t.colors.text} />
              </Pressable>
            </View>
          </>
        ) : (
          <EmptyState
            icon="map-outline"
            title="No locations available"
            subtitle="Active sites and employee locations will appear here"
          />
        )}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
          <Text style={[styles.legendText, { color: t.colors.textSecondary }]}>Active Sites</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
          <Text style={[styles.legendText, { color: t.colors.textSecondary }]}>Employees</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
      },
      android: {
        elevation: 2
      },
      default: {
        boxShadow: '0px 2px 4px rgba(0,0,0,0.1)'
      }
    })
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  title: {
    fontSize: 18,
    fontWeight: '700'
  },
  updateTime: {
    fontSize: 11
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600'
  },
  mapContainer: {
    height: 250,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    position: 'relative'
  },
  map: {
    flex: 1
  },
  zoomControls: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    padding: 4,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4
      },
      android: {
        elevation: 4
      },
      default: {
        boxShadow: '0px 2px 8px rgba(0,0,0,0.15)'
      }
    })
  },
  zoomButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    minHeight: 32
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6
  },
  legendText: {
    fontSize: 12
  }
});

export default RealTimeMapWidget;
