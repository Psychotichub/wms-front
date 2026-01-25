import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  Platform,
  Keyboard,
  ScrollView,
} from 'react-native';
import { useThemeTokens } from '../../theme/ThemeProvider';

/**
 * Reusable Autocomplete Input Component with Keyboard Support
 */
const AutocompleteInput = ({
  data = [],
  value = '',
  onChange,
  onSelect,
  onBlur,
  placeholder = 'Type to search...',
  containerStyle,
  inputStyle,
}) => {
  const t = useThemeTokens();
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const blurTimer = useRef(null);
  const selecting = useRef(false);

  // Helper to convert hex to RGBA for web compatibility
  const getRGBA = (hex, alpha) => {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex;
    let fullHex = hex;
    if (hex.length === 4) {
      fullHex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    const r = parseInt(fullHex.slice(1, 3), 16);
    const g = parseInt(fullHex.slice(3, 5), 16);
    const b = parseInt(fullHex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Normalize data to [{ label, value }] and sort alphabetically
  const normalizedData = useMemo(() => {
    const normalized = data.map((item) => {
      if (typeof item === 'string') {
        return { label: item, value: item };
      }
      return item;
    });

    // Sort alphabetically by label
    return normalized.sort((a, b) => {
      const labelA = (a.label || '').toLowerCase();
      const labelB = (b.label || '').toLowerCase();
      return labelA.localeCompare(labelB);
    });
  }, [data]);

  // Filter logic: matches start or contains string (case insensitive)
  const filteredData = useMemo(() => {
    if (!showDropdown) return [];
    if (!value) return normalizedData; // Show all if focused but empty
    const needle = value.toLowerCase();
    return normalizedData.filter((item) =>
      (item.label || '').toLowerCase().includes(needle)
    );
  }, [normalizedData, value, showDropdown]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [filteredData.length]);

  const handleSelect = (item) => {
    selecting.current = true;
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    onSelect(item);
    setShowDropdown(false);
    setSelectedIndex(-1);
    Keyboard.dismiss();
    setTimeout(() => {
      selecting.current = false;
    }, 300);
  };

  const handleBlur = () => {
    // If we're already selecting, don't trigger the blur-close timer
    if (selecting.current) return;

    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => {
      // Re-check selecting because a touch might have started during the timeout
      if (selecting.current) return;
      setShowDropdown(false);
      if (onBlur) onBlur(value);
      blurTimer.current = null;
    }, 400);
  };

  const onKeyPress = ({ nativeEvent }) => {
    if (filteredData.length === 0) return;

    if (nativeEvent.key === 'ArrowDown') {
      const nextIndex = (selectedIndex + 1) % filteredData.length;
      setSelectedIndex(nextIndex);
    } else if (nativeEvent.key === 'ArrowUp') {
      const nextIndex = selectedIndex <= 0 ? filteredData.length - 1 : selectedIndex - 1;
      setSelectedIndex(nextIndex);
    } else if (nativeEvent.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < filteredData.length) {
        handleSelect(filteredData[selectedIndex]);
      }
    }
  };

  const shadow = Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
    },
    android: { elevation: 20 },
    default: { boxShadow: '0px 10px 20px rgba(0,0,0,0.2)' },
  });

  const dropdownBg = t.mode === 'dark' ? t.colors.card : '#f0f9ff'; // Light blue tint
  const activeItemBg = t.mode === 'dark' ? getRGBA(t.colors.primary, 0.25) : '#bae6fd'; // Web-safe alpha

  return (
    <View style={[styles.container, containerStyle, showDropdown ? { zIndex: 30000, elevation: 100 } : { zIndex: 1 }]}>
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          {
            borderColor: t.colors.border,
            backgroundColor: t.colors.card,
            color: t.colors.text,
          },
          inputStyle,
        ]}
        placeholder={placeholder}
        placeholderTextColor={t.colors.textSecondary}
        value={value}
        onChangeText={(text) => {
          onChange(text);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
        onBlur={handleBlur}
        onKeyPress={onKeyPress}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {showDropdown && (
        <>
          {/* Invisible overlay to detect outside clicks */}
          <Pressable
            style={styles.overlay}
            onPress={() => {
              setShowDropdown(false);
              if (onBlur) onBlur(value);
            }}
          />

          {filteredData.length > 0 && (
            <View
              style={[
                styles.dropdown,
                shadow,
                {
                  backgroundColor: dropdownBg,
                  borderColor: t.colors.primary,
                  elevation: 110, // Ensure dropdown is above the container
                },
              ]}
            >
              <ScrollView
                keyboardShouldPersistTaps="always"
                style={styles.list}
                nestedScrollEnabled={true}
                onScrollBeginDrag={(event) => {
                  selecting.current = true;
                  event.stopPropagation();
                }}
                onTouchStart={(event) => {
                  selecting.current = true;
                  event.stopPropagation();
                }}
                onPointerDown={(event) => {
                  selecting.current = true;
                  event.stopPropagation();
                }}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
              >
                {filteredData.map((item, index) => (
                  <Pressable
                    key={`${item.value}-${index}`}
                    style={({ pressed }) => [
                      styles.item,
                      { borderBottomColor: t.colors.border },
                      (pressed || selectedIndex === index) ? { backgroundColor: activeItemBg } : null,
                    ]}
                    onPressIn={() => {
                      selecting.current = true;
                    }}
                    onPointerDown={() => {
                      selecting.current = true;
                    }}
                    onPress={() => handleSelect(item)}
                  >
                    <Text
                      style={[
                        styles.itemText,
                        { color: t.colors.text },
                        selectedIndex === index ? { color: t.colors.primary, fontWeight: '700' } : null
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 20000,
    position: 'relative',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  dropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    maxHeight: 200,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 10001, // Higher than overlay
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  list: {
    flexGrow: 0,
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 15,
  },
});

export default AutocompleteInput;
