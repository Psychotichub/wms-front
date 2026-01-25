import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { useThemeTokens } from '../../theme/ThemeProvider';

const Header = ({ title, subtitle, right }) => {
  const t = useThemeTokens();
  return (
    <View style={[styles.container, { borderColor: t.colors.border }]}>
      <View>
        <Text style={[styles.title, { color: t.colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: t.colors.textSecondary }]}>{subtitle}</Text> : null}
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
    borderBottomWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10
      },
      android: { elevation: 2 },
      default: { boxShadow: '0px 4px 10px rgba(0,0,0,0.08)' }
    })
  },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 2 }
});

export default Header;

