import 'react-native-gesture-handler';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AppProviders from './src/providers/AppProviders';
import RootNavigator from './src/navigation/RootNavigator';
import { validateRequiredConfig } from './src/config/runtime';
import { initSentry, captureException } from './src/config/sentry';
// Import background location task to register it
import './src/tasks/backgroundLocationTask';

initSentry();

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    captureException(error, { componentStack: errorInfo?.componentStack });
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{this.state.error?.message || 'Unknown error'}</Text>
          <Text style={styles.errorStack}>{this.state.error?.stack}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

// Validate environment with error handling - fail fast with visible error
let envError = null;
try {
  // We call this here to catch immediate sync errors, 
  // but also inside the component for better React integration
  validateRequiredConfig();
} catch (error) {
  envError = error;
  console.error('❌ Configuration Error:', error.message);
}

export default function App() {
  // Log app initialization
  React.useEffect(() => {
    console.log('🚀 App initialized');
  }, []);

  // Show error if environment validation failed
  if (envError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Configuration Error</Text>
        <Text style={styles.errorText}>{envError.message}</Text>
        <Text style={styles.errorHint}>
          Set EXPO_PUBLIC_API_URL in .env file and rebuild dev client{'\n'}
          Run: npx expo run:android
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
    backgroundColor: '#fff',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorStack: {
    fontSize: 12,
    color: '#666',
    marginTop: 20,
    fontFamily: 'monospace',
  },
  errorHint: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    fontStyle: 'italic',
  },
});
