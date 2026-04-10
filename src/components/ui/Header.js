import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { elevation } from '../../theme/elevation';

const Header = ({ title, subtitle, right }) => {
  const t = useThemeTokens();
  return (
    <View style={[styles.container, elevation.low, { borderColor: t.colors.border }]}>
      <View>
        <Text style={[t.typography.h2, { color: t.colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[t.typography.body, styles.subtitle, { color: t.colors.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  subtitle: { fontSize: 14, marginTop: 2, fontWeight: '400' }
});

export default Header;
