import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, ScrollView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import Screen from '../components/Screen';
import { useThemeTokens } from '../theme/ThemeProvider';
import Button from '../components/ui/Button';
import { buildUrl, resolveApiUrl } from '../utils/apiUrl';
import { useAuth } from '../context/AuthContext';
import { navigationRef } from '../navigation/navigationRef';

/**
 * EmailVerificationScreen
 * 
 * This screen handles email verification in two ways:
 * 1. When user signs up, they are redirected here to verify their email
 * 2. User can manually navigate here to verify email or resend verification
 * 
 * The screen accepts a 'token' query parameter from the URL (for web) or route params
 * to automatically verify the email when the user clicks the verification link.
 */
const EmailVerificationScreen = () => {
  console.log('📧 EmailVerificationScreen rendered');
  const route = useRoute();
  const navigation = useNavigation();
  const t = useThemeTokens();
  const apiUrl = resolveApiUrl();
  const { setToken, setRefreshToken, setUser } = useAuth();
  
  useEffect(() => {
    console.log('📧 EmailVerificationScreen mounted, params:', route.params);
  }, [route.params]);

  // Get token from route params (native) or URL query (web)
  const [verificationToken, setVerificationToken] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState(route.params?.email || '');
  const [hasAutoVerified, setHasAutoVerified] = useState(false);

  /**
   * Verify email with token or code
   */
  const verifyEmail = useCallback(async (token = null, code = null) => {
    if (!token && !code) return;

    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch(buildUrl(apiUrl, '/api/auth/verify-email'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          ...(token && { token }),
          ...(code && { code })
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Verification failed');
      }

      // Save tokens and user data from response
      if (data.token) {
        setToken(data.token);
      }
      if (data.refreshToken) {
        setRefreshToken(data.refreshToken);
      }
      if (data.user) {
        // Ensure isEmailVerified is explicitly set to true
        const verifiedUser = {
          ...data.user,
          isEmailVerified: true // Explicitly set to true after verification
        };
        setUser(verifiedUser);
      }

      setIsVerified(true);
      setError(null);
      setVerificationCode(''); // Clear code input

      // Show success message for 2 seconds before redirecting to dashboard
      setTimeout(() => {
        if (navigationRef.current?.isReady()) {
          navigationRef.current.reset({
            index: 0,
            routes: [{ name: 'Dashboard' }],
          });
        }
      }, 2000); // 2 seconds to show success message
    } catch (err) {
      setError(err.message || 'Failed to verify email. Please try again.');
      setIsVerified(false);
    } finally {
      setIsVerifying(false);
    }
  }, [apiUrl, setToken, setRefreshToken, setUser]);

  // Extract token from URL on web and auto-verify
  useEffect(() => {
    // Only auto-verify once
    if (hasAutoVerified || isVerified || isVerifying) return;
    
    let token = null;
    if (Platform.OS === 'web') {
      const urlParams = new URLSearchParams(window.location.search);
      token = urlParams.get('token');
    } else if (route.params?.token) {
      // Native: token from route params
      token = route.params.token;
    }
    
    if (token) {
      setVerificationToken(token);
      setHasAutoVerified(true);
      // Auto-verify with token when found in URL
      verifyEmail(token, null);
    }
  }, [route.params, verifyEmail, hasAutoVerified, isVerified, isVerifying]);

  /**
   * Resend verification email
   */
  const handleResendVerification = useCallback(async () => {
    if (!email) {
      Alert.alert('Email Required', 'Please enter your email address to resend verification email.');
      return;
    }

    setIsResending(true);
    setError(null);

    try {
      const response = await fetch(buildUrl(apiUrl, '/api/auth/resend-verification'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to resend verification email');
      }

      Alert.alert(
        'Email Sent',
        'A new verification email has been sent to your email address. Please check your inbox.',
        [{ text: 'OK' }]
      );
    } catch (err) {
      setError(err.message || 'Failed to resend verification email. Please try again.');
      Alert.alert('Error', err.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  }, [email, apiUrl]);

  return (
    <Screen>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={[styles.iconContainer, { backgroundColor: t.colors.primary + '20' }]}>
            <Ionicons 
              name={isVerified ? "checkmark-circle" : "mail-outline"} 
              size={64} 
              color={isVerified ? t.colors.success : t.colors.primary} 
            />
          </View>
          
          <Text style={[styles.title, { color: t.colors.text }]}>
            {isVerified ? 'Email Verified!' : 'Verify Your Email'}
          </Text>
          
          <Text style={[styles.subtitle, { color: t.colors.textSecondary }]}>
            {isVerified 
              ? 'Your email has been successfully verified. Redirecting to dashboard...'
              : 'We\'ve sent a verification email to your inbox. Enter the code below or click the link in your email.'
            }
          </Text>
        </View>

        {/* Success Message */}
        {isVerified && (
          <View style={[styles.errorCard, { backgroundColor: t.colors.success + '20', borderColor: t.colors.success }]}>
            <View style={styles.errorRow}>
              <Ionicons name="checkmark-circle" size={20} color={t.colors.success} />
              <Text style={[styles.errorText, { color: t.colors.success }]}>
                Email verified successfully! Redirecting to dashboard...
              </Text>
            </View>
          </View>
        )}

        {/* Error Message */}
        {error && !isVerified && (
          <View style={[styles.errorCard, { backgroundColor: t.colors.danger + '20', borderColor: t.colors.danger }]}>
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={20} color={t.colors.danger} />
              <Text style={[styles.errorText, { color: t.colors.danger }]}>
                {error}
              </Text>
            </View>
          </View>
        )}

        {/* Verification Code Input Section */}
        {!isVerified && (
          <View style={[styles.codeCard, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.codeTitle, { color: t.colors.text }]}>
              Enter Verification Code
            </Text>
            <Text style={[styles.codeText, { color: t.colors.textSecondary }]}>
              Enter the 6-digit verification code sent to your email:
            </Text>
            
            <View style={[styles.codeInputWrapper, { 
              borderColor: error ? t.colors.danger : (verificationCode.length === 6 ? t.colors.success : t.colors.border),
              backgroundColor: t.colors.card 
            }]}>
              <TextInput
                style={[styles.codeInput, { color: t.colors.text }]}
                placeholder="000000"
                placeholderTextColor={t.colors.textSecondary}
                value={verificationCode}
                onChangeText={(text) => {
                  // Only allow numeric input, max 6 digits
                  const numericText = text.replace(/[^0-9]/g, '').slice(0, 6);
                  setVerificationCode(numericText);
                  setError(null); // Clear error when user types
                }}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
                autoComplete="off"
                editable={!isVerifying}
              />
            </View>

            <View style={styles.buttonContainer}>
              <Button
                title={isVerifying ? 'Verifying...' : 'Verify Email'}
                onPress={() => verifyEmail(null, verificationCode)}
                disabled={isVerifying || verificationCode.length !== 6}
              />
            </View>

            {/* Link Verification Option */}
            {verificationToken && (
              <View style={styles.buttonContainer}>
                <Button
                  title="Verify with Link Instead"
                  onPress={() => verifyEmail(verificationToken, null)}
                  disabled={isVerifying}
                  variant="outline"
                />
              </View>
            )}
          </View>
        )}

        {/* Resend Verification Section */}
        {!isVerified && (
          <View style={[styles.resendCard, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <View style={styles.resendHeader}>
              <Ionicons name="mail-outline" size={20} color={t.colors.textSecondary} />
              <Text style={[styles.resendTitle, { color: t.colors.text }]}>
                Didn't receive the email?
              </Text>
            </View>
            <Text style={[styles.resendText, { color: t.colors.textSecondary }]}>
              Check your spam folder or resend the verification email with a new link and code.
            </Text>
            
            <View style={styles.emailInputContainer}>
              <Text style={[styles.emailLabel, { color: t.colors.text }]}>
                Enter your email address:
              </Text>
              <View style={[styles.inputWrapper, { borderColor: t.colors.border, backgroundColor: t.colors.card }]}>
                <Ionicons name="mail-outline" size={20} color={t.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.emailInput, { color: t.colors.text }]}
                  placeholder="your-email@example.com"
                  placeholderTextColor={t.colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!email || !route.params?.email}
                />
              </View>
            </View>

            <View style={styles.buttonContainer}>
              <Button
                title={isResending ? 'Sending...' : 'Resend Verification Link & Code'}
                onPress={handleResendVerification}
                disabled={isResending || !email}
                variant="outline"
              />
            </View>
          </View>
        )}

        {/* Help Section */}
        <View style={styles.helpSection}>
          <Pressable
            style={styles.helpLink}
            onPress={() => navigation.navigate('Login')}
          >
            <Ionicons name="arrow-back-outline" size={18} color={t.colors.primary} />
            <Text style={[styles.helpLinkText, { color: t.colors.primary }]}>
              Back to Login
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  errorCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  resendCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    marginTop: 16,
  },
  resendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  resendTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  resendText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  emailInputContainer: {
    marginBottom: 16,
  },
  emailLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  inputIcon: {
    marginRight: 8,
  },
  emailInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  codeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  codeTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  codeText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  codeInputWrapper: {
    borderWidth: 2,
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  codeInput: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 8,
    paddingVertical: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  buttonContainer: {
    marginTop: 16,
  },
  helpSection: {
    marginTop: 32,
    alignItems: 'center',
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  helpLinkText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EmailVerificationScreen;
