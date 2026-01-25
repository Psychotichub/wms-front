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

const REPORT_ROW_HEIGHT = 44;

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

const ReportRow = React.memo(({ item, colors, materialUnitMap, onEdit, onDelete }) => {
  if (item.__skeleton) {
    return (
      <View style={[styles.row, { borderColor: colors.border }]}>
        <View style={styles.cell}><SkeletonBar width="80%" height={12} /></View>
        <View style={styles.cell}><SkeletonBar width="50%" height={12} /></View>
        <View style={styles.cell}><SkeletonBar width="70%" height={12} /></View>
        <View style={styles.cell}><SkeletonBar width="60%" height={12} /></View>
        <View style={styles.cell}><SkeletonBar width="60%" height={12} /></View>
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
      <Text style={[styles.cell, { color: colors.text }]}>{item.materialName || item.summary}</Text>
      <Text style={[styles.cell, { color: colors.text }]}>
        {item.quantity ?? 0}{' '}
        {materialUnitMap[(item.materialName || item.summary || '').toLowerCase()] || ''}
      </Text>
      <Text style={[styles.cell, { color: colors.text }]}>{item.location}</Text>
      <Text style={[styles.cell, { color: colors.text }]}>{item.panel}</Text>
      <Text style={[styles.cell, { color: colors.text }]}>{item.circuit}</Text>
      <Text style={[styles.cell, { color: colors.text }]}>{item.notes}</Text>
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
ReportRow.displayName = 'ReportRow';

const DailyReportScreen = () => {
  const { request } = useAuth();
  const t = useThemeTokens();

  const [materialName, setMaterialName] = useState('');
  const [materialId, setMaterialId] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [panels, setPanels] = useState([]);
  const [quantity, setQuantity] = useState('0');
  const [location, setLocation] = useState('');
  const [panel, setPanel] = useState('');
  const [circuit, setCircuit] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [reports, setReports] = useState([]);
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

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request('/api/reports/daily');
      setReports(data.reports || []);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  const loadMaterials = useCallback(async () => {
    try {
      const data = await request('/api/materials');
      setMaterials(data.materials || []);
    } catch {
      // ignore dropdown errors
    }
  }, [request]);

  const loadPanels = useCallback(async () => {
    try {
      const data = await request('/api/panels');
      setPanels(data.panels || []);
    } catch {
      // ignore dropdown errors
    }
  }, [request]);

  useFocusEffect(
    useCallback(() => {
      loadReports();
      loadMaterials();
      loadPanels();
    }, [loadMaterials, loadPanels, loadReports])
  );

  const filtered = useMemo(
    () =>
      reports.filter((r) => {
        if (!r.date) return false;
        const key = new Date(r.date).toISOString().substring(0, 10);
        return key === filterDate;
      }),
    [reports, filterDate]
  );

  const uniqueMaterials = useMemo(() => {
    const seen = new Set();
    return materials.filter((m) => {
      if (!m.name) return false;
      if (seen.has(m.name)) return false;
      seen.add(m.name);
      return true;
    });
  }, [materials]);

  const materialNames = useMemo(() => uniqueMaterials.map((m) => m.name), [uniqueMaterials]);

  const materialUnitMap = useMemo(() => {
    return materials.reduce((acc, m) => {
      if (m.name) {
        acc[m.name.toLowerCase()] = m.unit || '';
      }
      return acc;
    }, {});
  }, [materials]);

  const allowedLocations = useMemo(() => ['Subsol', 'Parter', 'E1', 'E2', 'E3', 'E4', 'E5', 'Exterior', 'Organizer Santier'], []);

  const uniquePanels = useMemo(() => {
    const seen = new Set();
    return panels
      .map((p) => p.name)
      .filter((name) => {
        if (!name) return false;
        const key = name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [panels]);

  const panelCircuits = useMemo(() => {
    if (!panel) return [];
    const pName = panel.toLowerCase();
    const circuits = panels
      .filter((p) => (p.name || '').toLowerCase() === pName)
      .map((p) => p.circuit || '');
    return Array.from(new Set(circuits)).sort((a, b) => a.localeCompare(b));
  }, [panels, panel]);

  const resetForm = useCallback(() => {
    setMaterialName('');
    setMaterialId(null);
    setQuantity('0');
    setLocation('');
    setPanel('');
    setCircuit('');
    setNotes('');
    setDate(new Date().toISOString().substring(0, 10));
    setEditingId(null);
  }, []);

  const handleSubmit = async () => {
    setMessage('');
    try {
      const trimmedMaterial = materialName.trim();
      const trimmedLocation = location.trim();
      const trimmedPanel = panel.trim();
      const trimmedCircuit = circuit.trim();
      const trimmedNotes = notes.trim();

      // Ensure material exists in loaded list (case-insensitive), then use canonical name and id
      const matchingMaterial = materialId
        ? materials.find((m) => m._id === materialId)
        : materials.find((m) => (m.name || '').toLowerCase() === trimmedMaterial.toLowerCase());
      if (!trimmedMaterial || !matchingMaterial) {
        setMessage('Select a material from the list');
        return;
      }

      const matchingLocation = allowedLocations.find(l => l.toLowerCase() === trimmedLocation.toLowerCase());
      if (!trimmedLocation || !matchingLocation) {
        setMessage('Select a valid location');
        return;
      }
      if (!date) {
        setMessage('Select a date');
        return;
      }
      const parsedDate = new Date(date);
      if (!(parsedDate instanceof Date) || Number.isNaN(parsedDate.getTime())) {
        setMessage('Date is invalid');
        return;
      }

      // Optional panel/circuit: only validate if provided
      let payloadPanel = '';
      let payloadCircuit = '';
      if (trimmedPanel || trimmedCircuit) {
        const selectedPanel = uniquePanels.find(p => p.toLowerCase() === trimmedPanel.toLowerCase());
        if (!selectedPanel) {
          setMessage('Select a panel from the list');
          return;
        }
        payloadPanel = selectedPanel;

        const selectedCircuit = panelCircuits.find(c => c.toLowerCase() === trimmedCircuit.toLowerCase());
        if (panelCircuits.length === 0) {
          setMessage('No circuits found for this panel');
          return;
        }
        if (!selectedCircuit) {
          setMessage('Select a circuit for the chosen panel');
          return;
        }
        payloadCircuit = selectedCircuit;
      }

      // Prevent duplicate Material + Location + Panel + Circuit on the same date
      const targetDay = (date || '').substring(0, 10);
      const duplicateEntry = reports.some((r) => {
        const rDate = r.date ? new Date(r.date).toISOString().substring(0, 10) : '';
        const rMaterial = (r.materialName || r.summary || '').trim().toLowerCase();
        const rLocation = (r.location || '').trim().toLowerCase();
        const rPanel = (r.panel || '').trim().toLowerCase();
        const rCircuit = (r.circuit || '').trim().toLowerCase();
        
        return (
          rDate === targetDay &&
          rMaterial === matchingMaterial.name.trim().toLowerCase() &&
          rLocation === matchingLocation.toLowerCase() &&
          rPanel === payloadPanel.toLowerCase() &&
          rCircuit === payloadCircuit.toLowerCase() &&
          r._id !== editingId
        );
      });

      if (duplicateEntry) {
        setMessage('This exact entry (Material, Location, Panel, Circuit) already exists for this date');
        return;
      }

      const numericQty = Number(quantity);
      if (!Number.isFinite(numericQty) || numericQty <= 0) {
        setMessage('Quantity must be greater than 0');
        return;
      }

      const payload = {
        summary: matchingMaterial.name,
        tasks: notes ? [notes] : [],
        materialName: matchingMaterial.name,
        materialId: matchingMaterial._id,
        quantity: numericQty,
        location: matchingLocation,
        panel: payloadPanel,
        circuit: payloadCircuit,
        notes: trimmedNotes,
        date: date || undefined
      };

      if (editingId) {
        await request(`/api/reports/daily/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await request('/api/reports/daily', { method: 'POST', body: JSON.stringify(payload) });
      }

      resetForm();
      setMessage('Report saved');
      loadReports();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handleEdit = useCallback((report) => {
    setEditingId(report._id);
    setMaterialName(report.materialName || report.summary || '');
    setMaterialId(report.materialId || null);
    setQuantity(String(report.quantity ?? 0));
    setLocation(report.location || '');
    setPanel(report.panel || '');
    setCircuit(report.circuit || '');
    setNotes(report.notes || '');
    setDate(report.date ? new Date(report.date).toISOString().substring(0, 10) : '');
    setMessage('');
  }, []);

  const handleDelete = useCallback(async (id) => {
    setMessage('');
    try {
      await request(`/api/reports/daily/${id}`, { method: 'DELETE' });
      if (editingId === id) {
        resetForm();
      }
      loadReports();
    } catch (err) {
      setMessage(err.message);
    }
  }, [editingId, loadReports, request, resetForm]);

  const renderReportItem = useCallback(
    ({ item }) => (
      <ReportRow
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
    length: REPORT_ROW_HEIGHT,
    offset: REPORT_ROW_HEIGHT * index,
    index
  }), []);

  const handleExportPDF = useCallback(async () => {
    if (filtered.length === 0) {
      Alert.alert('No Data', 'There is no data to export.');
      return;
    }

    try {
      const data = filtered.map(report => [
        report.materialName || report.summary || '',
        `${report.quantity ?? 0} ${materialUnitMap[(report.materialName || report.summary || '').toLowerCase()] || ''}`,
        report.location || '',
        report.panel || '',
        report.circuit || '',
        report.notes || ''
      ]);

      const headers = ['Material', 'Qty', 'Location', 'Panel', 'Circuit', 'Notes'];
      const dateStr = new Date(filterDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const html = generateHTMLTable(data, dateStr, headers);
      
      await generatePDF(html, `daily-report-${filterDate}`);
      Alert.alert('Success', 'PDF exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export PDF. Please try again.');
    }
  }, [filtered, filterDate, materialUnitMap]);

  const handleExportExcel = useCallback(async () => {
    if (filtered.length === 0) {
      Alert.alert('No Data', 'There is no data to export.');
      return;
    }

    try {
      const data = filtered.map(report => [
        report.materialName || report.summary || '',
        report.quantity ?? 0,
        materialUnitMap[(report.materialName || report.summary || '').toLowerCase()] || '',
        report.location || '',
        report.panel || '',
        report.circuit || '',
        report.notes || ''
      ]);

      const headers = ['Material', 'Quantity', 'Unit', 'Location', 'Panel', 'Circuit', 'Notes'];
      const dateStr = new Date(filterDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      await generateExcel(data, dateStr, `daily-report-${filterDate}`, headers);
      Alert.alert('Success', 'Excel file exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export Excel. Please try again.');
    }
  }, [filtered, filterDate, materialUnitMap]);

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={[styles.title, { color: t.colors.text }]}>Daily Report</Text>
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
          placeholder="Material name"
          containerStyle={{ marginBottom: 12, zIndex: 10000, elevation: 10 }}
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
        <Text style={[styles.label, { color: t.colors.textSecondary }]}>Location</Text>
        <AutocompleteInput
          data={allowedLocations}
          value={location}
          onChange={setLocation}
          onSelect={(item) => setLocation(item.label)}
          onBlur={(currentVal) => {
            if (!isInList(currentVal, allowedLocations)) {
              setLocation('');
              setMessage('Select location from dropdown');
            }
          }}
          placeholder="Select location"
          containerStyle={{ marginBottom: 12, zIndex: 9000, elevation: 9 }}
        />

        <Text style={[styles.label, { color: t.colors.textSecondary }]}>Panel</Text>
        <AutocompleteInput
          data={uniquePanels}
          value={panel}
          onChange={setPanel}
          onSelect={(item) => {
            setPanel(item.label);
            setCircuit('');
          }}
          onBlur={(currentVal) => {
            if (currentVal && !isInList(currentVal, uniquePanels)) {
              setPanel('');
              setCircuit('');
              setMessage('Select panel from dropdown');
            }
          }}
          placeholder="Panel name"
          containerStyle={{ marginBottom: 12, zIndex: 8000, elevation: 8 }}
        />

        <Text style={[styles.label, { color: t.colors.textSecondary }]}>Circuit</Text>
        <AutocompleteInput
          data={panelCircuits}
          value={circuit}
          onChange={setCircuit}
          onSelect={(item) => setCircuit(item.label)}
          onBlur={(currentVal) => {
            if (currentVal && !isInList(currentVal, panelCircuits)) {
              setCircuit('');
              setMessage('Select circuit from dropdown');
            }
          }}
          placeholder="Circuit"
          containerStyle={{ marginBottom: 12, zIndex: 7000, elevation: 7 }}
        />
        <Text style={[styles.label, { color: t.colors.textSecondary }]}>Notes</Text>
        <TextInput
          style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
          placeholder="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholderTextColor={t.colors.textSecondary}
        />
        <Button title={editingId ? 'Update Report' : 'Save Report'} onPress={handleSubmit} />
        {message ? <Text style={[styles.message, { color: t.colors.text }]}>{message}</Text> : null}

        <React.Fragment>
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
          {loading || filtered.length > 0 ? (
            <>
              <Text style={[styles.tableTitle, { color: t.colors.text }]}>Saved Reports</Text>
              <View style={[styles.table, { borderColor: t.colors.border }]}>
                <FlatList
                  data={loading ? Array.from({ length: 5 }).map((_, idx) => ({ id: `report-skeleton-${idx}`, __skeleton: true })) : filtered}
                  keyExtractor={(item) => (item.__skeleton ? item.id : item._id)}
                  scrollEnabled={false}
                  initialNumToRender={6}
                  maxToRenderPerBatch={6}
                  windowSize={7}
                  removeClippedSubviews
                  ListHeaderComponent={
                    <View
                      style={[
                        styles.row,
                        styles.headerRow,
                        { backgroundColor: t.colors.card, borderColor: t.colors.border }
                      ]}
                    >
                      <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Material</Text>
                      <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Qty</Text>
                      <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Location</Text>
                      <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Panel</Text>
                      <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Circuit</Text>
                      <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Notes</Text>
                      <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Action</Text>
                    </View>
                  }
                  renderItem={renderReportItem}
                  getItemLayout={getItemLayout}
                />
              </View>
              {!loading && filtered.length > 0 && (
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
            </>
          ) : (
            <EmptyState
              icon="document-text-outline"
              title="No reports for this date"
              subtitle="Create your first daily report to see it here."
            />
          )}
        </React.Fragment>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  label: { marginBottom: 6, color: '#374151', fontWeight: '600' },
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
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', minHeight: REPORT_ROW_HEIGHT },
  headerRow: { backgroundColor: '#f3f4f6' },
  cell: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: '#111827' },
  headerCell: { fontWeight: '700', color: '#374151' },
  actionCell: { flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center' },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#e0f2fe' },
  actionText: { color: '#0369a1', fontWeight: '600' },
  deleteBtn: { backgroundColor: '#fee2e2' },
  deleteText: { color: '#b91c1c' },
  muted: { color: '#6b7280', marginBottom: 8 },
  // Empty/skeleton styles moved to shared components
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  smallBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  filterInput: { flex: 1, marginBottom: 0 },
  selectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  selectChip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff'
  },
  selectChipActive: { borderColor: '#2563eb', backgroundColor: '#e0e7ff' },
  selectText: { color: '#111827' },
  selectTextActive: { color: '#1d4ed8', fontWeight: '700' },
  inputWrapper: { position: 'relative', marginBottom: 12 },
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

export default DailyReportScreen;
