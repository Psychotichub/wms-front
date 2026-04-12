// @ts-nocheck
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../theme/ThemeProvider';
import { NotificationProvider } from '../context/NotificationContext';
import { LocationProvider } from '../context/LocationContext';
import OfflineBanner from '../components/OfflineBanner';
import { I18nProvider } from '../i18n/I18nProvider';

const AppProviders = ({ children }) => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
      <ThemeProvider>
        <View style={styles.root}>
          <OfflineBanner />
          <View style={styles.flex}>
            <AuthProvider>
              <NotificationProvider>
                <LocationProvider>{children}</LocationProvider>
              </NotificationProvider>
            </AuthProvider>
          </View>
        </View>
      </ThemeProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 }
});

export default AppProviders;
