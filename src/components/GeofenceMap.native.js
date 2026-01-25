import React, { forwardRef } from 'react';
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

const GeofenceMap = forwardRef(
  (
    {
      region,
      location,
      geofenceData,
      geofenceName,
      style,
      children,
      ...rest
    },
    ref
  ) => {
  const hasLocation =
    !!location?.coords &&
    Number.isFinite(location.coords.latitude) &&
    Number.isFinite(location.coords.longitude);

  return (
    <MapView
      ref={ref}
      style={style}
      region={region}
      showsUserLocation={hasLocation}
      showsMyLocationButton={false}
      provider={PROVIDER_GOOGLE}
      scrollEnabled={rest.scrollEnabled !== undefined ? rest.scrollEnabled : true}
      zoomEnabled={rest.zoomEnabled !== undefined ? rest.zoomEnabled : true}
      {...rest}
    >
      {children}

      {!children && (
        <>
          {location && (
            <Marker
              coordinate={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }}
              title="Your Current Location"
              pinColor="#22c55e"
            />
          )}

          {geofenceData && (
            <Polygon
              coordinates={geofenceData.coordinates.map(coord => ({
                latitude: coord[1],
                longitude: coord[0],
              }))}
              fillColor="rgba(34, 197, 94, 0.3)"
              strokeColor="#22c55e"
              strokeWidth={2}
            />
          )}

          {geofenceData?.coordinates?.length > 0 && (
            <Marker
              coordinate={{
                latitude:
                  geofenceData.coordinates.reduce((sum, coord) => sum + coord[1], 0) /
                  geofenceData.coordinates.length,
                longitude:
                  geofenceData.coordinates.reduce((sum, coord) => sum + coord[0], 0) /
                  geofenceData.coordinates.length,
              }}
              title={geofenceName}
              description="Work location area"
            />
          )}
        </>
      )}
    </MapView>
  );
  }
);

GeofenceMap.displayName = 'GeofenceMap';

export default GeofenceMap;
export { Polygon, Marker, PROVIDER_GOOGLE };

