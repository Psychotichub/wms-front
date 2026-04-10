import React from 'react';
import { Pressable, StyleSheet, Text, Platform } from 'react-native';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { elevation } from '../../theme/elevation';

const Button = ({
  title,
  onPress,
  variant = 'primary',
  disabled,
  accessibilityLabel,
  testID
}) => {
  const t = useThemeTokens();
  const isPrimary = variant === 'primary';
  const label = accessibilityLabel ?? title;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed, focused }) => [
        styles.base,
        elevation.low,
        isPrimary
          ? { backgroundColor: t.colors.primary, borderColor: t.colors.primary }
          : { backgroundColor: t.colors.card, borderColor: t.colors.border },
        pressed && { opacity: 0.9 },
        disabled && { opacity: 0.5 },
        Platform.OS === 'web' &&
          focused && {
            outlineWidth: 2,
            outlineStyle: 'solid',
            outlineColor: t.colors.focusRing,
            outlineOffset: 2
          }
      ]}
    >
      <Text
        style={[
          t.typography.body,
          { fontWeight: '700' },
          isPrimary ? { color: t.colors.onPrimary } : { color: t.colors.text }
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
    minWidth: 44
  }
});

export default Button;
