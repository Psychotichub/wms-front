import React from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useThemeTokens } from '../../theme/ThemeProvider';
import EmptyState from './EmptyState';

const DataTable = ({
  columns,
  data,
  renderCell,
  keyExtractor,
  rowHeight = 48,
  emptyIcon = 'document-text-outline',
  emptyTitle = 'No data',
  emptySubtitle,
  ListHeaderComponent,
  horizontal = false,
}) => {
  const t = useThemeTokens();

  const headerRow = (
    <View style={[styles.row, { borderColor: t.colors.border, backgroundColor: t.colors.surface, minHeight: rowHeight }]}>
      {columns.map((col) => (
        <View key={col.key} style={[styles.cell, col.flex && { flex: col.flex }]}>
          <Text
            style={[styles.headerText, { color: t.colors.textSecondary }]}
            numberOfLines={1}
          >
            {col.title}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderRow = ({ item, index }) => (
    <View
      style={[
        styles.row,
        {
          borderColor: t.colors.border,
          backgroundColor: index % 2 === 1 ? t.colors.surface + '80' : 'transparent',
          minHeight: rowHeight,
        },
      ]}
    >
      {columns.map((col) => (
        <View key={col.key} style={[styles.cell, col.flex && { flex: col.flex }, col.align && { alignItems: col.align }]}>
          {renderCell ? (
            renderCell({ item, column: col, index })
          ) : (
            <Text style={[styles.cellText, { color: t.colors.text }]} numberOfLines={2}>
              {item[col.key] ?? ''}
            </Text>
          )}
        </View>
      ))}
    </View>
  );

  const tableContent = (
    <View style={[styles.table, { borderColor: t.colors.border }]}>
      {headerRow}
      <FlatList
        data={data}
        renderItem={renderRow}
        keyExtractor={keyExtractor || ((item, i) => item._id || item.id || String(i))}
        getItemLayout={(_d, index) => ({ length: rowHeight, offset: rowHeight * index, index })}
        ListEmptyComponent={
          <EmptyState icon={emptyIcon} title={emptyTitle} subtitle={emptySubtitle} />
        }
        scrollEnabled={false}
      />
    </View>
  );

  if (horizontal) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {tableContent}
      </ScrollView>
    );
  }

  return tableContent;
};

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  cell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  headerText: {
    fontWeight: '700',
    fontSize: 13,
  },
  cellText: {
    fontSize: 14,
  },
});

export default DataTable;
