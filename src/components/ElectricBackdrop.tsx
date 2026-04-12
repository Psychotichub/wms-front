// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

const { width: SCREEN_W } = Dimensions.get('window');

/** Tall viewBox — main discharge + side branches (stroke-only, like real stepped leaders). */
const BOLT_VB = '0 0 110 278';
/** Main channel: irregular stepped leader (cloud → ground) */
const BOLT_MAIN_STROKE =
  'M 52 0 L 47 18 L 56 26 L 44 48 L 51 56 L 46 72 L 54 80 L 43 104 L 52 114 L 45 138 L 53 152 L 42 178 L 50 192 L 40 218 L 48 232 L 38 258 L 46 278';
/** Side branches — short discharges off the main channel */
const BOLT_BRANCHES = [
  'M 44 48 L 24 58 L 16 82 L 10 108 L 6 128',
  'M 54 80 L 74 90 L 84 108 L 92 132 L 98 158',
  'M 45 138 L 26 150 L 18 176 L 12 202',
  'M 50 192 L 72 204 L 82 228 L 88 252'
];

const r = (a, b) => a + Math.random() * (b - a);

/**
 * Realistic stroke-based lightning: layered glow + gradient core + branches.
 */
function ThunderBoltGraphic({ isDark, width, height, gradientId }) {
  const core = isDark ? '#f8fafc' : '#ffffff';
  const mid = isDark ? '#bae6fd' : '#e0f2fe';
  const edge = isDark ? '#38bdf8' : '#60a5fa';
  const glowOuter = isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(59, 130, 246, 0.18)';
  const glowMid = isDark ? 'rgba(125, 211, 252, 0.28)' : 'rgba(96, 165, 250, 0.26)';

  const renderMainLayers = (d) => (
    <>
      <Path
        d={d}
        fill="none"
        stroke={glowOuter}
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.34}
      />
      <Path
        d={d}
        fill="none"
        stroke={glowMid}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.52}
      />
      <Path
        d={d}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={2.35}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );

  /** Branches: softer corona + thin hot core (reads as weaker arcs). */
  const renderBranchLayers = (d) => (
    <>
      <Path
        d={d}
        fill="none"
        stroke={glowMid}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.22}
      />
      <Path
        d={d}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.62}
      />
    </>
  );

  return (
    <Svg width={width} height={height} viewBox={BOLT_VB}>
      <Defs>
        <SvgLinearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={core} stopOpacity={1} />
          <Stop offset="32%" stopColor={mid} stopOpacity={1} />
          <Stop offset="100%" stopColor={edge} stopOpacity={0.92} />
        </SvgLinearGradient>
      </Defs>
      {renderMainLayers(BOLT_MAIN_STROKE)}
      {BOLT_BRANCHES.map((d, i) => (
        <React.Fragment key={`br-${i}`}>{renderBranchLayers(d)}</React.Fragment>
      ))}
    </Svg>
  );
}

/** One step in a lightning sequence (opacity 0–1 scale). */
function flashStep(to, ms, easing = Easing.linear) {
  return withTiming(to, { duration: Math.max(8, Math.round(ms)), easing });
}

/**
 * Realistic-style thunder profiles (CG leader/return, intracloud crawl, sheet lightning).
 * Uses short durations + exponential easing where real strikes feel “instant on, slower decay”.
 */
function buildRealisticThunderBurst(isDark) {
  const peak = isDark ? r(0.42, 0.62) : r(0.18, 0.32);
  const pick = Math.random();
  const steps = [];

  // ~30% — Cloud-to-ground style: optional weak stepped leader, main + return stroke, decay flicker
  if (pick < 0.3) {
    if (Math.random() < 0.72) {
      steps.push(
        flashStep(peak * r(0.04, 0.11), r(55, 140), Easing.linear),
        flashStep(r(0.01, 0.035), r(45, 110), Easing.linear),
        flashStep(peak * r(0.06, 0.12), r(35, 90), Easing.linear),
        flashStep(r(0.012, 0.04), r(40, 95), Easing.linear)
      );
    }
    steps.push(
      flashStep(peak * r(0.82, 0.98), r(10, 22), Easing.out(Easing.exp)),
      flashStep(peak * r(0.18, 0.32), r(22, 42), Easing.linear),
      flashStep(peak * r(0.58, 0.82), r(8, 16), Easing.out(Easing.exp)),
      flashStep(peak * r(0.1, 0.22), r(35, 65), Easing.linear),
      flashStep(peak * r(0.28, 0.48), r(14, 28), Easing.out(Easing.quad)),
      flashStep(peak * r(0.04, 0.12), r(45, 85), Easing.linear)
    );
    const afterFlickers = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < afterFlickers; i++) {
      steps.push(
        flashStep(peak * r(0.12, 0.38), r(10, 22), Easing.out(Easing.quad)),
        flashStep(peak * r(0.02, 0.09), r(18, 45), Easing.linear)
      );
    }
    steps.push(flashStep(0, r(320, 620), Easing.in(Easing.exp)));
    return withSequence(...steps);
  }

  // ~28% — Intracloud “crawler”: many fast micro-pulses (channel re-illumination)
  if (pick < 0.58) {
    const pulses = 6 + Math.floor(Math.random() * 7);
    for (let i = 0; i < pulses; i++) {
      steps.push(
        flashStep(peak * r(0.35, 0.72), r(9, 20), Easing.out(Easing.exp)),
        flashStep(peak * r(0.03, 0.14), r(14, 38), Easing.linear)
      );
    }
    steps.push(
      flashStep(peak * r(0.18, 0.32), r(70, 160), Easing.out(Easing.quad)),
      flashStep(0, r(380, 900), Easing.in(Easing.exp))
    );
    return withSequence(...steps);
  }

  // ~22% — Distant anvil / sheet: slow diffuse brighten, long tail (no sharp return)
  if (pick < 0.8) {
    steps.push(
      flashStep(peak * r(0.22, 0.42), r(140, 320), Easing.out(Easing.sin)),
      flashStep(peak * r(0.45, 0.62), r(180, 480), Easing.linear),
      flashStep(peak * r(0.2, 0.38), r(120, 280), Easing.inOut(Easing.sin)),
      flashStep(0, r(550, 1400), Easing.in(Easing.quad))
    );
    return withSequence(...steps);
  }

  // ~20% — “Spider” multi-branch: tight staccato then one brighter pop and fade
  const staccato = 4 + Math.floor(Math.random() * 5);
  for (let i = 0; i < staccato; i++) {
    steps.push(
      flashStep(peak * r(0.45, 0.78), r(7, 14), Easing.out(Easing.exp)),
      flashStep(peak * r(0.02, 0.1), r(10, 24), Easing.linear)
    );
  }
  steps.push(
    flashStep(peak * r(0.75, 0.92), r(12, 24), Easing.out(Easing.exp)),
    flashStep(peak * r(0.15, 0.28), r(50, 110), Easing.linear),
    flashStep(0, r(400, 750), Easing.in(Easing.exp))
  );
  return withSequence(...steps);
}

/**
 * Storm / thunder backdrop: dark moody base, sharp multi-strike flashes, SVG bolts.
 */
export default function ElectricBackdrop({ isDark }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(reduceMotion ? 0.55 : 0.35);
  const sweep = useSharedValue(0);
  const flash = useSharedValue(0);
  const [boltAnchorX, setBoltAnchorX] = useState(() => SCREEN_W * 0.5);
  const [boltScale, setBoltScale] = useState(1);
  const boltGradientIdRef = useRef(`wmsBoltStroke${Math.random().toString(36).slice(2, 11)}`);

  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 0.4;
      sweep.value = 0;
      flash.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(0.52, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    sweep.value = withRepeat(
      withTiming(1, { duration: 14000, easing: Easing.linear }),
      -1,
      false
    );
  }, [pulse, sweep, reduceMotion, flash]);

  useEffect(() => {
    if (reduceMotion) return undefined;

    let cancelled = false;
    let timeoutId;

    const pickBoltPosition = () => {
      const margin = SCREEN_W * 0.12;
      setBoltAnchorX(margin + Math.random() * (SCREEN_W - margin * 2));
      setBoltScale(0.75 + Math.random() * 0.55);
    };

    const thunderBurst = () => {
      flash.value = buildRealisticThunderBurst(isDark);
    };

    const scheduleNext = () => {
      // Variable inter-strike gaps (same cell vs distant rumble)
      const delay = r(1400, 3800) + Math.random() * r(1800, 7200);
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        pickBoltPosition();
        thunderBurst();
        scheduleNext();
      }, delay);
    };

    pickBoltPosition();
    thunderBurst();
    scheduleNext();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      flash.value = 0;
    };
  }, [reduceMotion, isDark, flash]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: pulse.value
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (sweep.value - 0.5) * 80 },
      { translateY: (sweep.value - 0.5) * -40 }
    ]
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value
  }));

  const boltStyle = useAnimatedStyle(() => {
    const o = interpolate(flash.value, [0, 0.15, 0.5, 1], [0, 0.62, 0.78, 0.72], 'clamp');
    return {
      opacity: Math.min(1, o * 0.88)
    };
  });

  const thunderFlashLayer = isDark ? styles.flashDark : styles.flashLight;

  const boltW = 110 * boltScale;
  const boltH = 278 * boltScale;

  const bolts = !reduceMotion && (
    <View
      pointerEvents="none"
      style={[styles.boltWrap, { left: boltAnchorX - boltW / 2, width: boltW }]}
    >
      <Animated.View style={boltStyle}>
        <ThunderBoltGraphic
          isDark={isDark}
          width={boltW}
          height={boltH}
          gradientId={boltGradientIdRef.current}
        />
      </Animated.View>
    </View>
  );

  if (!isDark) {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={['#e8f4fc', '#dbeafe', '#f1f5f9', '#e0f2fe']}
          locations={[0, 0.32, 0.68, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <AnimatedLinearGradient
          colors={['transparent', 'rgba(37,99,235,0.045)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, glowStyle]}
        />
        {!reduceMotion && (
          <Animated.View style={[styles.sweepWrap, sweepStyle]} pointerEvents="none">
            <LinearGradient
              colors={['transparent', 'rgba(59,130,246,0.055)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.sweepBand}
            />
          </Animated.View>
        )}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, thunderFlashLayer, flashStyle]}
        />
        {bolts}
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#010409', '#050a14', '#0a1628', '#020617']}
        locations={[0, 0.28, 0.62, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['transparent', 'rgba(15,23,42,0.85)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <AnimatedLinearGradient
        colors={['transparent', 'rgba(56,189,248,0.065)', 'rgba(34,211,238,0.028)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, glowStyle]}
      />
      {!reduceMotion && (
        <Animated.View style={[styles.sweepWrap, sweepStyle]} pointerEvents="none">
          <LinearGradient
            colors={['transparent', 'rgba(165,243,252,0.045)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.sweepBand}
          />
        </Animated.View>
      )}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, thunderFlashLayer, flashStyle]}
      />
      {bolts}
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
    opacity: 0.58
  },
  flashLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.58)'
  },
  flashDark: {
    backgroundColor: 'rgba(224, 242, 254, 0.34)'
  },
  boltWrap: {
    position: 'absolute',
    top: '4%',
    zIndex: 2,
    alignItems: 'center'
  }
});
