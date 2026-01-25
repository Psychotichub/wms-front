import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemeTokens } from '../../theme/ThemeProvider';

const SkeletonBar = ({ width = '100%', height = 12, style }) => {
  const t = useThemeTokens();
  return (
    <View
      style={[
        styles.bar,
        { width, height, backgroundColor: t.colors.border },
        style
      ]}
    />
  );
};

const styles = StyleSheet.create({
  bar: { borderRadius: 6 }
});

export default SkeletonBar;
