// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Image, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { navigationRef } from '../navigation/navigationRef';
import { appScreenConfig, MAIN_TAB_ROUTE_NAMES, ROUTE_BREADCRUMB_LABELS } from '../navigation/routeConfig';
import { loadStarredRoutes } from '../utils/starredRoutes';
import AnimatedView from '../components/AnimatedView';
import styles from './styles';

const DrawerContext = React.createContext();

export const useDrawer = () => {
  const context = React.useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawer must be used within a DrawerProvider');
  }
  return context;
};

const DrawerContent = ({ onItemPress, drawerOpen }) => {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const t = useThemeTokens();
  const { t: tr } = useI18n();
  const [starredNames, setStarredNames] = useState([]);

  const safeUnreadCount = typeof unreadCount === 'number' && !isNaN(unreadCount) ? unreadCount : 0;
  const role = user?.role || 'user';

  useEffect(() => {
    if (!drawerOpen) return;
    loadStarredRoutes().then(setStarredNames);
  }, [drawerOpen]);

  const filteredStarred = useMemo(() => {
    return starredNames.filter((name) => {
      const screen = appScreenConfig.find((s) => s.name === name);
      if (!screen) return false;
      if (screen.roles && !screen.roles.includes(role)) return false;
      return true;
    });
  }, [starredNames, role]);

  const finalDrawerItems = useMemo(() => {
    return appScreenConfig
      .filter((screen) => screen.drawer)
      .filter((screen) => !screen.roles || screen.roles.includes(role))
      .map((screen) => {
        const badge =
          screen.drawer?.badge === 'unreadCount' ? safeUnreadCount : screen.drawer?.badge;
        return {
          label: screen.drawer?.label || screen.name,
          target: screen.name,
          icon: screen.drawer?.icon,
          badge
        };
      });
  }, [role, safeUnreadCount]);

  const navigateToRoute = (target) => {
    if (navigationRef.current) {
      if (MAIN_TAB_ROUTE_NAMES.includes(target)) {
        navigationRef.current.navigate('MainTabs', { screen: target });
      } else {
        navigationRef.current.navigate(target);
      }
    }
    onItemPress();
  };

  const handleItemPress = (item) => {
    navigateToRoute(item.target);
  };

  return (
    <View style={[styles.drawerContent, { backgroundColor: t.colors.surface }]}>
      <View style={[styles.drawerHeader, { borderColor: t.colors.border }]}>
        <Image source={require('../../assets/logo.png')} style={styles.drawerLogo} resizeMode="contain" />
        <Text style={[styles.drawerTitle, { color: t.colors.primary }]}>{tr('nav.menuTitle')}</Text>
      </View>

      <ScrollView 
        style={styles.drawerScrollView}
        contentContainerStyle={styles.drawerScrollContent}
        showsVerticalScrollIndicator={true}
      >
        {filteredStarred.length > 0 ? (
          <>
            <Text style={[styles.drawerSectionTitle, { color: t.colors.textSecondary }]}>
              {tr('nav.starred').toUpperCase()}
            </Text>
            {filteredStarred.map((name) => (
              <Pressable
                key={`starred-${name}`}
                style={[styles.drawerItem, { borderBottomColor: t.colors.border }]}
                onPress={() => navigateToRoute(name)}
                accessibilityRole="button"
                accessibilityLabel={ROUTE_BREADCRUMB_LABELS[name] || name}
              >
                <Ionicons name="star" size={22} color={t.colors.warning} style={styles.drawerItemIcon} />
                <Text style={[styles.drawerItemLabel, { color: t.colors.text }]}>
                  {ROUTE_BREADCRUMB_LABELS[name] || name}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}
        {finalDrawerItems.map((item) => (
          <Pressable
            key={item.label}
            style={[styles.drawerItem, { borderBottomColor: t.colors.border }]}
            onPress={() => handleItemPress(item)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <Ionicons name={item.icon} size={24} color={t.colors.primary} style={styles.drawerItemIcon} />
            <Text style={[styles.drawerItemLabel, { color: t.colors.text }]}>{item.label}</Text>
            {item.badge > 0 && (
              <View style={[styles.drawerBadge, { backgroundColor: t.colors.primary }]}>
                <Text style={[styles.drawerBadgeText, { color: t.colors.onPrimary }]}>
                  {item.badge > 99 ? '99+' : item.badge}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

// Native driver is only supported on iOS and Android, not on web
// Explicitly set to false on web to prevent warnings
const USE_NATIVE_DRIVER = Platform.OS === 'ios' || Platform.OS === 'android';

export const DrawerProvider = ({ children }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-Dimensions.get('window').width * 0.78)).current;

  const openDrawer = () => {
    setIsDrawerOpen(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: USE_NATIVE_DRIVER
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(slideAnim, {
      toValue: -Dimensions.get('window').width * 0.78,
      duration: 300,
      useNativeDriver: USE_NATIVE_DRIVER
    }).start(() => {
      setIsDrawerOpen(false);
    });
  };

  const toggleDrawer = () => {
    if (isDrawerOpen) {
      closeDrawer();
    } else {
      openDrawer();
    }
  };

  return (
    <DrawerContext.Provider value={{ isDrawerOpen, openDrawer, closeDrawer, toggleDrawer }}>
      {children}
      <Modal
        visible={isDrawerOpen}
        transparent
        animationType="none"
        onRequestClose={closeDrawer}
      >
        <Pressable style={styles.overlay} onPress={closeDrawer}>
          <AnimatedView
            style={[
              styles.drawer,
              { transform: [{ translateX: slideAnim }] }
            ]}
          >
            <DrawerContent onItemPress={closeDrawer} drawerOpen={isDrawerOpen} />
          </AnimatedView>
        </Pressable>
      </Modal>
    </DrawerContext.Provider>
  );
};

