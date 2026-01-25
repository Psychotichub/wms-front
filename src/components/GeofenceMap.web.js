import React, { forwardRef, useMemo, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { APIProvider, Map, AdvancedMarker, Marker as RegularMarker, Polygon as GooglePolygon, InfoWindow, useMap } from '@vis.gl/react-google-maps';
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

// Circle component using Google Maps JS API imperatively
const Circle = forwardRef(({ center, coordinate, radius, fillColor, strokeColor, strokeWidth, ...props }, ref) => {
  const map = useMap();
  const circleRef = useRef(null);
  
  // Convert coordinate (native format) to center (web format)
  // Handle both native format {latitude, longitude} and web format {lat, lng}
  const circleCenter = useMemo(() => {
    if (center) {
      // Check if it's in native format (has latitude/longitude) or web format (has lat/lng)
      if ('latitude' in center && 'longitude' in center) {
        return { lat: center.latitude, lng: center.longitude };
      }
      if ('lat' in center && 'lng' in center) {
        return center;
      }
    }
    if (coordinate) {
      return { lat: coordinate.latitude, lng: coordinate.longitude };
    }
    return null;
  }, [center, coordinate]);
  
  // Expose circle instance via ref if needed
  useImperativeHandle(ref, () => circleRef.current, []);
  
  // Create and update circle imperatively
  useEffect(() => {
    if (!map || !circleCenter || !radius || radius <= 0) {
      // Clean up if data becomes invalid
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      return;
    }
    
    // Create circle if it doesn't exist
    if (!circleRef.current) {
      const googleCircle = new window.google.maps.Circle({
        center: circleCenter,
        radius: radius,
        fillColor: fillColor || 'rgba(59, 130, 246, 0.2)',
        fillOpacity: 0.2,
        strokeColor: strokeColor || '#3b82f6',
        strokeWeight: strokeWidth || 2,
        strokeOpacity: 1,
        map: map,
        ...(props.options || {})
      });
      circleRef.current = googleCircle;
    } else {
      // Update existing circle
      circleRef.current.setCenter(circleCenter);
      circleRef.current.setRadius(radius);
      circleRef.current.setOptions({
        fillColor: fillColor || 'rgba(59, 130, 246, 0.2)',
        strokeColor: strokeColor || '#3b82f6',
        strokeWeight: strokeWidth || 2,
        ...(props.options || {})
      });
    }
    
    // Cleanup on unmount
    return () => {
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
    };
  }, [map, circleCenter, radius, fillColor, strokeColor, strokeWidth, props.options]);
  
  // Return null since we're rendering imperatively
  return null;
});

Circle.displayName = 'Circle';

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

  // Hide Google Maps default location button (we want only one location button)
  useEffect(() => {
    if (!map) return;
    
    // Add global CSS to hide location buttons
    const styleId = 'hide-google-maps-location-button';
    let styleElement = document.getElementById(styleId);
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = `
        /* Hide Google Maps location button */
        button[title*="My location" i],
        button[title*="Your location" i],
        button[title*="Show your location" i],
        button[aria-label*="My location" i],
        button[aria-label*="Your location" i],
        button[aria-label*="Show your location" i],
        .gm-style button[jsaction*="location"],
        .gm-style-cc button[jsaction*="location"] {
          display: none !important;
          visibility: hidden !important;
        }
      `;
      document.head.appendChild(styleElement);
    }
    
    const hideLocationButton = () => {
      // Find and hide all location-related buttons
      const allButtons = document.querySelectorAll('button');
      let hiddenCount = 0;
      
      allButtons.forEach((button) => {
        const title = (button.getAttribute('title') || button.getAttribute('aria-label') || '').toLowerCase();
        const jsaction = (button.getAttribute('jsaction') || '').toLowerCase();
        const className = (button.className || '').toLowerCase();
        
        // Check if this is a location button
        if (
          title.includes('location') ||
          title.includes('my location') ||
          title.includes('your location') ||
          jsaction.includes('location') ||
          className.includes('location')
        ) {
          console.log('[GeofenceMap] Hiding location button:', {
            title: button.getAttribute('title'),
            ariaLabel: button.getAttribute('aria-label'),
            jsaction: button.getAttribute('jsaction'),
            className: button.className
          });
          button.style.display = 'none';
          button.style.visibility = 'hidden';
          button.style.opacity = '0';
          button.setAttribute('aria-hidden', 'true');
          hiddenCount++;
        }
      });
      
      if (hiddenCount > 0) {
        console.log(`[GeofenceMap] Hidden ${hiddenCount} location button(s)`);
      }
      
      // Also check buttons in the map container specifically
      try {
        const mapDiv = map.getDiv ? map.getDiv() : null;
        if (mapDiv) {
          const mapButtons = mapDiv.querySelectorAll('button');
          mapButtons.forEach((button) => {
            const title = (button.getAttribute('title') || button.getAttribute('aria-label') || '').toLowerCase();
            if (title.includes('location')) {
              button.style.display = 'none';
              button.style.visibility = 'hidden';
              button.style.opacity = '0';
            }
          });
        }
      } catch (_e) {
        // Map div not available
      }
    };
    
    // Try to hide immediately and periodically (buttons load asynchronously)
    hideLocationButton();
    const timeout1 = setTimeout(hideLocationButton, 100);
    const timeout2 = setTimeout(hideLocationButton, 500);
    const interval = setInterval(hideLocationButton, 500);
    
    // Also listen for map idle event to catch buttons that load later
    let idleListener = null;
    try {
      idleListener = map.addListener('idle', hideLocationButton);
    } catch (_e) {
      // Listener not available
    }
    
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearInterval(interval);
      if (idleListener && window.google?.maps?.event) {
        try {
          window.google.maps.event.removeListener(idleListener);
        } catch (_e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [map]);

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
    const [isUserInteracting, setIsUserInteracting] = useState(false);
    
    // Get Google Maps API key - fails fast if missing (required for maps)
    const apiKey = getGoogleMapsApiKey();
    // Get optional Map ID - required for Advanced Markers
    const mapId = getGoogleMapsMapId();
    // Use AdvancedMarker if Map ID is available, otherwise fall back to regular Marker
    const MarkerComponent = mapId ? AdvancedMarker : RegularMarker;

    // Update current region when prop changes (only if not user-interacting)
    useEffect(() => {
      if (region && !isUserInteracting) {
        setCurrentRegion(region);
      }
    }, [region, isUserInteracting]);

    const defaultCenter = useMemo(() => {
      if (currentRegion?.latitude && currentRegion?.longitude) {
        return { lat: currentRegion.latitude, lng: currentRegion.longitude };
      }
      // Default to Singapore if no region provided
      return { lat: 1.3521, lng: 103.8198 };
    }, [currentRegion]);

    const defaultZoom = useMemo(() => getZoomFromDelta(currentRegion?.latitudeDelta), [currentRegion?.latitudeDelta]);

    // Expose methods for programmatic map control (compatible with react-native-maps API)
    useImperativeHandle(ref, () => ({
      animateToRegion: (newRegion, duration = 500) => {
        if (!mapRef.current || !newRegion) return;
        const map = mapRef.current;
        
        if (map && typeof map.panTo === 'function') {
          // Temporarily disable user interaction flag for programmatic updates
          setIsUserInteracting(false);
          
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

    // Handle zoom changes from user interaction
    const handleZoomChanged = () => {
      if (!mapRef.current) return;
      setIsUserInteracting(true);
      
      try {
        const map = mapRef.current;
        const center = map.getCenter();
        const zoom = map.getZoom();
        if (center) {
          const latDelta = 360 / Math.pow(2, zoom);
          const newRegion = {
            latitude: center.lat(),
            longitude: center.lng(),
            latitudeDelta: latDelta,
            longitudeDelta: latDelta,
          };
          setCurrentRegion(newRegion);
        }
      } catch (_err) {
        // Map not ready
      }
    };

    // Handle center changes from user interaction (panning)
    const handleCenterChanged = () => {
      if (!mapRef.current) return;
      setIsUserInteracting(true);
      
      try {
        const map = mapRef.current;
        const center = map.getCenter();
        const zoom = map.getZoom();
        if (center) {
          const latDelta = 360 / Math.pow(2, zoom);
          const newRegion = {
            latitude: center.lat(),
            longitude: center.lng(),
            latitudeDelta: latDelta,
            longitudeDelta: latDelta,
          };
          setCurrentRegion(newRegion);
        }
      } catch (_err) {
        // Map not ready
      }
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
      <APIProvider apiKey={apiKey} libraries={mapId ? ['marker', 'places'] : ['places']}>
        <Map
          style={style}
          defaultCenter={defaultCenter}
          defaultZoom={defaultZoom}
          gestureHandling="greedy"
          disableDefaultUI={true}
          zoomControl={false}
          fullscreenControl={false}
          mapTypeControl={false}
          streetViewControl={false}
          onClick={handleClick}
          onZoomChanged={handleZoomChanged}
          onCenterChanged={handleCenterChanged}
          onIdle={() => {
            // Reset interaction flag after idle
            // MapController will handle onRegionChangeComplete callback
            setIsUserInteracting(false);
          }}
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
export { Polygon, Marker, Circle, InfoWindow, PROVIDER_GOOGLE };

