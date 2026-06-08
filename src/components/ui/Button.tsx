// @ts-nocheck
import React from 'react';
import { Pressable, StyleSheet, Text, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { elevation } from '../../theme/elevation';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const isDark = t.mode === 'dark';

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const handlePressIn = () => {
    if (disabled) return;
    scale.value = withSpring(0.96, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const gradientColors = isDark 
    ? [t.colors.primary, '#0ea5e9'] 
    : [t.colors.primary, '#06b6d4'];

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ focused }) => [
        styles.base,
        elevation.low,
        !isPrimary && { backgroundColor: t.colors.card, borderColor: t.colors.border },
        isPrimary && { borderColor: 'transparent', borderWidth: 0, paddingVertical: 0, paddingHorizontal: 0 },
        disabled && { opacity: 0.5 },
        Platform.OS === 'web' &&
          focused && {
            outlineWidth: 2,
            outlineStyle: 'solid',
            outlineColor: t.colors.focusRing,
            outlineOffset: 2
          },
        animatedStyle
      ]}
    >
      {isPrimary ? (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Text
            style={[
              t.typography.body,
              { fontWeight: '700', color: t.colors.onPrimary }
            ]}
          >
            {title}
          </Text>
        </LinearGradient>
      ) : (
        <Text
          style={[
            t.typography.body,
            { fontWeight: '700', color: t.colors.text }
          ]}
        >
          {title}
        </Text>
      )}
    </AnimatedPressable>
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
    minWidth: 44,
    overflow: 'hidden'
  },
  gradient: {
    width: '100%',
    height: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 42
  }
});

export default Button;
