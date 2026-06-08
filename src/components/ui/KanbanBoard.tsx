// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useBreakpoint } from '../../hooks/useBreakpoint';

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

const DraggableCard = ({
  item,
  colIndex,
  columnWidth,
  actualColumnWidth,
  renderItem,
  onDragStart,
  onDragEnd,
  colors
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .activeOffsetY([-15, 15])
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
      isDragging.value = true;
      runOnJS(onDragStart)(item._id);
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    })
    .onEnd((event) => {
      isDragging.value = false;
      
      // Calculate target column based on start offset and visual displacement
      const currentAbsoluteX = (colIndex * columnWidth) + event.translationX + (columnWidth / 2);
      const targetColIndex = Math.floor(currentAbsoluteX / columnWidth);
      
      runOnJS(onDragEnd)(item._id, targetColIndex);

      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: withSpring(isDragging.value ? 1.03 : 1) }
      ],
      zIndex: isDragging.value ? 9999 : 1,
      elevation: isDragging.value ? 12 : 2,
      shadowColor: '#000',
      shadowOpacity: withSpring(isDragging.value ? 0.3 : 0.08),
      shadowRadius: withSpring(isDragging.value ? 10 : 3),
      shadowOffset: { width: 0, height: isDragging.value ? 6 : 1 },
      opacity: isDragging.value ? 0.92 : 1
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[animatedStyle, styles.draggableContainer]}>
        <View style={[styles.dragIndicator, { backgroundColor: getRGBA(colors.textSecondary, 0.1) }]}>
          <Ionicons name="grid" size={12} color={colors.textSecondary} />
        </View>
        <View style={styles.cardContent}>
          {renderItem(item, { isKanban: true, columnWidth: actualColumnWidth })}
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

export const KanbanBoard = ({
  columns,
  items,
  getColId,
  renderItem,
  onItemDrop,
  colors,
  loading,
  tr
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const [activePage, setActivePage] = useState(0);
  const [draggingItemId, setDraggingItemId] = useState(null);

  const isDesktop = windowWidth >= 768;
  const { wide, compact } = useBreakpoint();
  
  // Cap the board at a clean maximum width on desktop to keep columns appropriately sized and prevent right overflow
  const maxBoardWidth = isDesktop ? 1000 : 1200;
  const horizontalPad = compact ? 12 : wide ? 28 : 16;
  const boardWidth = Math.min(windowWidth, maxBoardWidth) - (2 * horizontalPad);

  const columnWidth = isDesktop
    ? (boardWidth - (16 * (columns.length - 1))) / columns.length
    : windowWidth * 0.82;

  const handleDragStart = useCallback((itemId) => {
    setDraggingItemId(itemId);
  }, []);

  const handleDragEnd = useCallback((itemId, targetColIndex) => {
    setDraggingItemId(null);
    if (targetColIndex >= 0 && targetColIndex < columns.length) {
      const targetCol = columns[targetColIndex];
      const draggedItem = items.find(i => i._id === itemId);
      if (draggedItem && getColId(draggedItem) !== targetCol.key) {
        onItemDrop(itemId, targetCol.key);
      }
    }
  }, [columns, items, getColId, onItemDrop]);

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / (columnWidth + 16));
    if (page !== activePage) {
      setActivePage(page);
    }
  };

  const getItemsForColumn = (columnKey) => {
    return items.filter(item => getColId(item) === columnKey);
  };

  const renderColumn = (col, colIndex) => {
    const colItems = getItemsForColumn(col.key);
    const badgeColor = col.color || colors.primary;

    return (
      <View
        key={col.key}
        style={[
          styles.column,
          {
            width: columnWidth,
            borderColor: colors.border,
            backgroundColor: getRGBA(colors.card, 0.6)
          }
        ]}
      >
        <View style={styles.columnHeader}>
          <View style={styles.headerLeft}>
            <View style={[styles.statusIndicator, { backgroundColor: badgeColor }]} />
            <Text style={[styles.columnTitle, { color: colors.text }]}>
              {col.label}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: getRGBA(badgeColor, 0.15) }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>
              {colItems.length}
            </Text>
          </View>
        </View>

        <ScrollView
          scrollEnabled={draggingItemId === null}
          style={styles.cardList}
          contentContainerStyle={styles.cardListContent}
          showsVerticalScrollIndicator={false}
        >
          {colItems.length > 0 ? (
            colItems.map(item => (
              <DraggableCard
                key={item._id}
                item={item}
                colIndex={colIndex}
                columnWidth={columnWidth + 16}
                actualColumnWidth={columnWidth}
                renderItem={renderItem}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                colors={colors}
              />
            ))
          ) : (
            <View style={styles.emptyColumn}>
              <Ionicons name="folder-open-outline" size={24} color={getRGBA(colors.textSecondary, 0.4)} />
              <Text style={[styles.emptyColumnText, { color: colors.textSecondary }]}>
                {tr ? tr('common.empty') || 'No items' : 'No items'}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isDesktop ? (
        <View style={styles.desktopContainer}>
          {columns.map((col, index) => renderColumn(col, index))}
        </View>
      ) : (
        <View style={styles.mobileWrapper}>
          <ScrollView
            horizontal
            pagingEnabled
            snapToInterval={columnWidth + 16}
            snapToAlignment="center"
            decelerationRate="fast"
            style={styles.mobileScrollView}
            contentContainerStyle={styles.mobileContainer}
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            scrollEnabled={draggingItemId === null}
          >
            {columns.map((col, index) => renderColumn(col, index))}
          </ScrollView>
          <View style={styles.pagination}>
            {columns.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor: index === activePage ? colors.primary : colors.border,
                    width: index === activePage ? 16 : 6
                  }
                ]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginVertical: 10,
    maxHeight: 500,
    width: '100%'
  },
  loaderContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center'
  },
  desktopContainer: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
    flex: 1
  },
  mobileWrapper: {
    flex: 1,
    width: '100%'
  },
  mobileScrollView: {
    flex: 1
  },
  mobileContainer: {
    paddingHorizontal: 16,
    gap: 16,
    paddingBottom: 8,
    flexGrow: 1
  },
  column: {
    borderRadius: 16,
    borderWidth: 1,
    height: '100%',
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  columnTitle: {
    fontSize: 15,
    fontWeight: '700'
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  cardList: {
    flex: 1
  },
  cardListContent: {
    paddingBottom: 20
  },
  draggableContainer: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: 'transparent'
  },
  dragIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 99,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    opacity: 0.7
  },
  cardContent: {
    width: '100%'
  },
  emptyColumn: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 12,
    marginTop: 10
  },
  emptyColumnText: {
    fontSize: 12
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12
  },
  dot: {
    height: 6,
    borderRadius: 3
  }
});

export default KanbanBoard;
