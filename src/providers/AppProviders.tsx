// @ts-nocheck
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../theme/ThemeProvider';
import { NotificationProvider } from '../context/NotificationContext';
import OfflineBanner from '../components/OfflineBanner';
import GlobalAppBackground from '../components/GlobalAppBackground';
import { I18nProvider } from '../i18n/I18nProvider';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.type = 'text/css';
  style.appendChild(document.createTextNode(`
    input, textarea, select {
      font-size: 13.5px !important;
      padding-top: 8px !important;
      padding-bottom: 8px !important;
      padding-left: 12px !important;
      padding-right: 12px !important;
      height: 38px !important;
      min-height: 38px !important;
    }
    textarea {
      height: auto !important;
      min-height: 80px !important;
    }
  `));
  document.head.appendChild(style);
}

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
                    <NotificationProvider>{children}</NotificationProvider>
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
