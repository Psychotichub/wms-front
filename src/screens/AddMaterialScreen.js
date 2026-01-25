import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, FlatList } from 'react-native';
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

const MATERIAL_ROW_HEIGHT = 44;

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

const MaterialRow = React.memo(({ item, colors, onEdit, onDelete }) => {
  if (item.__skeleton) {
    return (
      <View style={[styles.row, { borderColor: colors.border }]}>
        <View style={styles.cell}><SkeletonBar width="70%" height={12} /></View>
        <View style={styles.cell}><SkeletonBar width="50%" height={12} /></View>
        <View style={styles.cell}><SkeletonBar width="40%" height={12} /></View>
        <View style={styles.cell}><SkeletonBar width="40%" height={12} /></View>
        <View style={styles.cell}><SkeletonBar width="40%" height={12} /></View>
        <View style={[styles.cell, styles.actionCell]}>
          <SkeletonBar width={24} height={12} />
          <SkeletonBar width={24} height={12} />
        </View>
      </View>
    );
  }

  const formatPrice = (value) => {
    const num = Number(value) || 0;
    return num.toFixed(2);
  };

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Text style={[styles.cell, { color: colors.text }]}>{item.name}</Text>
      <Text style={[styles.cell, { color: colors.text }]}>{item.unit}</Text>
      <Text style={[styles.cell, { color: colors.text }]}>{formatPrice(item.materialPrice)}</Text>
      <Text style={[styles.cell, { color: colors.text }]}>{formatPrice(item.labourPrice)}</Text>
      <Text style={[styles.cell, { color: colors.text }]}>{formatPrice(item.price)}</Text>
      <View style={[styles.cell, styles.actionCell]}>
        <Pressable style={[styles.actionBtn, { backgroundColor: getRGBA(colors.primary, 0.12) }]} onPress={() => onEdit(item)}>
          <Ionicons name="create-outline" size={18} color={colors.primary} />
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.deleteBtn, { backgroundColor: getRGBA(colors.danger, 0.12) }]} onPress={() => onDelete(item._id)}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      </View>
    </View>
  );
});
MaterialRow.displayName = 'MaterialRow';

const AddMaterialScreen = () => {
  const { request, user } = useAuth();
  const t = useThemeTokens();
  const hasSite = Boolean(user?.site);

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('m');
  const [materialPrice, setMaterialPrice] = useState('0');
  const [labourPrice, setLabourPrice] = useState('0');
  const [materials, setMaterials] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const loadMaterials = useCallback(async () => {
    if (!hasSite) {
      setMaterials([]);
      return;
    }
    setLoading(true);
    try {
      const data = await request('/api/materials');
      setMaterials(data.materials || []);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }, [hasSite, request]);

  useFocusEffect(
    useCallback(() => {
      if (hasSite) {
        loadMaterials();
      }
    }, [hasSite, loadMaterials])
  );

  const filteredMaterials = useMemo(() => {
    if (!searchValue) return materials;
    const needle = searchValue.toLowerCase();
    return materials.filter((m) => (m.name || '').toLowerCase().includes(needle));
  }, [materials, searchValue]);

  const handleSubmit = async () => {
    setMessage('');
    try {
      const matPrice = Number(materialPrice) || 0;
      const labPrice = Number(labourPrice) || 0;
      const totalPrice = Math.round((matPrice + labPrice) * 100) / 100; // Round to 2 decimal places
      
      const payload = {
        name,
        quantity: 0,
        unit,
        materialPrice: Math.round(matPrice * 100) / 100,
        labourPrice: Math.round(labPrice * 100) / 100,
        price: totalPrice
      };

      if (editingId) {
        await request(`/api/materials/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await request('/api/materials', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setName('');
      setUnit('m');
      setMaterialPrice('0');
      setLabourPrice('0');
      setEditingId(null);
      setMessage('Material saved');
      loadMaterials();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handleEdit = useCallback((item) => {
    setEditingId(item._id);
    setName(item.name || '');
    setUnit(item.unit || 'pcs');
    setMaterialPrice(String(item.materialPrice ?? item.price ?? 0));
    setLabourPrice(String(item.labourPrice ?? 0));
    setMessage('');
  }, []);

  const handleDelete = useCallback(async (id) => {
    setMessage('');
    try {
      await request(`/api/materials/${id}`, { method: 'DELETE' });
      if (editingId === id) {
        setEditingId(null);
        setName('');
        setUnit('pcs');
        setMaterialPrice('0');
        setLabourPrice('0');
      }
      loadMaterials();
    } catch (err) {
      setMessage(err.message);
    }
  }, [editingId, loadMaterials, request]);

  const renderMaterialItem = useCallback(
    ({ item }) => (
      <MaterialRow
        item={item}
        colors={t.colors}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    ),
    [handleDelete, handleEdit, t.colors]
  );
  const getItemLayout = useCallback((_, index) => ({
    length: MATERIAL_ROW_HEIGHT,
    offset: MATERIAL_ROW_HEIGHT * index,
    index
  }), []);

  if (!hasSite) {
    return (
      <Screen>
        <SiteRequiredNotice />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
      <Text style={[styles.title, { color: t.colors.text }]}>Add Material</Text>
      <Text style={[styles.label, { color: t.colors.textSecondary }]}>Material name</Text>
      <AutocompleteInput
        data={Array.from(new Set(materials.map(m => m.name)))}
        value={name}
        onChange={setName}
        onSelect={(item) => setName(item.label)}
        placeholder="Material name (e.g., Cable)"
        containerStyle={{ marginBottom: 12 }}
      />
      <Text style={[styles.label, { color: t.colors.textSecondary }]}>Unit</Text>
      <View style={styles.unitRow}>
        {['pcs', 'm'].map((value) => (
          <Pressable
            key={value}
            style={[
              styles.unitChip,
              { borderColor: t.colors.border, backgroundColor: t.colors.card },
              unit === value && {
                borderColor: t.colors.primary,
                backgroundColor: getRGBA(t.colors.primary, 0.1)
              }
            ]}
            onPress={() => setUnit(value)}
          >
            <Text
              style={[
                styles.unitText,
                { color: t.colors.text },
                unit === value && { color: t.colors.primary, fontWeight: '700' }
              ]}
            >
              {value}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.label, { color: t.colors.textSecondary }]}>Material price</Text>
      <TextInput
        style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
        placeholder="Material price (e.g., 120)"
        keyboardType="numeric"
        value={materialPrice}
        onChangeText={setMaterialPrice}
        placeholderTextColor={t.colors.textSecondary}
      />
      <Text style={[styles.label, { color: t.colors.textSecondary }]}>Labour price</Text>
      <TextInput
        style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
        placeholder="Labour price (e.g., 30)"
        keyboardType="numeric"
        value={labourPrice}
        onChangeText={setLabourPrice}
        placeholderTextColor={t.colors.textSecondary}
      />

      <Button title={editingId ? 'Update Material' : 'Save Material'} onPress={handleSubmit} />
      {message ? <Text style={[styles.message, { color: t.colors.text }]}>{message}</Text> : null}
      {loading || materials.length > 0 ? (
        <>
          <Text style={[styles.label, { color: t.colors.textSecondary }]}>Search material</Text>
          <AutocompleteInput
            data={materials.map(m => m.name)}
            value={searchValue}
            onChange={setSearchValue}
            onSelect={(item) => setSearchValue(item.label)}
            placeholder="Type to search material name"
            containerStyle={{ marginBottom: 12 }}
          />
          <Text style={[styles.tableTitle, { color: t.colors.text }]}>Saved Materials</Text>
          <View style={[styles.table, { borderColor: t.colors.border }]}>
            <View
              style={[
                styles.row,
                styles.headerRow,
                { backgroundColor: t.colors.card, borderColor: t.colors.border }
              ]}
            >
              <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Name</Text>
              <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Unit</Text>
              <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Material Price</Text>
              <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Labour Price</Text>
              <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Total Price</Text>
              <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Action</Text>
            </View>
            <FlatList
              data={loading ? Array.from({ length: 5 }).map((_, idx) => ({ id: `material-skeleton-${idx}`, __skeleton: true })) : filteredMaterials}
              keyExtractor={(item) => (item.__skeleton ? item.id : item._id)}
              scrollEnabled={false}
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={7}
              removeClippedSubviews
              renderItem={renderMaterialItem}
              getItemLayout={getItemLayout}
            />
          </View>
          {!loading && filteredMaterials.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="No materials match your search"
              subtitle="Try a different name or clear the search."
            />
          ) : null}
        </>
      ) : (
        !loading && (
          <EmptyState
            icon="cube-outline"
            title="No materials yet"
            subtitle="Create your first material to get started."
          />
        )
      )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  label: { marginBottom: 6, fontWeight: '600' },
  unitRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  unitChip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff'
  },
  unitChipActive: {
    borderColor: '#2563eb',
    backgroundColor: '#e0e7ff'
  },
  unitText: { color: '#111827' },
  unitTextActive: { color: '#1d4ed8', fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fff'
  },
  message: { marginTop: 8, color: '#047857' },
  tableTitle: { marginTop: 16, marginBottom: 8, fontSize: 18, fontWeight: '700' },
  table: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', minHeight: MATERIAL_ROW_HEIGHT },
  headerRow: { backgroundColor: '#f3f4f6' },
  cell: { flex: 1, paddingVertical: 10, paddingHorizontal: 8 },
  headerCell: { fontWeight: '700', color: '#374151' },
  actionCell: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#e0f2fe' },
  actionText: { color: '#0369a1', fontWeight: '600' },
  deleteBtn: { backgroundColor: '#fee2e2' },
  deleteText: { color: '#b91c1c' },
  muted: { color: '#6b7280', marginBottom: 8 }
});

export default AddMaterialScreen;

