// @ts-nocheck
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeTokens, useTheme } from '../theme/ThemeProvider';
import { useBreakpoint } from '../hooks/useBreakpoint';
import ElectricBackdrop from './ElectricBackdrop';

const Screen = ({ children }) => {
  const t = useThemeTokens();
  const { resolvedMode } = useTheme();
  const { wide, compact } = useBreakpoint();
  const maxWidth = wide ? 1200 : 960;
  const horizontalPad = compact ? 12 : wide ? 28 : 16;
  const isDark = resolvedMode === 'dark';

  return (
    <View style={[styles.root, { backgroundColor: t.colors.background }]}>
      <ElectricBackdrop isDark={isDark} />
      <SafeAreaView
        style={styles.safe}
        edges={['top', 'left', 'right']}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: horizontalPad }]}
          style={styles.scroll}
        >
          <View style={[styles.inner, { maxWidth }]}>{children}</View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1, paddingVertical: 16 },
  inner: { width: '100%', alignSelf: 'center', backgroundColor: 'transparent' }
});

export default Screen;
