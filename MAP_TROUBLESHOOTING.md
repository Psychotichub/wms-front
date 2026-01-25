# Map and Search Troubleshooting Guide

## Issue: Can't See Location on Map and Can't Search

### Quick Checks

1. **Check Browser Console** (F12 → Console tab)
   - Look for Google Maps API errors
   - Look for Places API errors
   - Check for any red error messages

2. **Verify API Key Configuration**
   - Check that `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is set in your `.env` file
   - Restart the Expo dev server after changing `.env` file

3. **Check Required APIs are Enabled**
   - Go to [Google Cloud Console → APIs & Services → Library](https://console.cloud.google.com/apis/library)
   - Ensure these APIs are **ENABLED**:
     - ✅ Maps JavaScript API
     - ✅ Places API (required for search)
     - ✅ Maps SDK for Android (for Android)
     - ✅ Maps SDK for iOS (for iOS)

### Common Issues and Solutions

#### 1. Map Shows Blank/No Location

**Symptoms:**
- Map loads but shows empty/default location
- No markers visible
- Map centered at 0,0 or default location

**Solutions:**

a) **Current Location Not Available:**
   - The app will default to Singapore (1.3521, 103.8198) if location is not available
   - Grant location permissions in your browser
   - Check browser console for location permission errors

b) **Location Permission:**
   - Click the location icon in browser address bar
   - Allow location access
   - Refresh the page

c) **Check Location Context:**
   - The map uses `currentLocation` from `LocationContext`
   - Ensure location tracking is started
   - Check if `currentLocation?.coords` exists in console

#### 2. Search Not Working

**Symptoms:**
- Search box doesn't show results
- Error messages when typing
- "REQUEST_DENIED" errors

**Solutions:**

a) **Places API Not Enabled:**
   ```
   1. Go to Google Cloud Console
   2. APIs & Services → Library
   3. Search for "Places API"
   4. Click "Enable"
   ```

b) **API Key Restrictions:**
   - Go to [Credentials](https://console.cloud.google.com/apis/credentials)
   - Click your API key
   - Under "API restrictions":
     - Select "Restrict key"
     - Add: "Places API" and "Maps JavaScript API"
   - Under "Application restrictions" (Web):
     - Add: `localhost:8081/*` and `localhost:19006/*`

c) **Check API Key in Code:**
   - Open browser console
   - Type: `console.log(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)`
   - Should show your API key (not undefined)

#### 3. Map Not Loading at All

**Symptoms:**
- Blank map area
- Error message displayed
- "ApiTargetBlockedMapError"

**Solutions:**

a) **API Key Restrictions:**
   - See [GOOGLE_MAPS_TROUBLESHOOTING.md](../GOOGLE_MAPS_TROUBLESHOOTING.md)
   - Add your domain to HTTP referrer restrictions

b) **API Key Missing:**
   - Check `.env` file has `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here`
   - Restart Expo dev server: `npm start -- --clear`

#### 4. Markers Not Showing

**Symptoms:**
- Map loads but no markers visible
- Current location marker missing
- Search result markers not appearing

**Solutions:**

a) **Check Marker Components:**
   - Markers should render as children of `<GeofenceMap>`
   - Verify `currentLocation?.coords` exists
   - Check browser console for React errors

b) **Marker Props:**
   - Web uses `position={{ lat, lng }}` format
   - Native uses `coordinate={{ latitude, longitude }}` format
   - The wrapper components handle conversion automatically

### Debugging Steps

1. **Open Browser Console** (F12)

2. **Check for Errors:**
   ```javascript
   // Look for these errors:
   - "Google Maps JavaScript API error"
   - "Places API error"
   - "ApiTargetBlockedMapError"
   - "REQUEST_DENIED"
   ```

3. **Verify API Key:**
   ```javascript
   // In browser console:
   console.log('API Key configured:', !!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);
   ```

4. **Test Places API Directly:**
   ```javascript
   // In browser console (replace YOUR_API_KEY):
   fetch('https://maps.googleapis.com/maps/api/place/autocomplete/json?input=singapore&key=YOUR_API_KEY')
     .then(r => r.json())
     .then(console.log);
   ```
   
   Expected: `{ predictions: [...] }`
   Error: `{ error_message: "...", status: "REQUEST_DENIED" }`

5. **Check Current Location:**
   ```javascript
   // The app logs location info in console
   // Look for: "Map region updated: { latitude, longitude, ... }"
   // Or: "Current location not available. Using default region."
   ```

### Verification Checklist

- [ ] API key is set in `.env` file
- [ ] Expo dev server restarted after `.env` changes
- [ ] Maps JavaScript API is enabled
- [ ] Places API is enabled
- [ ] API key has correct restrictions (or no restrictions for testing)
- [ ] Browser location permission granted
- [ ] No console errors related to Google Maps
- [ ] Map displays (even if at default location)
- [ ] Search box is visible and functional

### Testing Search Functionality

1. Type at least 3 characters in the search box
2. Wait for autocomplete results
3. If no results:
   - Check browser console for errors
   - Verify Places API is enabled
   - Check API key restrictions
   - Test API directly (see debugging steps above)

### Testing Map Display

1. Check if map loads (should see Google Maps)
2. Check if default location shows (Singapore if no current location)
3. Click "Go to Current Location" button (if available)
4. Check browser console for location permission prompts
5. Verify markers appear when:
   - Current location is available
   - Search result is selected
   - Map is clicked (for polygon/circle mode)

### Still Not Working?

1. **Clear Browser Cache:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or clear browser cache completely

2. **Check Network Tab:**
   - Open DevTools → Network tab
   - Look for failed requests to `maps.googleapis.com`
   - Check response status codes (should be 200)

3. **Verify Environment Variables:**
   ```bash
   # In frontend directory
   cat .env | grep GOOGLE_MAPS
   ```

4. **Test with Minimal Restrictions:**
   - Temporarily remove all API key restrictions
   - Test if map and search work
   - If yes, add restrictions back one by one

### Expected Behavior

✅ **Working Map:**
- Map displays Google Maps
- Default location: Singapore (1.3521, 103.8198) if no current location
- Current location marker (green) if location available
- Map is interactive (zoom, pan, click)

✅ **Working Search:**
- Type 3+ characters → autocomplete appears
- Select result → map centers on location
- Blue marker appears at selected location
- Location name auto-fills in form

### Contact Support

If issues persist after trying all solutions:
1. Check browser console for specific error messages
2. Note which step fails (map load, search, markers)
3. Share error messages and console logs
