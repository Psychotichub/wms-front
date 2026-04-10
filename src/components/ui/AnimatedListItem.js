import React from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

const MAX_ANIMATED = 15;

const AnimatedListItem = ({ index, children, style }) => {
  if (index >= MAX_ANIMATED) {
    return <Animated.View style={style}>{children}</Animated.View>;
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(350).springify()}
      style={style}
    >
      {children}
    </Animated.View>
  );
};

export default AnimatedListItem;
