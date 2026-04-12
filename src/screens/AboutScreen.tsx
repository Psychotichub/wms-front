import React from 'react';
import { StyleSheet, ScrollView, View, Text } from 'react-native';
import Screen from '../components/Screen';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';

const AboutScreen = () => {
  const t = useThemeTokens();
  const { t: tr } = useI18n();

  // Helper to convert hex to RGBA for web compatibility
  const getRGBA = (hex, alpha) => {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex;
    let fullHex = hex;
    if (hex.length === 4) {
      fullHex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    const r = parseInt(fullHex.slice(1, 3), 16);
    const g = parseInt(fullHex.slice(3, 5), 16);
    const b = parseInt(fullHex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <Screen>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: t.colors.text }]}>{tr('about.title')}</Text>

          <View style={[styles.section, { backgroundColor: getRGBA(t.colors.card, 0.5) }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.primary }]}>{tr('about.whoTitle')}</Text>
            <Text style={[styles.paragraph, { color: t.colors.text }]}>{tr('about.whoBody')}</Text>
          </View>

          <View style={[styles.section, { backgroundColor: getRGBA(t.colors.card, 0.5) }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.primary }]}>{tr('about.missionTitle')}</Text>
            <Text style={[styles.paragraph, { color: t.colors.text }]}>{tr('about.missionBody')}</Text>
          </View>

          <View style={[styles.section, { backgroundColor: getRGBA(t.colors.card, 0.5) }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.primary }]}>{tr('about.helpTitle')}</Text>
            <Text style={[styles.paragraph, { color: t.colors.text }]}>{tr('about.helpBody')}</Text>
          </View>

          <View style={[styles.section, { backgroundColor: getRGBA(t.colors.card, 0.5) }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.primary }]}>{tr('about.commitmentTitle')}</Text>
            <Text style={[styles.paragraph, { color: t.colors.text }]}>{tr('about.commitmentBody')}</Text>
          </View>

          <View style={[styles.section, { backgroundColor: getRGBA(t.colors.card, 0.5) }]}>
            <Text style={[styles.sectionTitle, { color: t.colors.primary }]}>{tr('about.contactTitle')}</Text>
            <Text style={[styles.paragraph, { color: t.colors.text }]}>{tr('about.contactBody')}</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 30,
  },
  section: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'justify',
  },
});

export default AboutScreen;
