import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeTokens } from '../../theme/ThemeProvider';

const EmptyState = ({ icon = 'information-circle-outline', title, subtitle, actionLabel, onAction }) => {
  const t = useThemeTokens();
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={46} color={t.colors.textSecondary} />
      <Text style={[styles.title, t.typography.body, { color: t.colors.text, fontWeight: '700' }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, t.typography.small, { color: t.colors.textSecondary }]}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: t.colors.primary },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={[styles.actionText, { color: t.colors.onPrimary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 6 },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center' },
  action: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  actionText: {
    fontWeight: '600',
    fontSize: 14,
  },
});

export default EmptyState;
