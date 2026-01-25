import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeTokens } from '../theme/ThemeProvider';

const Screen = ({ children }) => {
  const t = useThemeTokens();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.inner, { backgroundColor: t.colors.background }]}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f9fb' },
  scrollContent: { flexGrow: 1, padding: 16 },
  inner: { width: '100%', maxWidth: 960, alignSelf: 'center' }
});

export default Screen;

