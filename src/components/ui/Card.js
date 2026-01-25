import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { useThemeTokens } from '../../theme/ThemeProvider';

const Card = ({ children, style }) => {
  const t = useThemeTokens();
  return (
    <View style={[styles.base, { backgroundColor: t.colors.card, borderColor: t.colors.border }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12
      },
      android: { elevation: 3 },
      default: { boxShadow: '0px 8px 16px rgba(0,0,0,0.12)' }
    })
  }
});

export default Card;

