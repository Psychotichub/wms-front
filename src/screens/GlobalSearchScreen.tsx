// @ts-nocheck
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Screen from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { MAIN_TAB_ROUTE_NAMES } from '../navigation/routeConfig';
import { resetRootToDashboardThenStackScreen } from '../navigation/stackNavigation';

const DEBOUNCE_MS = 350;

export default function GlobalSearchScreen() {
  const navigation = useNavigation();
  const { request } = useAuth();
  const t = useThemeTokens();
  const { t: tr } = useI18n();
  const [q, setQ] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ title: tr('search.title') });
  }, [navigation, tr]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setMessage(q.trim().length === 0 ? '' : tr('search.hint'));
      return undefined;
    }

    const handle = setTimeout(async () => {
      setLoading(true);
      setMessage('');
      try {
        const params = new URLSearchParams({ q: q.trim() });
        const data = await request(`/api/search?${params.toString()}`);
        setResults(Array.isArray(data.results) ? data.results : []);
      } catch (e) {
        setMessage(e.message || 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [q, request, tr]);

  const onSelect = useCallback(
    (item) => {
      const target = item.route;
      const params = item.params || undefined;
      if (MAIN_TAB_ROUTE_NAMES.includes(target)) {
        navigation.navigate('MainTabs', { screen: target, params });
      } else {
        resetRootToDashboardThenStackScreen(navigation, target, params);
      }
    },
    [navigation]
  );

  return (
    <Screen>
      <View style={styles.wrap}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={tr('searchPlaceholder')}
          placeholderTextColor={t.colors.textSecondary}
          style={[
            styles.input,
            {
              borderColor: t.colors.border,
              backgroundColor: t.colors.card,
              color: t.colors.text
            }
          ]}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={tr('search.placeholder')}
        />
        {message ? (
          <Text style={[styles.hint, { color: t.colors.textSecondary }]}>{message}</Text>
        ) : null}
        {loading ? <ActivityIndicator color={t.colors.primary} style={styles.loader} /> : null}
        <FlatList
          data={results}
          keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item)}
              style={({ pressed }) => [
                styles.row,
                { borderColor: t.colors.border, backgroundColor: t.colors.card },
                pressed && { opacity: 0.85 }
              ]}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <Text style={[styles.title, { color: t.colors.text }]}>{item.title}</Text>
              <Text style={[styles.sub, { color: t.colors.textSecondary }]}>{item.subtitle}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            !loading && q.trim().length >= 2 ? (
              <Text style={[styles.empty, { color: t.colors.textSecondary }]}>{tr('search.noResults')}</Text>
            ) : null
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16
  },
  hint: { fontSize: 13, marginBottom: 4 },
  loader: { marginVertical: 8 },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10
  },
  title: { fontSize: 16, fontWeight: '700' },
  sub: { fontSize: 13, marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 24 }
});
