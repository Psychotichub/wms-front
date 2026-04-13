// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigationState } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme, useThemeTokens } from '../theme/ThemeProvider';
import { useDrawer } from '../drawer/DrawerProvider';
import { useI18n } from '../i18n/I18nProvider';
import { isRouteStarred, isSkippableStarRoute, toggleStarredRoute } from '../utils/starredRoutes';
import styles from './styles';
import { appScreenConfig, MAIN_TAB_ROUTE_NAMES } from './routeConfig';
import MainTabNavigator from './MainTabNavigator';
import { selectActiveRouteName } from './selectActiveRouteName';

const Stack = createNativeStackNavigator();

function AppHeaderRight({ navigation, user, tr, t, isDark, toggleMode, safeUnreadCount }) {
  const routeName = useNavigationState((state) => selectActiveRouteName(state));
  const [starred, setStarred] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user || !routeName || isSkippableStarRoute(routeName)) {
      setStarred(false);
      return undefined;
    }
    isRouteStarred(routeName).then((s) => {
      if (!cancelled) setStarred(s);
    });
    return () => {
      cancelled = true;
    };
  }, [user, routeName]);

  const showStar = Boolean(user && routeName && !isSkippableStarRoute(routeName));

  const onToggleStar = async () => {
    if (!routeName) return;
    const { starred: next } = await toggleStarredRoute(routeName);
    setStarred(next);
  };

  return (
    <View style={styles.headerRightActions}>
      {Platform.OS === 'web' && (
        <Pressable
          style={styles.themeBtn}
          onPress={toggleMode}
          accessibilityRole="button"
          accessibilityLabel={isDark ? tr('nav.themeToLight') : tr('nav.themeToDark')}
        >
          <Ionicons
            name={isDark ? 'moon-outline' : 'sunny-outline'}
            size={16}
            color={t.colors.primary}
          />
        </Pressable>
      )}
      {showStar ? (
        <Pressable
          style={styles.notifBtn}
          onPress={onToggleStar}
          accessibilityRole="button"
          accessibilityLabel={starred ? tr('nav.starRemoveA11y') : tr('nav.starAddA11y')}
        >
          <Ionicons
            name={starred ? 'star' : 'star-outline'}
            size={Platform.OS === 'web' ? 18 : 20}
            color={starred ? t.colors.warning || t.colors.primary : t.colors.text}
          />
        </Pressable>
      ) : null}
      {user ? (
        <Pressable
          style={styles.notifBtn}
          onPress={() => navigation.navigate('Notifications')}
          accessibilityRole="button"
          accessibilityLabel={
            safeUnreadCount > 0 ? tr('nav.notificationsUnread', { count: safeUnreadCount }) : tr('nav.notifications')
          }
        >
          <Ionicons
            name="notifications-outline"
            size={Platform.OS === 'web' ? 18 : 20}
            color={t.colors.text}
          />
          {safeUnreadCount > 0 ? (
            <View style={[styles.notifBadge, { backgroundColor: t.colors.primary }]}>
              <Text style={[styles.notifBadgeText, { color: t.colors.onPrimary }]}>
                {safeUnreadCount > 99 ? '99+' : safeUnreadCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      {!user ? (
        <Pressable
          style={[styles.cta, { backgroundColor: t.colors.primary }]}
          onPress={() => navigation.navigate('Login')}
          accessibilityRole="button"
          accessibilityLabel={tr('nav.login')}
        >
          <Ionicons name="log-in-outline" size={16} color={t.colors.onPrimary} />
          {Platform.OS !== 'web' && (
            <Text style={[styles.ctaText, { color: t.colors.onPrimary }]}>{tr('nav.login')}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const AppStack = () => {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { setThemePreference } = useTheme();
  const { toggleDrawer } = useDrawer();
  const t = useThemeTokens();
  const { t: tr } = useI18n();
  const role = user?.role || 'user';
  const isDark = t.mode === 'dark';

  const toggleMode = () => setThemePreference(isDark ? 'light' : 'dark');
  const safeUnreadCount = typeof unreadCount === 'number' && !isNaN(unreadCount) ? unreadCount : 0;

  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={({ navigation }) => ({
        contentStyle: { backgroundColor: 'transparent' },
        headerShown: true,
        headerStyle: { 
          backgroundColor: isDark ? t.colors.surface : t.colors.card, 
          borderBottomColor: t.colors.border,
          borderBottomWidth: 1,
          ...Platform.select({
            web: {
              height: 48,
              minHeight: 48,
              maxHeight: 48
            }
          })
        },
        headerTintColor: t.colors.primary,
        headerTitleStyle: { fontWeight: '700', color: t.colors.text },
        ...Platform.select({
          web: {
            headerTitleAlign: 'center',
            headerLeftContainerStyle: {
              minWidth: 72,
              maxWidth: 120,
              paddingLeft: 4,
              flexDirection: 'row',
              alignItems: 'center'
            },
            headerRightContainerStyle: { minWidth: 80, maxWidth: 150, paddingRight: 4 }
          }
        }),
        headerLeft: () => {
          const showBack = navigation.canGoBack();
          return (
            <View style={styles.headerLeftRow}>
              {showBack ? (
                <Pressable
                  style={styles.menuBtn}
                  onPress={() => navigation.goBack()}
                  accessibilityRole="button"
                  accessibilityLabel={tr('nav.goBack')}
                >
                  <Ionicons
                    name="chevron-back"
                    size={Platform.OS === 'web' ? 22 : 24}
                    color={t.colors.primary}
                  />
                </Pressable>
              ) : null}
              <Pressable
                style={styles.menuBtn}
                onPress={toggleDrawer}
                accessibilityRole="button"
                accessibilityLabel={tr('nav.openMenu')}
              >
                <Ionicons name="menu-outline" size={Platform.OS === 'web' ? 18 : 20} color={t.colors.primary} />
              </Pressable>
            </View>
          );
        },
        headerTitle: () => (
          <View style={styles.headerTitleContainer}>
            {Platform.OS !== 'web' && (
              <Pressable
                style={styles.themeBtn}
                onPress={toggleMode}
                accessibilityRole="button"
                accessibilityLabel={isDark ? tr('nav.themeToLight') : tr('nav.themeToDark')}
              >
                <Ionicons
                  name={isDark ? 'moon-outline' : 'sunny-outline'}
                  size={16}
                  color={t.colors.primary}
                />
                <Text style={[styles.ctaText, { color: t.colors.primary }]}>
                  {isDark ? tr('nav.themeDarkLabel') : tr('nav.themeLightLabel')}
                </Text>
              </Pressable>
            )}
            <Image
              source={require('../../assets/logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
          </View>
        ),
        headerRight: () => (
          <AppHeaderRight
            navigation={navigation}
            user={user}
            tr={tr}
            t={t}
            isDark={isDark}
            toggleMode={toggleMode}
            safeUnreadCount={safeUnreadCount}
          />
        )
      })}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabNavigator}
        options={{ title: tr('nav.stackHome') }}
      />
      {appScreenConfig
        .filter((screen) => !screen.roles || screen.roles.includes(role))
        .filter((screen) => !MAIN_TAB_ROUTE_NAMES.includes(screen.name))
        .map((screen) => (
          <Stack.Screen
            key={screen.name}
            name={screen.name}
            getComponent={screen.getComponent}
          />
        ))}
    </Stack.Navigator>
  );
};

export default AppStack;
