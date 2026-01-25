import React from 'react';
import { Pressable, StyleSheet, Text, Platform } from 'react-native';
import { useThemeTokens } from '../../theme/ThemeProvider';

const Button = ({ title, onPress, variant = 'primary', disabled }) => {
  const t = useThemeTokens();
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        isPrimary
          ? { backgroundColor: t.colors.primary, borderColor: t.colors.primary }
          : { backgroundColor: t.colors.card, borderColor: t.colors.border },
        pressed && { opacity: 0.9 },
        disabled && { opacity: 0.5 }
      ]}
    >
      <Text
        style={[
          styles.label,
          isPrimary ? { color: '#f8fafc' } : { color: t.colors.text }
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10
      },
      android: { elevation: 2 },
      default: { boxShadow: '0px 4px 10px rgba(0,0,0,0.10)' }
    })
  },
  label: { fontSize: 15, fontWeight: '700' }
});

export default Button;

