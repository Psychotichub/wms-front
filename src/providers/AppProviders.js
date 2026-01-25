import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../theme/ThemeProvider';
import { NotificationProvider } from '../context/NotificationContext';
import { LocationProvider } from '../context/LocationContext';

const AppProviders = ({ children }) => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <LocationProvider>
              {children}
            </LocationProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
};

export default AppProviders;
