import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeTokens } from '../../theme/ThemeProvider';

const VARIANT_MAP = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  neutral: 'muted',
};

const StatusBadge = ({ label, variant = 'neutral', style }) => {
  const t = useThemeTokens();
  const colorKey = VARIANT_MAP[variant] || 'muted';
  const color = t.colors[colorKey] || t.colors.muted;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: color + '18',
          borderColor: color + '40',
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default StatusBadge;
