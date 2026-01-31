import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useThemeTokens } from '../theme/ThemeProvider';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import EmailVerificationScreen from '../screens/EmailVerificationScreen';

const Stack = createNativeStackNavigator();

const AuthStack = () => {
  const t = useThemeTokens();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: t.colors.background, borderBottomColor: t.colors.border },
        headerTintColor: t.colors.text,
        headerTitleStyle: { fontWeight: '700', color: t.colors.text }
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
      <Stack.Screen 
        name="EmailVerification" 
        component={EmailVerificationScreen} 
        options={{ 
          title: 'Verify Email',
          headerShown: true 
        }} 
      />
    </Stack.Navigator>
  );
};

export default AuthStack;
