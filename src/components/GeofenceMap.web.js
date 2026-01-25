import React, { forwardRef, useMemo, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { APIProvider, Map, AdvancedMarker, Marker as RegularMarker, Polygon as GooglePolygon, useMap } from '@vis.gl/react-google-maps';
import { getGoogleMapsApiKey, getGoogleMapsMapId } from '../config/runtime';

const PROVIDER_GOOGLE = 'google';

const getZoomFromDelta = (latDelta) => {
  if (!latDelta) return 14;
  const zoom = Math.log2(360 / latDelta);
  return Math.min(20, Math.max(1, Math.round(zoom)));
};

// Wrapper components to match react-native-maps API for compatibility
// These must be defined before GeofenceMap to ensure proper exports
const Marker = forwardRef(({ coordinate, position, title, description, pinColor, ...props }, ref) => {
  // Convert coordinate (native format) to position (web format)
  const markerPosition = position || (coordinate ? { lat: coordinate.latitude, lng: coordinate.longitude } : null);
  
  if (!markerPosition) {
    console.warn('Marker: coordinate or position is required');
    return null;
  }

  // Use AdvancedMarker if Map ID is available, otherwise regular Marker
  const mapId = getGoogleMapsMapId();
  const MarkerComponent = mapId ? AdvancedMarker : RegularMarker;

  return (
    <MarkerComponent
      ref={ref}
      position={markerPosition}
      title={title}
      {...props}
    />
  );
});

Marker.displayName = 'Marker';

const Polygon = forwardRef(({ coordinates, paths, fillColor, strokeColor, strokeWidth, ...props }, ref) => {
  // Convert coordinates (native format) to paths (web format)
  const polygonPaths = paths || (coordinates ? coordinates.map(coord => ({ lat: coord.latitude, lng: coord.longitude })) : null);
  
  if (!polygonPaths || polygonPaths.length === 0) {
    console.warn('Polygon: coordinates or paths is required');
    return null;
  }

  return (
    <GooglePolygon
      ref={ref}
      paths={polygonPaths}
      options={{
        fillColor: fillColor || 'rgba(34, 197, 94, 0.3)',
        strokeColor: strokeColor || '#22c55e',
        strokeWeight: strokeWidth || 2,
        ...props.options
      }}
      {...props}
    />
  );
});

Polygon.displayName = 'Polygon';

// Internal component to access map instance
const MapController = ({ mapRef, onRegionChangeComplete }) => {
  const map = useMap();
  
  useEffect(() => {
    if (map && mapRef) {
      mapRef.current = map;
    }
  }, [map, mapRef]);

  useEffect(() => {
    if (!map || !onRegionChangeComplete) return;
    
    const handleIdle = () => {
      try {
        const center = map.getCenter();
        const zoom = map.getZoom();
        if (center) {
          const latDelta = 360 / Math.pow(2, zoom);
          onRegionChangeComplete({
            latitude: center.lat(),
            longitude: center.lng(),
            latitudeDelta: latDelta,
            longitudeDelta: latDelta,
          });
        }
      } catch (_err) {
        // Map not ready
      }
    };

    const listener = map.addListener('idle', handleIdle);
    return () => {
      if (listener) {
        window.google?.maps?.event?.removeListener(listener);
      }
    };
  }, [map, onRegionChangeComplete]);

  return null;
};

const GeofenceMap = forwardRef(
  (
    {
      region,
      location,
      geofenceData,
      geofenceName,
      style,
      children,
      onPress,
      onRegionChangeComplete,
      ...rest
    },
    ref
  ) => {
    const mapRef = useRef(null);
    const [currentRegion, setCurrentRegion] = useState(region);
    const [mapError, setMapError] = useState(null);
    
    // Get Google Maps API key - fails fast if missing (required for maps)
    const apiKey = getGoogleMapsApiKey();
    // Get optional Map ID - required for Advanced Markers
    const mapId = getGoogleMapsMapId();
    // Use AdvancedMarker if Map ID is available, otherwise fall back to regular Marker
    const MarkerComponent = mapId ? AdvancedMarker : RegularMarker;

    // Update current region when prop changes
    useEffect(() => {
      if (region) {
        setCurrentRegion(region);
      }
    }, [region]);

    const center = useMemo(() => {
      if (currentRegion?.latitude && currentRegion?.longitude) {
        return { lat: currentRegion.latitude, lng: currentRegion.longitude };
      }
      // Default to Singapore if no region provided
      return { lat: 1.3521, lng: 103.8198 };
    }, [currentRegion]);

    const zoom = useMemo(() => getZoomFromDelta(currentRegion?.latitudeDelta), [currentRegion?.latitudeDelta]);

    // Expose methods for programmatic map control (compatible with react-native-maps API)
    useImperativeHandle(ref, () => ({
      animateToRegion: (newRegion, duration = 500) => {
        if (!mapRef.current || !newRegion) return;
        const map = mapRef.current;
        
        if (map && typeof map.panTo === 'function') {
          // Use Google Maps API methods
          const newCenter = { lat: newRegion.latitude, lng: newRegion.longitude };
          const newZoom = getZoomFromDelta(newRegion.latitudeDelta || 0.01);
          
          // Pan to new center with smooth animation
          map.panTo(newCenter);
          
          // Set zoom level
          if (typeof map.setZoom === 'function') {
            map.setZoom(newZoom);
          }
          
          // Update state to reflect new region
          setCurrentRegion(newRegion);
          
          // Notify parent of region change
          if (onRegionChangeComplete) {
            setTimeout(() => {
              onRegionChangeComplete(newRegion);
            }, duration);
          }
        }
      },
      getCamera: () => {
        if (!mapRef.current) return null;
        const map = mapRef.current;
        if (map && typeof map.getCenter === 'function') {
          try {
            const center = map.getCenter();
            const zoom = map.getZoom();
            if (center) {
              const latDelta = 360 / Math.pow(2, zoom);
              return {
                latitude: center.lat(),
                longitude: center.lng(),
                latitudeDelta: latDelta,
                longitudeDelta: latDelta,
              };
            }
          } catch (_err) {
            // Map not ready
          }
        }
        return null;
      },
    }), [onRegionChangeComplete]);

    const handleClick = (event) => {
      if (!onPress) return;
      const latLng = event.detail?.latLng;
      if (!latLng) return;
      onPress({
        nativeEvent: {
          coordinate: {
            latitude: latLng.lat,
            longitude: latLng.lng,
          },
        },
      });
    };

    // Handle map errors - check console for Google Maps errors
    useEffect(() => {
      // Monitor for Google Maps errors in console
      const originalError = console.error;
      const errorHandler = (...args) => {
        const errorMessage = args.join(' ');
        if (errorMessage.includes('ApiTargetBlockedMapError') || 
            errorMessage.includes('api-target-blocked-map-error')) {
          setMapError('API_KEY_RESTRICTED');
        } else if (errorMessage.includes('Google Maps') && errorMessage.includes('error')) {
          // Log other Google Maps errors but don't block the UI
          console.warn('Google Maps error detected:', errorMessage);
        }
        originalError.apply(console, args);
      };
      
      // Override console.error temporarily to catch Google Maps errors
      console.error = errorHandler;
      
      // Also listen for window errors
      const handleWindowError = (event) => {
        if (event.message?.includes('ApiTargetBlockedMapError') || 
            event.message?.includes('api-target-blocked-map-error')) {
          setMapError('API_KEY_RESTRICTED');
        }
      };
      
      window.addEventListener('error', handleWindowError);
      
      return () => {
        console.error = originalError;
        window.removeEventListener('error', handleWindowError);
      };
    }, []);

    // Show error message if API key is restricted
    if (mapError === 'API_KEY_RESTRICTED') {
      return (
        <View style={{
          ...style,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          backgroundColor: '#fef2f2',
          borderWidth: 1,
          borderColor: '#fecaca',
          borderRadius: 8,
        }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8, color: '#991b1b' }}>
            ⚠️ Google Maps API Key Restricted
          </Text>
          <Text style={{ fontSize: 14, textAlign: 'center', marginBottom: 12, color: '#991b1b' }}>
            Your API key has HTTP referrer restrictions. Please add the current domain to your allowed referrers in Google Cloud Console.
          </Text>
          <Text style={{ fontSize: 12, color: '#7f1d1d', textAlign: 'center', marginBottom: 8 }}>
            Quick Fix:{'\n'}
            1. Go to Google Cloud Console → APIs & Services → Credentials{'\n'}
            2. Click your API key → Application restrictions{'\n'}
            3. Add: localhost:8081/* and localhost:19006/*{'\n'}
            4. Save and wait 5-10 minutes, then refresh
          </Text>
          <Text style={{ fontSize: 11, color: '#991b1b', marginTop: 12, textAlign: 'center' }}>
            See GOOGLE_MAPS_TROUBLESHOOTING.md for detailed instructions
          </Text>
        </View>
      );
    }

    return (
      <APIProvider apiKey={apiKey} libraries={mapId ? ['marker'] : []}>
        <Map
          style={style}
          center={center}
          zoom={zoom}
          gestureHandling="greedy"
          disableDefaultUI={false}
          onClick={handleClick}
          mapId={mapId}
          {...rest}
        >
          <MapController mapRef={mapRef} onRegionChangeComplete={onRegionChangeComplete} />
          {children ? (
            children
          ) : (
            <>
              {location && location.coords && (
                <MarkerComponent
                  position={{ lat: location.coords.latitude, lng: location.coords.longitude }}
                  title="Your Current Location"
                />
              )}
              {geofenceData && geofenceData.coordinates?.length && (
                <GooglePolygon
                  paths={geofenceData.coordinates.map(coord => ({ lat: coord[1], lng: coord[0] }))}
                  options={{
                    fillColor: '#22c55e55',
                    strokeColor: '#22c55e',
                    strokeWeight: 2,
                  }}
                />
              )}
              {geofenceData?.coordinates?.length > 0 && (
                <MarkerComponent
                  position={{
                    lat:
                      geofenceData.coordinates.reduce((sum, coord) => sum + coord[1], 0) /
                      geofenceData.coordinates.length,
                    lng:
                      geofenceData.coordinates.reduce((sum, coord) => sum + coord[0], 0) /
                      geofenceData.coordinates.length,
                  }}
                  title={geofenceName || 'Geofence'}
                />
              )}
            </>
          )}
        </Map>
      </APIProvider>
    );
  }
);

GeofenceMap.displayName = 'GeofenceMap';

export default GeofenceMap;
export { Polygon, Marker, PROVIDER_GOOGLE };

