# WMS Frontend

Working Management System (WMS) - Frontend Application

## Overview

This is the frontend application for the WMS (Working Management System), built with React Native and Expo. It supports iOS, Android, and Web platforms.

## Tech Stack

- **Framework**: React Native with Expo (~54.0.32)
- **React**: 19.1.0
- **Navigation**: React Navigation (Stack, Drawer, Tabs)
- **State Management**: React Context API
- **Forms**: React Hook Form
- **Charts**: react-native-gifted-charts
- **Notifications**: expo-notifications

## Features

- **Employee Management**: Employee profiles, productivity metrics
- **Dashboard**: Analytics, charts, work trends
- **Notifications**: Push notifications, task reminders, deadline alerts
- **Multi-platform**: iOS, Android, and Web support

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

Copy `env.example` to `.env` and fill in your values:

```bash
cp env.example .env
```

Required:

- `EXPO_PUBLIC_API_URL` - Backend API URL

### 3. Run the Application

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
│   ├── config/          # Configuration files
│   ├── theme/           # Theme and styling
│   └── utils/           # Utility functions
├── assets/              # Images and static assets
├── app.config.js        # Expo configuration
└── package.json         # Dependencies
```

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

The backend API URL is configured via `EXPO_PUBLIC_API_URL` in `.env` and `app.config.js` `extra.apiUrl`.

## Troubleshooting

### Common Issues

1. **Build errors**: Clear cache with `npm start -- --clear`
2. **Native module errors**: Rebuild native apps after dependency changes

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
