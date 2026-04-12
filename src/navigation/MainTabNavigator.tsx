// @ts-nocheck
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import DashboardScreen from '../screens/DashboardScreen';
import DailyReportScreen from '../screens/DailyReportScreen';
import MyTasksScreen from '../screens/MyTasksScreen';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const theme = useThemeTokens();
  const { t: tr } = useI18n();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border
        },
        tabBarHideOnKeyboard: true
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: tr('tabs.dashboard'),
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />
        }}
      />
      <Tab.Screen
        name="Daily Report"
        component={DailyReportScreen}
        options={{
          tabBarLabel: tr('tabs.dailyReport'),
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />
        }}
      />
      <Tab.Screen
        name="My Tasks"
        component={MyTasksScreen}
        options={{
          tabBarLabel: tr('tabs.myTasks'),
          tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-done-outline" size={size} color={color} />
        }}
      />
    </Tab.Navigator>
  );
}
