import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, FlatList, Alert, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import SiteRequiredNotice from '../components/SiteRequiredNotice';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import Button from '../components/ui/Button';
import AutocompleteInput from '../components/ui/AutocompleteInput';
import EmptyState from '../components/ui/EmptyState';
import SkeletonBar from '../components/ui/SkeletonBar';

const CONTRACT_ROW_HEIGHT = 50;

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

const ContractRow = React.memo(({ item, colors, onEdit, onDelete, isAdmin }) => {
  if (item.__skeleton) {
    return (
      <View style={[styles.row, { borderColor: colors.border }]}>
        <View style={styles.cell}><SkeletonBar width="80%" height={12} /></View>
        <View style={styles.cell}><SkeletonBar width="50%" height={12} /></View>
        <View style={styles.cell}><SkeletonBar width="50%" height={12} /></View>
        <View style={styles.cell}><SkeletonBar width="50%" height={12} /></View>
        <View style={styles.cell}><SkeletonBar width="40%" height={12} /></View>
        {isAdmin && (
          <View style={[styles.cell, styles.actionCell]}>
            <SkeletonBar width={24} height={12} />
            <SkeletonBar width={24} height={12} />
          </View>
        )}
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
        {item.contractQuantity} {item.unit}
      </Text>
      <Text style={[styles.cell, { color: colors.text }]}>
        {item.totalConsumption} {item.unit}
      </Text>
      <Text style={[styles.cell, { color: colors.text }]}>
        {item.restQuantity} {item.unit}
      </Text>
      <View style={[styles.cell, styles.statusCell]}>
        <View style={[styles.statusBadge, { backgroundColor: getRGBA(statusColor, 0.15), borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
        </View>
      </View>
      {isAdmin && (
        <View style={[styles.cell, styles.actionCell]}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: getRGBA(colors.primary, 0.12) }]}
            onPress={() => onEdit(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="create-outline" size={18} color={colors.primary} />
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.deleteBtn, { backgroundColor: getRGBA(colors.danger, 0.12) }]}
            onPress={() => {
              const contractId = item.id || item._id;
              if (contractId) {
                onDelete(contractId);
              } else {
                console.error('Delete button pressed but no ID found:', item);
              }
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </Pressable>
        </View>
      )}
    </View>
  );
});
ContractRow.displayName = 'ContractRow';

const ContractQuantityScreen = () => {
  const { request, user } = useAuth();
  const t = useThemeTokens();
  const hasSite = Boolean(user?.site);
  const isAdmin = user?.role === 'admin';

  const [materialName, setMaterialName] = useState('');
  const [materialId, setMaterialId] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [contractQuantity, setContractQuantity] = useState('0');
  const [contracts, setContracts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const isInList = (val, list) =>
    !!val && list.some((item) => (item || '').toLowerCase() === val.trim().toLowerCase());

  const loadContracts = useCallback(async () => {
    if (!hasSite) {
      setContracts([]);
      return;
    }
    setLoading(true);
    try {
      const data = await request('/api/contracts');
      setContracts(data.contracts || []);
    } catch (err) {
      setMessage(err.message || 'Failed to load contracts');
    } finally {
      setLoading(false);
    }
  }, [request, hasSite]);

  const loadMaterials = useCallback(async () => {
    if (!hasSite) return;
    try {
      const data = await request('/api/materials');
      setMaterials(data.materials || []);
    } catch {
      // ignore dropdown errors
    }
  }, [request, hasSite]);

  useFocusEffect(
    useCallback(() => {
      loadContracts();
      loadMaterials();
    }, [loadContracts, loadMaterials])
  );

  const filteredContracts = useMemo(() => {
    if (!searchValue.trim()) return contracts;
    const search = searchValue.toLowerCase();
    return contracts.filter(
      (c) =>
        c.materialName?.toLowerCase().includes(search)
    );
  }, [contracts, searchValue]);

  const handleSubmit = async () => {
    if (!materialId) {
      setMessage('Please select a material');
      return;
    }
    const qty = Number(contractQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setMessage('Please enter a valid quantity');
      return;
    }

    setMessage('');
    try {
      if (editingId) {
        await request(`/api/contracts/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({ contractQuantity: qty })
        });
        setMessage('Contract updated successfully');
      } else {
        await request('/api/contracts', {
          method: 'POST',
          body: JSON.stringify({
            materialId,
            contractQuantity: qty
          })
        });
        setMessage('Contract added successfully');
      }
      setMaterialName('');
      setMaterialId(null);
      setContractQuantity('0');
      setEditingId(null);
      await loadContracts();
    } catch (err) {
      setMessage(err.message || 'Failed to save contract');
    }
  };

  const handleEdit = useCallback((contract) => {
    setEditingId(contract.id);
    setMaterialName(contract.materialName || '');
    setMaterialId(contract.materialId || null);
    setContractQuantity(String(contract.contractQuantity || 0));
    setMessage('');
  }, []);

  const performDelete = useCallback(async (id) => {
    setMessage('');
    try {
      await request(`/api/contracts/${id}`, { method: 'DELETE' });
      setEditingId((currentId) => {
        if (currentId === id) {
          setMaterialName('');
          setMaterialId(null);
          setContractQuantity('0');
          return null;
        }
        return currentId;
      });
      setMessage('Contract deleted successfully');
      await loadContracts();
    } catch (err) {
      console.error('Delete error:', err);
      setMessage(err.message || 'Failed to delete contract');
    }
  }, [request, loadContracts]);

  const handleDelete = useCallback((id) => {
    if (!id) {
      console.error('Delete called with no ID');
      setMessage('Error: No contract ID provided');
      return;
    }

    if (Platform.OS === 'web') {
      // On web, use window.confirm for better compatibility
      const confirmed = window.confirm('Are you sure you want to delete this contract?');
      if (confirmed) {
        performDelete(id);
      }
    } else {
      // On native, use Alert
      Alert.alert(
        'Delete Contract',
        'Are you sure you want to delete this contract?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => performDelete(id)
          }
        ]
      );
    }
  }, [performDelete]);

  const materialOptions = useMemo(
    () =>
      materials.map((m) => ({
        id: m._id,
        label: m.name,
        value: m.name
      })),
    [materials]
  );

  const materialNames = useMemo(() => materialOptions.map(opt => opt.label), [materialOptions]);

  if (!hasSite) {
    return (
      <Screen>
        <SiteRequiredNotice />
      </Screen>
    );
  }

  const displayContracts = loading && contracts.length === 0
    ? [{ __skeleton: true }, { __skeleton: true }, { __skeleton: true }]
    : filteredContracts;

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={[styles.title, { color: t.colors.text }]}>Contract Quantity Management</Text>

        {isAdmin && (
          <>
            <Text style={[styles.label, { color: t.colors.textSecondary }]}>
              {editingId ? 'Edit Contract' : 'Add Contract Quantity'}
            </Text>
            <Text style={[styles.label, { color: t.colors.textSecondary }]}>Material Name</Text>
            <AutocompleteInput
              data={materialOptions.map(opt => opt.label)}
              value={materialName}
              onChange={(val) => {
                setMaterialName(val);
                setMaterialId(null); // clear when typing
              }}
              onSelect={(item) => {
                const match = materials.find((m) => (m.name || '').toLowerCase() === (item.label || '').toLowerCase());
                setMaterialName(item.label);
                setMaterialId(match?._id || null);
              }}
              onBlur={(currentVal) => {
                if (!isInList(currentVal, materialNames)) {
                  setMaterialName('');
                  setMaterialId(null);
                  setMessage('Select material from dropdown');
                }
              }}
              placeholder="Select material"
              containerStyle={{ marginBottom: 12, zIndex: 10000, elevation: 10 }}
            />

            <Text style={[styles.label, { color: t.colors.textSecondary }]}>Total Qty</Text>
            <TextInput
              style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
              value={contractQuantity}
              onChangeText={setContractQuantity}
              placeholder="Enter contract quantity"
              keyboardType="numeric"
              placeholderTextColor={t.colors.textSecondary}
            />

            <Button
              onPress={handleSubmit}
              title={editingId ? 'Update Contract' : 'Add Contract'}
              style={styles.submitButton}
            />

            {editingId && (
              <Button
                onPress={() => {
                  setEditingId(null);
                  setMaterialName('');
                  setMaterialId(null);
                  setContractQuantity('0');
                }}
                title="Cancel"
                variant="outline"
                style={styles.cancelButton}
              />
            )}

            {message ? (
              <Text style={[styles.message, { color: message.includes('success') ? t.colors.success : t.colors.danger }]}>
                {message}
              </Text>
            ) : null}
          </>
        )}

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

          {displayContracts.length === 0 && !loading ? (
            <EmptyState
              icon="document-outline"
              title="No contracts found"
              subtitle={searchValue ? "Try a different search term" : "Add a contract to get started"}
            />
          ) : (
            <View style={[styles.table, { borderColor: t.colors.border }]}>
              <FlatList
                data={displayContracts}
                scrollEnabled={false}
                keyExtractor={(item, index) => item.id || item._id || `contract-${index}`}
                getItemLayout={(_, index) => ({
                  length: CONTRACT_ROW_HEIGHT,
                  offset: CONTRACT_ROW_HEIGHT * index,
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
                    <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Total Qty</Text>
                    <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Consumption</Text>
                    <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Rest</Text>
                    <Text style={[styles.cell, styles.headerCell, styles.statusCell, { color: t.colors.text }]}>Status</Text>
                    {isAdmin && <Text style={[styles.cell, styles.headerCell, styles.actionCell, { color: t.colors.text }]}>Actions</Text>}
                  </View>
                }
                renderItem={({ item }) => (
                  <ContractRow
                    item={item}
                    colors={t.colors}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isAdmin={isAdmin}
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
  label: {
    marginBottom: 6,
    color: '#374151',
    fontWeight: '600'
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
    fontSize: 16
  },
  submitButton: {
    marginTop: 8
  },
  cancelButton: {
    marginTop: 8
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center'
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
    minHeight: CONTRACT_ROW_HEIGHT
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
  actionCell: {
    flexDirection: 'column',
    gap: 4,
    alignItems: 'flex-start',
    justifyContent: 'center'
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
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#e0f2fe'
  },
  deleteBtn: {
    backgroundColor: '#fee2e2'
  }
});

export default ContractQuantityScreen;
