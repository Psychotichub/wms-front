import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme, useThemeTokens } from '../theme/ThemeProvider';
import { useDrawer } from '../drawer/DrawerProvider';
import styles from './styles';
import { appScreenConfig } from './routeConfig';

const Stack = createNativeStackNavigator();

const AppStack = () => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { mode, setMode } = useTheme();
  const { toggleDrawer } = useDrawer();
  const t = useThemeTokens();
  const role = user?.role || 'user';
  const headerBg = mode === 'dark' ? t.colors.background : t.colors.card;

  const toggleMode = () => setMode(mode === 'dark' ? 'light' : 'dark');
  const safeUnreadCount = typeof unreadCount === 'number' && !isNaN(unreadCount) ? unreadCount : 0;

  return (
    <Stack.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: headerBg, borderBottomColor: t.colors.border },
        headerTintColor: t.colors.text,
        headerTitleStyle: { fontWeight: '700', color: t.colors.text },
        headerLeft: () => (
          <Pressable
            style={styles.menuBtn}
            onPress={toggleDrawer}
          >
            <Ionicons name="menu-outline" size={20} color={t.colors.text} />
          </Pressable>
        ),
        headerTitle: () => (
          <View style={styles.headerTitleContainer}>
            <Pressable
              style={styles.themeBtn}
              onPress={toggleMode}
            >
              <Ionicons
                name={mode === 'dark' ? 'moon-outline' : 'sunny-outline'}
                size={16}
                color={t.colors.text}
              />
              <Text style={[styles.ctaText, { color: t.colors.text }]}>{mode === 'dark' ? 'Dark' : 'Light'}</Text>
            </Pressable>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
          </View>
        ),
        headerRight: () => (
          <View style={styles.headerRightActions}>
            {user ? (
              <Pressable
                style={styles.notifBtn}
                onPress={() => navigation.navigate('Notifications')}
              >
                <Ionicons name="notifications-outline" size={20} color={t.colors.text} />
                {safeUnreadCount > 0 ? (
                  <View style={[styles.notifBadge, { backgroundColor: t.colors.primary }]}>
                    <Text style={styles.notifBadgeText}>
                      {safeUnreadCount > 99 ? '99+' : safeUnreadCount}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}

            <Pressable
              style={[styles.cta, { backgroundColor: t.colors.primary }]}
              onPress={() => {
                if (user) logout();
                else navigation.navigate('Login');
              }}
            >
              <Ionicons name={user ? 'log-out-outline' : 'log-in-outline'} size={16} color="#0b1220" />
              <Text style={[styles.ctaText, { color: '#0b1220' }]}>{user ? 'Logout' : 'Login'}</Text>
            </Pressable>
          </View>
        )
      })}
    >
      {appScreenConfig
        .filter((screen) => !screen.roles || screen.roles.includes(role))
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
