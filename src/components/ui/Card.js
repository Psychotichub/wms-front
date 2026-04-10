import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { elevation } from '../../theme/elevation';

const Card = ({ children, style }) => {
  const t = useThemeTokens();
  return (
    <View
      style={[
        styles.base,
        elevation.medium,
        { backgroundColor: t.colors.card, borderColor: t.colors.border },
        style
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14
  }
});

export default Card;
