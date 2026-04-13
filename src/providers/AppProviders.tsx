// @ts-nocheck
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../theme/ThemeProvider';
import { NotificationProvider } from '../context/NotificationContext';
import { LocationProvider } from '../context/LocationContext';
import OfflineBanner from '../components/OfflineBanner';
import GlobalAppBackground from '../components/GlobalAppBackground';
import { I18nProvider } from '../i18n/I18nProvider';

const AppProviders = ({ children }) => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider style={{ flex: 1 }}>
        <I18nProvider>
          <ThemeProvider>
            <GlobalAppBackground>
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
            </GlobalAppBackground>
          </ThemeProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 }
});

export default AppProviders;
