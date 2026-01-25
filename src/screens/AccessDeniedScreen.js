import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import { useThemeTokens } from '../theme/ThemeProvider';

const AccessDeniedScreen = ({ navigation }) => {
  const t = useThemeTokens();
  return (
    <Screen>
      <View style={styles.container}>
        <Text style={[styles.title, { color: t.colors.text }]}>Access denied</Text>
        <Text style={[styles.subtitle, { color: t.colors.textSecondary }]}>
          You do not have permission to view that page.
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: t.colors.primary }]}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Text style={styles.buttonText}>Back to Dashboard</Text>
        </Pressable>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  button: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: '#0b1220', fontWeight: '700' }
});

export default AccessDeniedScreen;
