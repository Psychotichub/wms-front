// @ts-nocheck
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import ElectricBackdrop from './ElectricBackdrop';

/**
 * Renders the electric / lightning backdrop once for the whole app (auth + main stacks).
 * Must sit inside ThemeProvider.
 */
export default function GlobalAppBackground({ children }) {
  const { resolvedMode } = useTheme();
  const isDark = resolvedMode === 'dark';

  return (
    <View style={styles.root}>
      <ElectricBackdrop isDark={isDark} />
      <View style={styles.foreground} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  foreground: { flex: 1 }
});
