// @ts-nocheck
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useThemeTokens } from '../theme/ThemeProvider';

type Props = { text: string };

export default function BreadcrumbBar({ text }: Props) {
  const t = useThemeTokens();
  if (Platform.OS !== 'web' || !text) return null;
  return (
    <View
      style={[styles.wrap, { backgroundColor: t.colors.surface, borderBottomColor: t.colors.border }]}
      accessibilityRole="summary"
    >
      <Text style={[styles.text, { color: t.colors.textSecondary }]} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    zIndex: 5
  },
  text: {
    fontSize: 12,
    fontWeight: '600'
  }
});
