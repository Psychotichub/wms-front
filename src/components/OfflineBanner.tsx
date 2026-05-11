// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { isOnlineFromNetInfoState, isWebNavigatorOnline } from '../utils/netConnectivity';

export default function OfflineBanner() {
  const t = useThemeTokens();
  const { t: tr } = useI18n();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      const sync = () => setOffline(!isWebNavigatorOnline());
      sync();
      window.addEventListener('online', sync);
      window.addEventListener('offline', sync);
      return () => {
        window.removeEventListener('online', sync);
        window.removeEventListener('offline', sync);
      };
    }

    const unsub = NetInfo.addEventListener((state) => {
      setOffline(!isOnlineFromNetInfoState(state));
    });
    NetInfo.fetch().then((state) => setOffline(!isOnlineFromNetInfoState(state)));
    return () => unsub();
  }, []);

  if (!offline) return null;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: t.colors.danger
        }
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>{tr('offlineBanner')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '100%',
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 0,
        zIndex: 9999
      }
    })
  },
  text: {
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
    color: '#ffffff'
  }
});
