import React from 'react';
import { Animated, Platform } from 'react-native';

/**
 * Wrapper for Animated.View that filters out web-incompatible props
 * Fixes the "collapsable" warning on web by ensuring the prop is only passed on native platforms
 */
const AnimatedView = React.forwardRef((props, ref) => {
  // Filter out collapsable prop on web to prevent DOM warnings
  // React Native Web doesn't support this prop and will warn if it receives a boolean
  const { collapsable, ...restProps } = props;
  
  // Only include collapsable on native platforms
  const finalProps = Platform.OS === 'web' 
    ? restProps 
    : { ...restProps, ...(collapsable !== undefined && { collapsable }) };
  
  return <Animated.View ref={ref} {...finalProps} />;
});

AnimatedView.displayName = 'AnimatedView';

export default AnimatedView;
