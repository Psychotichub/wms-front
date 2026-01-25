import React, { useCallback, useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, Image, ScrollView, Platform, Animated } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import Button from '../components/ui/Button';
import { getAdminSignupCode } from '../config/runtime';

const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  company: z.string().trim().min(1, 'Company is required'),
  adminCode: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const buildZodResolver = (schema) => async (values) => {
  const result = schema.safeParse(values);
  if (result.success) {
    return { values: result.data, errors: {} };
  }

  const fieldErrors = result.error.flatten().fieldErrors;
  const errors = Object.entries(fieldErrors).reduce((acc, [key, messages]) => {
    const message = Array.isArray(messages) ? messages[0] : undefined;
    if (message) {
      acc[key] = { type: 'validation', message };
    }
    return acc;
  }, {});

  return { values: {}, errors };
};

// Native driver is only supported on iOS and Android, not on web
// Explicitly set to false on web to prevent warnings
const USE_NATIVE_DRIVER = Platform.OS === 'ios' || Platform.OS === 'android';

const FeatureItem = ({ icon, text, colors }) => (
  <View style={styles.featureItem}>
    <Ionicons name={icon} size={16} color={colors.primary} />
    <Text style={[styles.featureText, { color: colors.textSecondary }]}>{text}</Text>
  </View>
);

const PasswordStrengthMeter = ({ password, colors }) => {
  const getStrength = () => {
    if (!password || password.length === 0) return 0;
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;
    return Math.min(strength, 4);
  };

  const strength = getStrength();
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['', colors.danger, '#f59e0b', '#3b82f6', colors.success];

  if (!password || password.length === 0) return null;

  return (
    <View style={styles.passwordStrengthContainer}>
      <View style={styles.passwordStrengthBars}>
        {[1, 2, 3, 4].map((level) => (
          <View
            key={level}
            style={[
              styles.passwordStrengthBar,
              {
                backgroundColor: level <= strength ? strengthColors[strength] : colors.border,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.passwordStrengthText, { color: strengthColors[strength] }]}>
        {strengthLabels[strength]}
      </Text>
    </View>
  );
};

const SignupScreen = ({ navigation }) => {
  const { signup, isLoading, error } = useAuth();
  const t = useThemeTokens();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [focusedInput, setFocusedInput] = useState(null);
  
  // Animation values
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslateY = useRef(new Animated.Value(20)).current;
  const backgroundOpacity = useRef(new Animated.Value(0)).current;
  const loadingRotation = useRef(new Animated.Value(0)).current;

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm({
    defaultValues: { name: '', email: '', company: '', adminCode: '', password: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    resolver: buildZodResolver(signupSchema),
  });

  // Logo animation on mount
  useEffect(() => {
    // Logo fade-in and scale-up
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        useNativeDriver: USE_NATIVE_DRIVER,
        tension: 50,
        friction: 7,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(formOpacity, {
        toValue: 1,
        duration: 800,
        delay: 300,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(formTranslateY, {
        toValue: 0,
        duration: 800,
        delay: 300,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(backgroundOpacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();

    // Logo pulse animation (continuous)
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(logoPulse, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    ).start();
  }, [logoScale, logoOpacity, logoPulse, formOpacity, formTranslateY, backgroundOpacity]);

  // Loading spinner animation
  useEffect(() => {
    if (isLoading) {
      const rotateAnimation = Animated.loop(
        Animated.timing(loadingRotation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: USE_NATIVE_DRIVER,
        })
      );
      rotateAnimation.start();
      return () => rotateAnimation.stop();
    } else {
      loadingRotation.setValue(0);
    }
  }, [isLoading, loadingRotation]);

  const onSubmit = useCallback(async (values) => {
    const code = values.adminCode?.trim() || getAdminSignupCode() || undefined;
    const ok = await signup(values.name, values.email, values.password, values.company, code);
    if (ok) {
      navigation.navigate('Login');
    }
  }, [navigation, signup]);

  return (
    <Screen>
      {/* Animated Background Gradient */}
      <Animated.View 
        style={[
          styles.animatedBackground,
          {
            opacity: backgroundOpacity,
            backgroundColor: t.colors.background,
          }
        ]}
      />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo Section with Animation */}
        <Animated.View 
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [
                { scale: Animated.multiply(logoScale, logoPulse) }
              ],
            }
          ]}
        >
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Title & Subtitle */}
        <View style={styles.headerSection}>
          <Text style={[styles.title, { color: t.colors.text }]}>Create your WMS account</Text>
          <Text style={[styles.subtitle, { color: t.colors.textSecondary }]}>
            Join thousands of teams managing their work efficiently
          </Text>
        </View>

        {/* Feature Highlights */}
        <View style={styles.featuresContainer}>
          <FeatureItem icon="location-outline" text="Real-time Tracking" colors={t.colors} />
          <FeatureItem icon="people-outline" text="Team Collaboration" colors={t.colors} />
          <FeatureItem icon="stats-chart-outline" text="Analytics Dashboard" colors={t.colors} />
          <FeatureItem icon="phone-portrait-outline" text="Mobile-First" colors={t.colors} />
        </View>

        {/* Trust Indicator */}
        <View style={styles.trustIndicator}>
          <Ionicons name="shield-checkmark" size={16} color={t.colors.success} />
          <Text style={[styles.trustText, { color: t.colors.textSecondary }]}>Secure signup</Text>
        </View>

        {/* Signup Form Card with Animation */}
        <Animated.View 
          style={[
            styles.signupCard, 
            { 
              backgroundColor: t.colors.card, 
              borderColor: t.colors.border,
              opacity: formOpacity,
              transform: [{ translateY: formTranslateY }],
            }
          ]}
        >
          <View style={styles.formContainer}>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <View>
                <View style={[
                  styles.inputContainer,
                  { 
                    borderColor: errors.name ? t.colors.danger : (focusedInput === 'name' ? t.colors.primary : t.colors.border), 
                    backgroundColor: t.colors.card,
                    borderWidth: focusedInput === 'name' ? 2 : 1,
                  }
                ]}>
                  <Ionicons name="person-outline" size={20} color={focusedInput === 'name' ? t.colors.primary : t.colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[
                      styles.input,
                      { color: t.colors.text, backgroundColor: t.colors.card }
                    ]}
                    placeholder="Name"
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setFocusedInput('name')}
                    onBlur={(e) => {
                      onBlur(e);
                      setFocusedInput(null);
                    }}
                    placeholderTextColor={t.colors.textSecondary}
                    textContentType="name"
                    autoComplete="name"
                    importantForAutofill="yes"
                  />
                </View>
                {errors.name ? <Text style={[styles.error, { color: t.colors.danger }]}>{errors.name.message}</Text> : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <View>
                <View style={[
                  styles.inputContainer,
                  { 
                    borderColor: errors.email ? t.colors.danger : (focusedInput === 'email' ? t.colors.primary : t.colors.border), 
                    backgroundColor: t.colors.card,
                    borderWidth: focusedInput === 'email' ? 2 : 1,
                  }
                ]}>
                  <Ionicons name="mail-outline" size={20} color={focusedInput === 'email' ? t.colors.primary : t.colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[
                      styles.input,
                      { color: t.colors.text, backgroundColor: t.colors.card }
                    ]}
                    placeholder="Email"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setFocusedInput('email')}
                    onBlur={(e) => {
                      onBlur(e);
                      setFocusedInput(null);
                    }}
                    placeholderTextColor={t.colors.textSecondary}
                    textContentType="emailAddress"
                    autoComplete="email"
                    importantForAutofill="yes"
                  />
                </View>
                {errors.email ? <Text style={[styles.error, { color: t.colors.danger }]}>{errors.email.message}</Text> : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="company"
            render={({ field: { onChange, onBlur, value } }) => (
              <View>
                <View style={[
                  styles.inputContainer,
                  { 
                    borderColor: errors.company ? t.colors.danger : (focusedInput === 'company' ? t.colors.primary : t.colors.border), 
                    backgroundColor: t.colors.card,
                    borderWidth: focusedInput === 'company' ? 2 : 1,
                  }
                ]}>
                  <Ionicons name="business-outline" size={20} color={focusedInput === 'company' ? t.colors.primary : t.colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[
                      styles.input,
                      { color: t.colors.text, backgroundColor: t.colors.card }
                    ]}
                    placeholder="Company"
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setFocusedInput('company')}
                    onBlur={(e) => {
                      onBlur(e);
                      setFocusedInput(null);
                    }}
                    placeholderTextColor={t.colors.textSecondary}
                    textContentType="organizationName"
                    autoComplete="organization"
                    importantForAutofill="yes"
                  />
                </View>
                {errors.company ? <Text style={[styles.error, { color: t.colors.danger }]}>{errors.company.message}</Text> : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="adminCode"
            render={({ field: { onChange, onBlur, value } }) => (
              <View>
                <View style={[
                  styles.inputContainer,
                  { 
                    borderColor: errors.adminCode ? t.colors.danger : (focusedInput === 'adminCode' ? t.colors.primary : t.colors.border), 
                    backgroundColor: t.colors.card,
                    borderWidth: focusedInput === 'adminCode' ? 2 : 1,
                  }
                ]}>
                  <Ionicons name="key-outline" size={20} color={focusedInput === 'adminCode' ? t.colors.primary : t.colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[
                      styles.input,
                      { color: t.colors.text, backgroundColor: t.colors.card }
                    ]}
                    placeholder="Admin code (optional)"
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setFocusedInput('adminCode')}
                    onBlur={(e) => {
                      onBlur(e);
                      setFocusedInput(null);
                    }}
                    placeholderTextColor={t.colors.textSecondary}
                  />
                </View>
                {errors.adminCode ? <Text style={[styles.error, { color: t.colors.danger }]}>{errors.adminCode.message}</Text> : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <View>
                <View style={[
                  styles.passwordContainer,
                  { 
                    borderColor: errors.password ? t.colors.danger : (focusedInput === 'password' ? t.colors.primary : t.colors.border), 
                    backgroundColor: t.colors.card,
                    borderWidth: focusedInput === 'password' ? 2 : 1,
                  }
                ]}>
                  <Ionicons name="lock-closed-outline" size={20} color={focusedInput === 'password' ? t.colors.primary : t.colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[
                      styles.passwordInput,
                      { 
                        color: t.colors.text, 
                        backgroundColor: t.colors.card,
                      }
                    ]}
                    placeholder="Password"
                    secureTextEntry={!showPassword}
                    value={value}
                    onChangeText={(text) => {
                      onChange(text);
                      setPassword(text);
                    }}
                    onFocus={() => setFocusedInput('password')}
                    onBlur={(e) => {
                      onBlur(e);
                      setFocusedInput(null);
                    }}
                    placeholderTextColor={t.colors.textSecondary}
                    onSubmitEditing={handleSubmit(onSubmit)}
                    textContentType="newPassword"
                    autoComplete="password-new"
                    importantForAutofill="yes"
                  />
                  <Pressable
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons 
                      name={showPassword ? "eye-off-outline" : "eye-outline"} 
                      size={20} 
                      color={t.colors.textSecondary} 
                    />
                  </Pressable>
                </View>
                {errors.password ? <Text style={[styles.error, { color: t.colors.danger }]}>{errors.password.message}</Text> : null}
                <PasswordStrengthMeter password={password} colors={t.colors} />
              </View>
            )}
          />

          {error ? <Text style={[styles.error, { color: t.colors.danger }]}>{error}</Text> : null}

          <View style={styles.buttonContainer}>
            <Button
              title={isLoading ? 'Creating account...' : 'Sign up'}
              onPress={handleSubmit(onSubmit)}
              disabled={isLoading || !isValid}
            />
            {isLoading && (
              <Animated.View
                style={[
                  styles.loadingSpinner,
                  {
                    transform: [
                      {
                        rotate: loadingRotation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Ionicons name="sync" size={20} color={t.colors.primary} />
              </Animated.View>
            )}
          </View>
          </View>
        </Animated.View>

        {/* Help & Support Section */}
        <View style={styles.helpSection}>
          <Pressable
            style={styles.helpLink}
            onPress={() => {/* TODO: Implement help modal or navigation */}}
          >
            <Ionicons name="help-circle-outline" size={18} color={t.colors.primary} />
            <Text style={[styles.helpLinkText, { color: t.colors.primary }]}>Need help?</Text>
          </Pressable>
          <View style={styles.helpDivider}>
            <Text style={[styles.helpDividerText, { color: t.colors.textSecondary }]}>•</Text>
          </View>
          <Pressable
            style={styles.helpLink}
            onPress={() => {/* TODO: Implement FAQ navigation */}}
          >
            <Ionicons name="document-text-outline" size={18} color={t.colors.primary} />
            <Text style={[styles.helpLinkText, { color: t.colors.primary }]}>FAQ</Text>
          </Pressable>
        </View>

        {/* Keyboard Shortcuts Hint */}
        {Platform.OS === 'web' && (
          <View style={styles.keyboardShortcuts}>
            <Text style={[styles.keyboardShortcutsText, { color: t.colors.textSecondary }]}>
              Press <Text style={[styles.keyboardShortcutKey, { color: t.colors.text }]}>Enter</Text> to sign up
            </Text>
          </View>
        )}

        {/* Social Proof */}
        <View style={styles.socialProof}>
          <Text style={[styles.socialProofText, { color: t.colors.textSecondary }]}>
            Trusted by 500+ companies • 10,000+ active users
          </Text>
        </View>

        {/* Login Link */}
        <View style={styles.switchRow}>
          <Text style={{ color: t.colors.textSecondary }}>Already have an account? </Text>
          <Pressable onPress={() => navigation.navigate('Login')}>
            <Text style={[styles.link, { color: t.colors.primary }]}>Login</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  animatedBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  scrollContent: {
    paddingBottom: 40,
    position: 'relative',
    zIndex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 20,
  },
  logo: {
    width: 180,
    height: 120,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: { 
    fontSize: 28, 
    fontWeight: '700', 
    marginBottom: 8, 
    textAlign: 'center' 
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '500',
  },
  trustIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24,
  },
  trustText: {
    fontSize: 12,
    fontWeight: '500',
  },
  signupCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 24,
    paddingVertical: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      default: {
        boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  formContainer: {
    paddingHorizontal: 20,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    padding: 14,
    paddingLeft: 0,
    fontSize: 16,
    borderWidth: 0,
    ...Platform.select({
      web: {
        // Prevent autofill white background on web
        WebkitBoxShadow: '0 0 0 1000px transparent inset',
        boxShadow: '0 0 0 1000px transparent inset',
      },
    }),
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 14,
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    paddingLeft: 0,
    paddingRight: 45,
    fontSize: 16,
    borderWidth: 0,
    ...Platform.select({
      web: {
        // Prevent autofill white background on web
        WebkitBoxShadow: '0 0 0 1000px transparent inset',
        boxShadow: '0 0 0 1000px transparent inset',
      },
    }),
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    top: 14,
    padding: 4,
  },
  error: { 
    marginBottom: 8,
    fontSize: 12,
    marginLeft: 4,
  },
  passwordStrengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
    gap: 8,
  },
  passwordStrengthBars: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  passwordStrengthBar: {
    height: 4,
    flex: 1,
    borderRadius: 2,
  },
  passwordStrengthText: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  buttonContainer: {
    position: 'relative',
    marginTop: 8,
  },
  loadingSpinner: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
  helpSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 20,
    gap: 12,
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  helpLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  helpDivider: {
    paddingVertical: 4,
  },
  helpDividerText: {
    fontSize: 16,
  },
  keyboardShortcuts: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  keyboardShortcutsText: {
    fontSize: 11,
    textAlign: 'center',
  },
  keyboardShortcutKey: {
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  socialProof: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  socialProofText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  switchRow: { 
    flexDirection: 'row', 
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  link: { 
    fontWeight: '600' 
  }
});

export default SignupScreen;
