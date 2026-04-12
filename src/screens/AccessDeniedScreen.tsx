import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';

const AccessDeniedScreen = ({ navigation }: { navigation: { navigate: (name: string) => void } }) => {
  const t = useThemeTokens();
  const { t: tr } = useI18n();
  return (
    <Screen>
      <View style={styles.container}>
        <Text style={[styles.title, { color: t.colors.text }]}>{tr('accessDenied.title')}</Text>
        <Text style={[styles.subtitle, { color: t.colors.textSecondary }]}>{tr('accessDenied.subtitle')}</Text>
        <Pressable
          style={[styles.button, { backgroundColor: t.colors.primary }]}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Text style={styles.buttonText}>{tr('accessDenied.backDashboard')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  button: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: '#0b1220', fontWeight: '700' }
});

export default AccessDeniedScreen;
