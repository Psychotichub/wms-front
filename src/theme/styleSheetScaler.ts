// @ts-nocheck
import { StyleSheet } from 'react-native';

const originalCreate = StyleSheet.create;

const scaleStyleValue = (key, value) => {
  if (typeof value !== 'number') return value;

  // 1. Scale font sizes
  if (key === 'fontSize') {
    if (value >= 24) return Math.round(value * 0.83); // 24 -> 20, 26 -> 22
    if (value >= 18) return Math.round(value * 0.85); // 20 -> 17, 18 -> 15
    if (value >= 14) return value - 2; // 16 -> 14, 15 -> 13, 14 -> 12
    if (value > 10) return value - 1.5; // 12 -> 10.5
    return value;
  }

  // 2. Scale paddings
  if (
    key === 'padding' ||
    key === 'paddingVertical' ||
    key === 'paddingHorizontal' ||
    key === 'paddingTop' ||
    key === 'paddingBottom' ||
    key === 'paddingLeft' ||
    key === 'paddingRight'
  ) {
    if (value === 12) return 8;
    if (value === 16) return 12;
    if (value === 20) return 14;
    if (value > 8) return Math.round(value * 0.8);
    return value;
  }

  // 3. Scale height and minHeight for input fields and buttons
  if (key === 'height' || key === 'minHeight') {
    if (value === 48) return 38;
    if (value === 44) return 36;
    if (value === 50) return 40;
    return value;
  }

  // 4. Scale margins slightly to make layouts more compact
  if (
    key === 'margin' ||
    key === 'marginBottom' ||
    key === 'marginTop' ||
    key === 'marginLeft' ||
    key === 'marginRight' ||
    key === 'marginHorizontal' ||
    key === 'marginVertical'
  ) {
    if (value > 12) return Math.round(value * 0.85);
    return value;
  }

  return value;
};

StyleSheet.create = (styles) => {
  if (!styles) return styles;
  const scaledStyles = {};
  for (const styleName in styles) {
    if (Object.prototype.hasOwnProperty.call(styles, styleName)) {
      const style = styles[styleName];
      if (style && typeof style === 'object') {
        const scaledStyle = {};
        for (const key in style) {
          if (Object.prototype.hasOwnProperty.call(style, key)) {
            scaledStyle[key] = scaleStyleValue(key, style[key]);
          }
        }
        scaledStyles[styleName] = scaledStyle;
      } else {
        scaledStyles[styleName] = style;
      }
    }
  }
  return originalCreate(scaledStyles);
};
