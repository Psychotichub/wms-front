import 'react-native-gesture-handler';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AppProviders from './src/providers/AppProviders';
import RootNavigator from './src/navigation/RootNavigator';
import { validateRequiredConfig } from './src/config/runtime';
import { resolveT } from './src/i18n/resolveT';
import { initSentry, captureException } from './src/config/sentry';
import './src/tasks/backgroundLocationTask';

initSentry();

type ErrorBoundaryState = { hasError: boolean; error: Error | null };

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureException(error, { componentStack: errorInfo?.componentStack });
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>{resolveT('app.crashTitle')}</Text>
          <Text style={styles.errorText}>{this.state.error?.message || resolveT('errors.unknown')}</Text>
          <Text style={styles.errorStack}>{this.state.error?.stack}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

let envError: Error | null = null;
try {
  validateRequiredConfig();
} catch (error) {
  envError = error as Error;
  console.error('❌ Configuration Error:', (error as Error).message);
}

export default function App() {
  if (envError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>{resolveT('app.configTitle')}</Text>
        <Text style={styles.errorText}>{envError.message}</Text>
        <Text style={styles.errorHint}>
          {resolveT('errors.configHint')}
          {'\n'}
          {resolveT('app.configRebuildHint')}
        </Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <AppProviders>
        <RootNavigator />
      </AppProviders>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff'
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 10
  },
  errorText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 10
  },
  errorStack: {
    fontSize: 12,
    color: '#666',
    marginTop: 20,
    fontFamily: 'monospace'
  },
  errorHint: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    fontStyle: 'italic'
  }
});
