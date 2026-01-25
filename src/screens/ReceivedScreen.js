import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, FlatList, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import Button from '../components/ui/Button';
import AutocompleteInput from '../components/ui/AutocompleteInput';
import EmptyState from '../components/ui/EmptyState';
import SkeletonBar from '../components/ui/SkeletonBar';
import { generatePDF, generateExcel, generateHTMLTable } from '../utils/exportUtils';

const RECEIPT_ROW_HEIGHT = 44;

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

const ReceiptRow = React.memo(({ item, colors, materialUnitMap, onEdit, onDelete }) => {
  if (item.__skeleton) {
    return (
      <View style={[styles.row, { borderColor: colors.border }]}>
        <View style={styles.cell}><SkeletonBar width="80%" height={12} /></View>
        <View style={styles.cell}><SkeletonBar width="50%" height={12} /></View>
        <View style={styles.cell}><SkeletonBar width="90%" height={12} /></View>
        <View style={[styles.cell, styles.actionCell]}>
          <SkeletonBar width={24} height={12} />
          <SkeletonBar width={24} height={12} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Text style={[styles.cell, { color: colors.text }]}>{item.materialName}</Text>
      <Text style={[styles.cell, { color: colors.text }]}>
        {item.quantity} {materialUnitMap[item.materialName.toLowerCase()] || ''}
      </Text>
      <Text style={[styles.cell, { color: colors.text }]}>{item.notes || '-'}</Text>
      <View style={[styles.cell, styles.actionCell]}>
        <Pressable onPress={() => onEdit(item)} style={[styles.actionBtn, { backgroundColor: getRGBA(colors.primary, 0.12) }]}>
          <Ionicons name="create-outline" size={18} color={colors.primary} />
        </Pressable>
        <Pressable onPress={() => onDelete(item._id)} style={[styles.actionBtn, styles.deleteBtn, { backgroundColor: getRGBA(colors.danger, 0.12) }]}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      </View>
    </View>
  );
});
ReceiptRow.displayName = 'ReceiptRow';

const ReceivedScreen = () => {
  const { request } = useAuth();
  const t = useThemeTokens();

  const [materialName, setMaterialName] = useState('');
  const [materials, setMaterials] = useState([]);
  const [quantity, setQuantity] = useState('0');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [records, setRecords] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const isInList = (val, list) =>
    !!val && list.some((item) => (item || '').toLowerCase() === val.trim().toLowerCase());

  const shiftDate = (base, days) => {
    const d = base ? new Date(base) : new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().substring(0, 10);
  };

  const loadMaterials = useCallback(async () => {
    try {
      const data = await request('/api/materials');
      setMaterials(data.materials || []);
    } catch {
      // ignore
    }
  }, [request]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request('/api/received');
      setRecords(data.records || []);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useFocusEffect(
    useCallback(() => {
      loadMaterials();
      loadRecords();
    }, [loadMaterials, loadRecords])
  );

  const materialNames = useMemo(() => materials.map((m) => m.name), [materials]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (!r.date) return false;
      const key = new Date(r.date).toISOString().substring(0, 10);
      return key === filterDate;
    });
  }, [records, filterDate]);

  const materialUnitMap = useMemo(() => {
    return materials.reduce((acc, m) => {
      acc[m.name.toLowerCase()] = m.unit || '';
      return acc;
    }, {});
  }, [materials]);

  const resetForm = useCallback(() => {
    setMaterialName('');
    setQuantity('0');
    setNotes('');
    setDate(new Date().toISOString().substring(0, 10));
    setEditingId(null);
  }, []);

  const handleSubmit = async () => {
    setMessage('');
    try {
      const allowedNames = materials.map((m) => (m.name || '').toLowerCase());
      const trimmed = materialName.trim();
      if (!trimmed || !allowedNames.includes(trimmed.toLowerCase())) {
        setMessage('Select a valid material from the list');
        return;
      }

      const payload = {
        materialName: trimmed,
        quantity: Number(quantity),
        notes,
        date: date || undefined
      };

      if (editingId) {
        await request(`/api/received/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await request('/api/received', { method: 'POST', body: JSON.stringify(payload) });
      }

      resetForm();
      setMessage('Receipt saved');
      loadRecords();
      loadMaterials(); // reload to get updated stock
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handleEdit = useCallback((record) => {
    setEditingId(record._id);
    setMaterialName(record.materialName);
    setQuantity(String(record.quantity));
    setNotes(record.notes || '');
    setDate(record.date ? new Date(record.date).toISOString().substring(0, 10) : '');
    setMessage('');
  }, []);

  const handleDelete = useCallback(async (id) => {
    setMessage('');
    try {
      await request(`/api/received/${id}`, { method: 'DELETE' });
      if (editingId === id) resetForm();
      loadRecords();
      loadMaterials();
    } catch (err) {
      setMessage(err.message);
    }
  }, [editingId, loadMaterials, loadRecords, request, resetForm]);

  const renderReceiptItem = useCallback(
    ({ item }) => (
      <ReceiptRow
        item={item}
        colors={t.colors}
        materialUnitMap={materialUnitMap}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    ),
    [handleDelete, handleEdit, materialUnitMap, t.colors]
  );
  const getItemLayout = useCallback((_, index) => ({
    length: RECEIPT_ROW_HEIGHT,
    offset: RECEIPT_ROW_HEIGHT * index,
    index
  }), []);

  const handleExportPDF = useCallback(async () => {
    if (filteredRecords.length === 0) {
      Alert.alert('No Data', 'There is no data to export.');
      return;
    }

    try {
      const data = filteredRecords.map(record => [
        record.materialName || '',
        `${record.quantity} ${materialUnitMap[record.materialName.toLowerCase()] || ''}`,
        record.notes || ''
      ]);

      const headers = ['Material', 'Qty', 'Notes'];
      const dateStr = new Date(filterDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const html = generateHTMLTable(data, dateStr, headers);
      
      await generatePDF(html, `received-materials-${filterDate}`);
      Alert.alert('Success', 'PDF exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export PDF. Please try again.');
    }
  }, [filteredRecords, filterDate, materialUnitMap]);

  const handleExportExcel = useCallback(async () => {
    if (filteredRecords.length === 0) {
      Alert.alert('No Data', 'There is no data to export.');
      return;
    }

    try {
      const data = filteredRecords.map(record => [
        record.materialName || '',
        record.quantity || 0,
        materialUnitMap[record.materialName.toLowerCase()] || '',
        record.notes || ''
      ]);

      const headers = ['Material', 'Quantity', 'Unit', 'Notes'];
      const dateStr = new Date(filterDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      await generateExcel(data, dateStr, `received-materials-${filterDate}`, headers);
      Alert.alert('Success', 'Excel file exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export Excel. Please try again.');
    }
  }, [filteredRecords, filterDate, materialUnitMap]);

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={[styles.title, { color: t.colors.text }]}>Receive Material</Text>
        
        <Text style={[styles.label, { color: t.colors.textSecondary }]}>Date</Text>
        <TextInput
          style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
          placeholder="YYYY-MM-DD"
          value={date}
          onChangeText={setDate}
          placeholderTextColor={t.colors.textSecondary}
        />

        <Text style={[styles.label, { color: t.colors.textSecondary }]}>Material</Text>
        <AutocompleteInput
          data={materialNames}
          value={materialName}
          onChange={(val) => setMaterialName(val)}
          onSelect={(item) => setMaterialName((item.label || '').trim())}
          onBlur={(currentVal) => {
            if (!isInList(currentVal, materialNames)) {
              setMaterialName('');
              setMessage('Select a valid material from dropdown');
            }
          }}
          placeholder="Material name"
          containerStyle={{ marginBottom: 12 }}
        />

        <Text style={[styles.label, { color: t.colors.textSecondary }]}>Quantity</Text>
        <TextInput
          style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
          placeholder="Quantity"
          keyboardType="numeric"
          value={quantity}
          onChangeText={setQuantity}
          placeholderTextColor={t.colors.textSecondary}
        />

        <Text style={[styles.label, { color: t.colors.textSecondary }]}>Notes</Text>
        <TextInput
          style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
          placeholder="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholderTextColor={t.colors.textSecondary}
        />

        <Button title={editingId ? 'Update Receipt' : 'Save Receipt'} onPress={handleSubmit} />
        {message ? <Text style={[styles.message, { color: t.colors.text }]}>{message}</Text> : null}

        <Text style={[styles.label, { color: t.colors.textSecondary, marginTop: 24 }]}>Filter Date</Text>
        <View style={styles.filterRow}>
          <Pressable
            style={[styles.actionBtn, styles.smallBtn, { backgroundColor: getRGBA(t.colors.primary, 0.12) }]}
            onPress={() => setFilterDate((prev) => shiftDate(prev, -1))}
          >
            <Text style={[styles.actionText, { color: t.colors.text }]}>◀</Text>
          </Pressable>
          <TextInput
            style={[
              styles.input,
              styles.filterInput,
              { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }
            ]}
            placeholder="YYYY-MM-DD"
            value={filterDate}
            onChangeText={setFilterDate}
            placeholderTextColor={t.colors.textSecondary}
          />
          <Pressable
            style={[styles.actionBtn, styles.smallBtn, { backgroundColor: getRGBA(t.colors.primary, 0.12) }]}
            onPress={() => setFilterDate((prev) => shiftDate(prev, 1))}
          >
            <Text style={[styles.actionText, { color: t.colors.text }]}>▶</Text>
          </Pressable>
        </View>

        {loading || records.length > 0 ? (
          <>
            <Text style={[styles.tableTitle, { color: t.colors.text }]}>Receipt History</Text>
            <View style={[styles.table, { borderColor: t.colors.border }]}>
              <FlatList
                data={loading ? Array.from({ length: 5 }).map((_, idx) => ({ id: `receipt-skeleton-${idx}`, __skeleton: true })) : filteredRecords}
                keyExtractor={(item) => (item.__skeleton ? item.id : item._id)}
                scrollEnabled={false}
                initialNumToRender={6}
                maxToRenderPerBatch={6}
                windowSize={7}
                removeClippedSubviews
                ListHeaderComponent={
                  <View style={[styles.row, styles.headerRow, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
                    <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Material</Text>
                    <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Qty</Text>
                    <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Notes</Text>
                    <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Action</Text>
                  </View>
                }
                renderItem={renderReceiptItem}
                getItemLayout={getItemLayout}
              />
            </View>
            {!loading && filteredRecords.length > 0 && (
              <View style={styles.exportContainer}>
                <Pressable
                  style={[styles.exportButton, { backgroundColor: getRGBA(t.colors.danger, 0.1), borderColor: t.colors.danger }]}
                  onPress={handleExportPDF}
                >
                  <Ionicons name="document-text-outline" size={20} color={t.colors.danger} />
                  <Text style={[styles.exportButtonText, { color: t.colors.danger }]}>Export PDF</Text>
                </Pressable>
                <Pressable
                  style={[styles.exportButton, { backgroundColor: getRGBA(t.colors.success, 0.1), borderColor: t.colors.success }]}
                  onPress={handleExportExcel}
                >
                  <Ionicons name="document-outline" size={20} color={t.colors.success} />
                  <Text style={[styles.exportButtonText, { color: t.colors.success }]}>Export Excel</Text>
                </Pressable>
              </View>
            )}
            {!loading && filteredRecords.length === 0 ? (
              <EmptyState
                icon="calendar-outline"
                title="No receipts for this date"
                subtitle="Try a different date or add a new receipt."
              />
            ) : null}
          </>
        ) : (
          !loading ? (
            <EmptyState
              icon="cube-outline"
              title="No receipts yet"
              subtitle="Add your first receipt to see it here."
            />
          ) : null
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  label: { marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12
  },
  inputWrapper: { position: 'relative', marginBottom: 12 },
  message: { marginTop: 12, textAlign: 'center', fontWeight: '600' },
  tableTitle: { marginTop: 16, marginBottom: 12, fontSize: 18, fontWeight: '700' },
  table: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  row: { flexDirection: 'row', borderBottomWidth: 1, alignItems: 'center', minHeight: RECEIPT_ROW_HEIGHT },
  headerRow: {},
  cell: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 13 },
  headerCell: { fontWeight: '700' },
  actionCell: { flexDirection: 'row', gap: 4 },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6 },
  deleteBtn: {},
  actionText: { fontWeight: '700', fontSize: 12 },
  muted: { textAlign: 'center' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  smallBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  filterInput: { flex: 1, marginBottom: 0 },
  exportContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    justifyContent: 'center'
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '600'
  }
});

export default ReceivedScreen;
