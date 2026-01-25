import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeTokens } from '../../theme/ThemeProvider';

const EmptyState = ({ icon = 'information-circle-outline', title, subtitle }) => {
  const t = useThemeTokens();
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={46} color={t.colors.textSecondary} />
      <Text style={[styles.title, { color: t.colors.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: t.colors.textSecondary }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 6 },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 13, textAlign: 'center' }
});

export default EmptyState;
