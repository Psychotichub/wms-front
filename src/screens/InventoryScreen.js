import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, FlatList, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import SiteRequiredNotice from '../components/SiteRequiredNotice';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import EmptyState from '../components/ui/EmptyState';
import SkeletonBar from '../components/ui/SkeletonBar';

const INVENTORY_ROW_HEIGHT = 50;

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

const getStatusColor = (status, colors) => {
  switch (status) {
    case 'OK':
      return colors.success;
    case 'Exceed':
      return colors.danger;
    case 'Finished':
      return colors.warning;
    default:
      return colors.textSecondary;
  }
};

const InventoryRow = React.memo(({ item, colors }) => {
  if (item.__skeleton) {
    return (
      <View style={[styles.row, { borderColor: colors.border }]}>
        <View style={styles.cell}><SkeletonBar width="80%" height={12} /></View>
        <View style={styles.cell}><SkeletonBar width="50%" height={12} /></View>
        <View style={styles.cell}><SkeletonBar width="50%" height={12} /></View>
        <View style={styles.cell}><SkeletonBar width="50%" height={12} /></View>
        <View style={styles.cell}><SkeletonBar width="40%" height={12} /></View>
      </View>
    );
  }

  const statusColor = getStatusColor(item.status, colors);

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Text style={[styles.cell, styles.materialCell, { color: colors.text }]} numberOfLines={1}>
        {item.materialName}
      </Text>
      <Text style={[styles.cell, { color: colors.text }]}>
        {item.received} {item.unit}
      </Text>
      <Text style={[styles.cell, { color: colors.text }]}>
        {item.totalConsumption} {item.unit}
      </Text>
      <Text style={[styles.cell, { color: colors.text }]}>
        {item.stock} {item.unit}
      </Text>
      <View style={[styles.cell, styles.statusCell]}>
        <View style={[styles.statusBadge, { backgroundColor: getRGBA(statusColor, 0.15), borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
        </View>
      </View>
    </View>
  );
});
InventoryRow.displayName = 'InventoryRow';

const InventoryScreen = () => {
  const { request, user } = useAuth();
  const t = useThemeTokens();
  const hasSite = Boolean(user?.site);

  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const loadInventory = useCallback(async () => {
    if (!hasSite) {
      setInventory([]);
      return;
    }
    setLoading(true);
    try {
      const data = await request('/api/inventory');
      setInventory(data.inventory || []);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  }, [request, hasSite]);

  useFocusEffect(
    useCallback(() => {
      loadInventory();
    }, [loadInventory])
  );

  const filteredInventory = useMemo(() => {
    if (!searchValue.trim()) return inventory;
    const search = searchValue.toLowerCase();
    return inventory.filter(
      (item) =>
        item.materialName?.toLowerCase().includes(search)
    );
  }, [inventory, searchValue]);

  if (!hasSite) {
    return (
      <Screen>
        <SiteRequiredNotice />
      </Screen>
    );
  }

  const displayInventory = loading && inventory.length === 0
    ? [{ __skeleton: true }, { __skeleton: true }, { __skeleton: true }]
    : filteredInventory;

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={[styles.title, { color: t.colors.text }]}>Inventory Management</Text>

        <View style={styles.tableContainer}>
          <View style={[styles.searchContainer, { borderColor: t.colors.border, backgroundColor: t.colors.card }]}>
            <Ionicons name="search-outline" size={20} color={t.colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: t.colors.text }]}
              placeholder="Search materials..."
              value={searchValue}
              onChangeText={setSearchValue}
              placeholderTextColor={t.colors.textSecondary}
            />
          </View>

          {displayInventory.length === 0 && !loading ? (
            <EmptyState
              icon="cube-outline"
              title="No inventory found"
              subtitle={searchValue ? "Try a different search term" : "No materials have been received yet"}
            />
          ) : (
            <View style={[styles.table, { borderColor: t.colors.border }]}>
              <FlatList
                data={displayInventory}
                scrollEnabled={false}
                keyExtractor={(item, index) => item.materialName || `inventory-${index}`}
                getItemLayout={(_, index) => ({
                  length: INVENTORY_ROW_HEIGHT,
                  offset: INVENTORY_ROW_HEIGHT * index,
                  index
                })}
                removeClippedSubviews={Platform.OS !== 'web'}
                ListHeaderComponent={
                  <View
                    style={[
                      styles.row,
                      styles.headerRow,
                      { backgroundColor: t.colors.card, borderColor: t.colors.border }
                    ]}
                  >
                    <Text style={[styles.cell, styles.headerCell, styles.materialCell, { color: t.colors.text }]}>Material Name</Text>
                    <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Received</Text>
                    <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Consumption</Text>
                    <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Stock</Text>
                    <Text style={[styles.cell, styles.headerCell, styles.statusCell, { color: t.colors.text }]}>Status</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <InventoryRow
                    item={item}
                    colors={t.colors}
                  />
                )}
              />
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12
  },
  tableContainer: {
    flex: 1
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 0
  },
  table: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden'
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    minHeight: INVENTORY_ROW_HEIGHT
  },
  headerRow: {
    backgroundColor: '#f3f4f6'
  },
  cell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    color: '#111827'
  },
  headerCell: {
    fontWeight: '700',
    color: '#374151'
  },
  materialCell: {
    flex: 1.5,
    minWidth: 120
  },
  statusCell: {
    flex: 0.8,
    alignItems: 'flex-start'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600'
  }
});

export default InventoryScreen;
