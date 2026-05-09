// @ts-nocheck
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';

const LocationAvailableSoonScreen = () => {
  const t = useThemeTokens();
  const { t: tr } = useI18n();

  return (
    <Screen>
      <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
        <Ionicons name="time-outline" size={40} color={t.colors.primary} />
        <Text style={[styles.title, { color: t.colors.text }]}>{tr('locationFeature.soonTitle')}</Text>
        <Text style={[styles.subtitle, { color: t.colors.textSecondary }]}>{tr('locationFeature.soonMessage')}</Text>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    alignItems: 'center',
    gap: 10
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center'
  }
});

export default LocationAvailableSoonScreen;
