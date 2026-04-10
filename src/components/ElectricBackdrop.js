import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

/**
 * Animated electrical / energy backdrop behind screen content.
 * Respects OS "reduce motion" — falls back to static gradients.
 */
export default function ElectricBackdrop({ isDark }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(reduceMotion ? 0.55 : 0.35);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 0.55;
      sweep.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(0.72, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    sweep.value = withRepeat(
      withTiming(1, { duration: 14000, easing: Easing.linear }),
      -1,
      false
    );
  }, [pulse, sweep, reduceMotion]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: pulse.value
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (sweep.value - 0.5) * 80 },
      { translateY: (sweep.value - 0.5) * -40 }
    ]
  }));

  if (!isDark) {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={['#f0f9ff', '#e0f2fe', '#f8fafc', '#ecfeff']}
          locations={[0, 0.35, 0.7, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <AnimatedLinearGradient
          colors={['transparent', 'rgba(6,182,212,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, glowStyle]}
        />
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#020617', '#0c1222', '#0f172a', '#020617']}
        locations={[0, 0.3, 0.65, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <AnimatedLinearGradient
        colors={['transparent', 'rgba(34,211,238,0.14)', 'rgba(6,182,212,0.06)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, glowStyle]}
      />
      {!reduceMotion && (
        <Animated.View style={[styles.sweepWrap, sweepStyle]} pointerEvents="none">
          <LinearGradient
            colors={['transparent', 'rgba(34,211,238,0.07)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.sweepBand}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sweepWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  sweepBand: {
    width: '140%',
    height: '100%',
    opacity: 0.9
  }
});
