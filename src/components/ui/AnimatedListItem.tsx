// @ts-nocheck
import React from 'react';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

const MAX_ANIMATED = 15;

const AnimatedListItem = ({ index, children, style }) => {
  if (index >= MAX_ANIMATED) {
    return <Animated.View style={style}>{children}</Animated.View>;
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(300).springify().damping(18)}
      exiting={FadeOut.duration(200)}
      style={style}
    >
      {children}
    </Animated.View>
  );
};

export default AnimatedListItem;
