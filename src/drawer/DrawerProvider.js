import React, { useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Image, Modal, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import { navigationRef } from '../navigation/navigationRef';
import { appScreenConfig } from '../navigation/routeConfig';
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

const DrawerContent = ({ onItemPress }) => {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const t = useThemeTokens();

  const safeUnreadCount = typeof unreadCount === 'number' && !isNaN(unreadCount) ? unreadCount : 0;
  const role = user?.role || 'user';
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

  const handleItemPress = (item) => {
    if (navigationRef.current) {
      navigationRef.current.navigate(item.target);
    }
    onItemPress();
  };

  return (
    <View style={[styles.drawerContent, { backgroundColor: t.colors.card }]}>
      <View style={[styles.drawerHeader, { borderColor: t.colors.border }]}>
        <Image source={require('../../assets/logo.png')} style={styles.drawerLogo} resizeMode="contain" />
        <Text style={[styles.drawerTitle, { color: t.colors.text }]}>Menu</Text>
      </View>

      {finalDrawerItems.map((item) => (
        <Pressable
          key={item.label}
          style={[styles.drawerItem, { borderBottomColor: t.colors.border }]}
          onPress={() => handleItemPress(item)}
        >
          <Ionicons name={item.icon} size={24} color={t.colors.text} style={styles.drawerItemIcon} />
          <Text style={[styles.drawerItemLabel, { color: t.colors.text }]}>{item.label}</Text>
          {item.badge > 0 && (
            <View style={[styles.drawerBadge, { backgroundColor: t.colors.primary }]}>
              <Text style={[styles.drawerBadgeText, { color: '#fff' }]}>
                {item.badge > 99 ? '99+' : item.badge}
              </Text>
            </View>
          )}
        </Pressable>
      ))}
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
            <DrawerContent onItemPress={closeDrawer} />
          </AnimatedView>
        </Pressable>
      </Modal>
    </DrawerContext.Provider>
  );
};

