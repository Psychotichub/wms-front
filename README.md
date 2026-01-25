# WMS Frontend

Working Management System (WMS) - Frontend Application

## Overview

This is the frontend application for the WMS (Working Management System), built with React Native and Expo. It supports iOS, Android, and Web platforms.

## Tech Stack

- **Framework**: React Native with Expo (~54.0.32)
- **React**: 19.1.0
- **Navigation**: React Navigation (Stack, Drawer, Tabs)
- **Maps**: 
  - Web: `@vis.gl/react-google-maps` (v1.7.1)
  - Native: `react-native-maps` (v1.20.1)
- **State Management**: React Context API
- **Forms**: React Hook Form
- **Charts**: react-native-gifted-charts
- **Location**: expo-location
- **Notifications**: expo-notifications

## Features

- 📍 **Location Management**: Geofencing, location tracking, attendance based on location
- 👥 **Employee Management**: Employee profiles, productivity metrics, real-time location tracking
- 📊 **Dashboard**: Analytics, charts, work trends
- 🔔 **Notifications**: Push notifications, task reminders, deadline alerts
- 🗺️ **Maps Integration**: Google Maps with Advanced Markers support
- 🌐 **Multi-platform**: iOS, Android, and Web support

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- For iOS: Xcode and CocoaPods
- For Android: Android Studio and Android SDK

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp env.example .env
```

Required environment variables:
- `EXPO_PUBLIC_API_URL` - Backend API URL
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` - Google Maps API key (required)

Optional:
- `EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID` - Google Maps Map ID (for Advanced Markers on web)

### 3. Google Maps Setup

See [GOOGLE_MAPS_SETUP.md](./GOOGLE_MAPS_SETUP.md) for detailed Google Maps configuration instructions.

Quick setup:
1. Get your Google Maps API key from [Google Cloud Console](https://console.cloud.google.com/)
2. Enable required APIs: Maps JavaScript API, Maps SDK for Android/iOS, Places API
3. Add the API key to your `.env` file
4. Configure API key restrictions (see setup guide)

### 4. Run the Application

#### Development Server

```bash
npm start
```

#### Platform-Specific

```bash
# Web
npm run web

# Android
npm run android

# iOS
npm run ios
```

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable components
│   ├── screens/         # Screen components
│   ├── navigation/      # Navigation configuration
│   ├── context/         # React Context providers
│   ├── config/         # Configuration files
│   ├── theme/           # Theme and styling
│   ├── utils/           # Utility functions
│   └── tasks/           # Background tasks
├── assets/              # Images and static assets
├── android/             # Android native code
├── ios/                 # iOS native code (if generated)
├── app.config.js        # Expo configuration
└── package.json         # Dependencies
```

## Key Components

### Maps
- `GeofenceMap.web.js` - Web map component (Google Maps)
- `GeofenceMap.native.js` - Native map component (react-native-maps)

### Screens
- `DashboardScreen.js` - Main dashboard with analytics
- `ManageLocationsScreen.js` - Location/geofence management
- `LoginScreen.js` - Authentication
- And more...

## Building for Production

### Android

```bash
npm run build:dev
```

### iOS

```bash
npm run build:dev:ios
```

## Configuration

### Google Maps

The app uses Google Maps for location features. Configuration is handled through:

- `app.config.js` - Expo configuration with API keys
- `src/config/runtime.js` - Runtime configuration reader
- Environment variables in `.env`

See [GOOGLE_MAPS_SETUP.md](./GOOGLE_MAPS_SETUP.md) for complete setup instructions.

### API Configuration

The backend API URL is configured via `EXPO_PUBLIC_API_URL` environment variable.

## Troubleshooting

### Google Maps Errors

If you encounter `ApiTargetBlockedMapError`, see [GOOGLE_MAPS_TROUBLESHOOTING.md](../GOOGLE_MAPS_TROUBLESHOOTING.md) for solutions.

### Common Issues

1. **Maps not loading**: Check API key configuration and restrictions
2. **Build errors**: Clear cache with `npm start -- --clear`
3. **Native module errors**: Rebuild native apps after dependency changes

## Development

### Code Style

The project uses ESLint for code quality. Run linting:

```bash
npm run lint
```

### Environment Variables

- Development: Use `EXPO_PUBLIC_*` prefix for all public env vars
- Never commit `.env` files (they're in `.gitignore`)
- Use `env.example` as a template

## Contributing

1. Create a feature branch
2. Make your changes
3. Test on all platforms (iOS, Android, Web)
4. Submit a pull request

## License

Private - All rights reserved

## Support

For issues and questions, please contact the development team.
