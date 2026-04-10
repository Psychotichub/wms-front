import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useThemeTokens } from '../../theme/ThemeProvider';

const Input = ({
  label,
  error,
  multiline,
  style,
  containerStyle,
  ...rest
}) => {
  const t = useThemeTokens();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? t.colors.danger
    : focused
      ? t.colors.primary
      : t.colors.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: t.colors.text }]}>{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={t.colors.textSecondary}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        multiline={multiline}
        {...rest}
        style={[
          styles.input,
          {
            backgroundColor: t.colors.card,
            borderColor,
            color: t.colors.text,
          },
          multiline && styles.multiline,
          style,
        ]}
      />
      {error ? (
        <Text style={[styles.error, { color: t.colors.danger }]}>{error}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    marginBottom: 6,
    fontWeight: '600',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    minHeight: 48,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
});

export default Input;
