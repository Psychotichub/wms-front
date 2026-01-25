# Google Maps Configuration Quick Reference

## Current Configuration Status

### ✅ Web Platform
- **Library**: `@vis.gl/react-google-maps` (v1.7.1)
- **API Key**: Set via `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- **Map ID**: Optional, set via `EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID`
- **Configuration**: `src/components/GeofenceMap.web.js`
- **Status**: ✅ Configured

### ✅ Android Platform
- **Library**: `react-native-maps` (v1.20.1)
- **API Key**: Set via `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- **Configuration Files**:
  - `android/app/build.gradle` - manifestPlaceholders
  - `android/app/src/main/AndroidManifest.xml` - meta-data tag
- **Status**: ✅ Configured

### ✅ iOS Platform
- **Library**: `react-native-maps` (v1.20.1)
- **API Key**: Set via `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- **Configuration**: `app.config.js` - ios.infoPlist.GMSApiKey
- **Bundle ID**: `com.psychotic.wms`
- **Status**: ✅ Configured

## Required Environment Variables

### Minimum Required:
```bash
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

### Optional (Recommended for Web):
```bash
EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID=your_map_id_here
```

## Required Google Cloud APIs

Enable these APIs in your Google Cloud Console:

1. ✅ **Maps SDK for Android** - For Android native maps
2. ✅ **Maps SDK for iOS** - For iOS native maps
3. ✅ **Maps JavaScript API** - For web maps
4. ✅ **Places API** - For location search/autocomplete (used in ManageLocationsScreen)

## API Key Restrictions (Security)

### Android:
- Package name: `com.psychotic.wms`
- SHA-1 fingerprint: Get from `keytool -list -v -keystore debug.keystore`

### iOS:
- Bundle ID: `com.psychotic.wms`

### Web:
- HTTP referrers: `localhost:8081/*`, `yourdomain.com/*`

## Testing Checklist

- [ ] API key set in `.env` file
- [ ] All required APIs enabled in Google Cloud Console
- [ ] API key restrictions configured
- [ ] Web maps load correctly
- [ ] Android maps load correctly
- [ ] iOS maps load correctly
- [ ] Location search/autocomplete works
- [ ] Map markers display correctly

## Files Modified

1. `app.config.js` - Added iOS Google Maps configuration
2. `env.example` - Added Map ID documentation
3. `GOOGLE_MAPS_SETUP.md` - Complete setup guide

## Next Steps

1. Get your Google Maps API key from Google Cloud Console
2. Add it to your `.env` file
3. (Optional) Create a Map ID for Advanced Markers on web
4. Rebuild native apps: `npx expo run:android` or `npx expo run:ios`
5. Test maps on all platforms

For detailed setup instructions, see `GOOGLE_MAPS_SETUP.md`.
