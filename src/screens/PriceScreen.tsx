// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Screen from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import Button from '../components/ui/Button';
import AutocompleteInput from '../components/ui/AutocompleteInput';
import EmptyState from '../components/ui/EmptyState';
import SkeletonBar from '../components/ui/SkeletonBar';
import { fetchAllDailyReportsInRange } from '../utils/dailyReportsFetch';

const PriceScreen = () => {
  const { request } = useAuth();
  const t = useThemeTokens();
  const { t: tr } = useI18n();
  const isFocused = useIsFocused();

  const [reports, setReports] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const isInList = (val, list) =>
    !!val && list.some((item) => (item || '').toLowerCase() === val.trim().toLowerCase());

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [locationFilter, setLocationFilter] = useState('');
  const [panelFilter, setPanelFilter] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allReports, materialRes] = await Promise.all([
        fetchAllDailyReportsInRange(request, startDate, endDate),
        request('/api/materials?limit=2000')
      ]);
      setReports(allReports);
      setMaterials(materialRes.materials || []);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }, [request, startDate, endDate]);

  useEffect(() => {
    if (!isFocused) return;
    loadData();
  }, [isFocused, loadData]);

  const shiftDate = (dateStr, days) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().substring(0, 10);
  };

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const rDate = new Date(r.date).toISOString().substring(0, 10);
      const inDateRange = rDate >= startDate && rDate <= endDate;
      if (!inDateRange) return false;
      if (locationFilter && r.location !== locationFilter) return false;
      if (panelFilter && r.panel !== panelFilter) return false;
      return true;
    });
  }, [reports, startDate, endDate, locationFilter, panelFilter]);

  const aggregates = useMemo(() => {
    const materialMap = materials.reduce((acc, m) => {
      acc[m.name.toLowerCase()] = m;
      return acc;
    }, {});

    const groups = filteredReports.reduce((acc, r) => {
      const name = (r.materialName || r.summary || '').toLowerCase();
      if (!acc[name]) {
        const matInfo = materialMap[name] || {};
        acc[name] = {
          name: r.materialName || r.summary || tr('price.na'),
          quantity: 0,
          unit: matInfo.unit || 'pcs',
          labourPricePerUnit: Number(matInfo.labourPrice) || 0,
          materialPricePerUnit: Number(matInfo.materialPrice) || 0
        };
      }
      acc[name].quantity += Number(r.quantity || 0);
      return acc;
    }, {});

    return Object.values(groups).map(item => ({
      ...item,
      totalLabour: Math.round(item.quantity * item.labourPricePerUnit * 100) / 100,
      totalMaterial: Math.round(item.quantity * item.materialPricePerUnit * 100) / 100
    })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [filteredReports, materials, tr]);

  const grandTotals = useMemo(() => {
    return aggregates.reduce((acc, item) => {
      acc.quantity += item.quantity;
      acc.labour += (item.totalLabour || 0);
      acc.material += (item.totalMaterial || 0);
      return acc;
    }, { quantity: 0, labour: 0, material: 0 });
  }, [aggregates]);

  const availableLocations = useMemo(() => 
    Array.from(new Set(reports.map(r => r.location).filter(Boolean))), 
  [reports]);

  const availablePanels = useMemo(() => 
    Array.from(new Set(reports.map(r => r.panel).filter(Boolean))), 
  [reports]);

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={[styles.title, { color: t.colors.text }]}>{tr('price.title')}</Text>
        
        <View style={styles.filterSection}>
          <Text style={[styles.sectionTitle, { color: t.colors.primary }]}>{tr('price.dateRange')}</Text>
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.miniLabel, { color: t.colors.textSecondary }]}>{tr('price.from')}</Text>
              <View style={styles.datePicker}>
                <Pressable onPress={() => setStartDate(prev => shiftDate(prev, -1))} style={[styles.dateBtn, { zIndex: 1 }]}>
                  <Text style={{ color: t.colors.text }}>◀</Text>
                </Pressable>
                <TextInput
                  style={[styles.dateInput, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.card }]}
                  value={startDate}
                  onChangeText={setStartDate}
                />
                <Pressable onPress={() => setStartDate(prev => shiftDate(prev, 1))} style={[styles.dateBtn, { zIndex: 1 }]}>
                  <Text style={{ color: t.colors.text }}>▶</Text>
                </Pressable>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.miniLabel, { color: t.colors.textSecondary }]}>{tr('price.to')}</Text>
              <View style={styles.datePicker}>
                <Pressable onPress={() => setEndDate(prev => shiftDate(prev, -1))} style={[styles.dateBtn, { zIndex: 1 }]}>
                  <Text style={{ color: t.colors.text }}>◀</Text>
                </Pressable>
                <TextInput
                  style={[styles.dateInput, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.card }]}
                  value={endDate}
                  onChangeText={setEndDate}
                />
                <Pressable onPress={() => setEndDate(prev => shiftDate(prev, 1))} style={[styles.dateBtn, { zIndex: 1 }]}>
                  <Text style={{ color: t.colors.text }}>▶</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={[styles.sectionTitle, { color: t.colors.primary }]}>{tr('price.filters')}</Text>
          <View style={styles.inputGrid}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: t.colors.textSecondary }]}>{tr('price.location')}</Text>
              <AutocompleteInput
                data={availableLocations}
                value={locationFilter}
                onChange={setLocationFilter}
                onSelect={(item) => {
                  setLocationFilter(item.label);
                  setPanelFilter(''); // reset panel when location is chosen
                }}
                onBlur={(currentVal) => {
                  if (currentVal && !isInList(currentVal, availableLocations)) {
                    setLocationFilter('');
                  }
                }}
                placeholder={tr('price.allLocations')}
                containerStyle={{ marginBottom: 12, zIndex: 30000, position: 'relative', elevation: 30 }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: t.colors.textSecondary }]}>{tr('price.panel')}</Text>
              <AutocompleteInput
                data={availablePanels}
                value={panelFilter}
                onChange={setPanelFilter}
                onSelect={(item) => {
                  setPanelFilter(item.label);
                  setLocationFilter(''); // reset location when panel is chosen
                }}
                onBlur={(currentVal) => {
                  if (currentVal && !isInList(currentVal, availablePanels)) {
                    setPanelFilter('');
                  }
                }}
                placeholder={tr('price.allPanels')}
                containerStyle={{ marginBottom: 12, zIndex: 25000, position: 'relative', elevation: 30 }}
              />
            </View>
          </View>
          <View style={{ marginTop: 12, position: 'relative', zIndex: 0 }}>
            <Button title={tr('price.resetFilters')} variant="secondary" onPress={() => { setLocationFilter(''); setPanelFilter(''); }} />
          </View>
        </View>

        <View style={[styles.totalCard, { backgroundColor: t.colors.card, borderColor: t.colors.primary }]}>
          <View style={styles.totalItem}>
            <Text style={[styles.totalLabel, { color: t.colors.textSecondary }]}>{tr('price.filteredQty')}</Text>
            <Text style={[styles.totalValue, { color: t.colors.text }]}>{grandTotals.quantity.toLocaleString()}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: t.colors.border }]} />
          <View style={styles.totalItem}>
            <Text style={[styles.totalLabel, { color: t.colors.textSecondary }]}>{tr('price.totalMaterialPrice')}</Text>
            <Text style={[styles.totalValue, { color: t.colors.primary }]}>RON {grandTotals.material.toFixed(2)}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: t.colors.border }]} />
          <View style={styles.totalItem}>
            <Text style={[styles.totalLabel, { color: t.colors.textSecondary }]}>{tr('price.totalLabourPrice')}</Text>
            <Text style={[styles.totalValue, { color: t.colors.primary }]}>RON {grandTotals.labour.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={[styles.tableHeader, { color: t.colors.text }]}>
          {tr('price.materialSummary')}
        </Text>
        {loading ? <Text style={{ color: t.colors.textSecondary, marginBottom: 8 }}>{tr('price.updating')}</Text> : null}
        {message ? <Text style={{ color: t.colors.danger, marginBottom: 8 }}>{message}</Text> : null}

        <View style={[styles.table, { borderColor: t.colors.border }]}>
          <View style={[styles.row, styles.headerRow, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.cell, styles.headerCell, { color: t.colors.text, flex: 1.5 }]}>{tr('price.colMaterial')}</Text>
            <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>{tr('price.colQty')}</Text>
            <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>{tr('price.colMaterialPrice')}</Text>
            <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>{tr('price.colLabourPrice')}</Text>
          </View>

          {loading
            ? Array.from({ length: 6 }).map((_, idx) => (
                <View key={`price-skeleton-${idx}`} style={[styles.row, { borderColor: t.colors.border }]}>
                  <View style={[styles.cell, { flex: 1.5 }]}><SkeletonBar width="80%" height={12} /></View>
                  <View style={styles.cell}><SkeletonBar width="50%" height={12} /></View>
                  <View style={styles.cell}><SkeletonBar width="60%" height={12} /></View>
                  <View style={styles.cell}><SkeletonBar width="60%" height={12} /></View>
                </View>
              ))
            : aggregates.map((item, idx) => (
                <View key={idx} style={[styles.row, { borderColor: t.colors.border }]}>
                  <Text style={[styles.cell, { color: t.colors.text, flex: 1.5 }]}>{item.name}</Text>
                  <Text style={[styles.cell, { color: t.colors.text }]}>{item.quantity} {item.unit}</Text>
                  <Text style={[styles.cell, { color: t.colors.text }]}>{item.totalMaterial.toFixed(2)}</Text>
                  <Text style={[styles.cell, { color: t.colors.text }]}>{item.totalLabour.toFixed(2)}</Text>
                </View>
              ))}

          {aggregates.length > 0 ? (
            <View style={[styles.row, { backgroundColor: t.colors.card, borderTopWidth: 2, borderColor: t.colors.primary }]}>
              <Text style={[styles.cell, { color: t.colors.text, flex: 1.5, fontWeight: '800' }]}>{tr('price.totalRow').toUpperCase()}</Text>
              <Text style={[styles.cell, { color: t.colors.text, fontWeight: '800' }]}></Text>
              <Text style={[styles.cell, { color: t.colors.primary, fontWeight: '800' }]}>{grandTotals.material.toFixed(2)}</Text>
              <Text style={[styles.cell, { color: t.colors.primary, fontWeight: '800' }]}>{grandTotals.labour.toFixed(2)}</Text>
            </View>
          ) : null}

          {aggregates.length === 0 && !loading ? (
            <EmptyState
              icon="cash-outline"
              title={tr('price.emptyTitle')}
              subtitle={tr('price.emptySubtitle')}
            />
          ) : null}
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 20 },
  label: { marginBottom: 6, fontWeight: '600' },
  filterSection: { marginBottom: 24, overflow: 'visible' },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  miniLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4, marginLeft: 2 },
  dateRow: { flexDirection: 'row', gap: 12 },
  datePicker: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateBtn: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
  dateInput: { flex: 1, height: 40, borderWidth: 1, borderRadius: 8, textAlign: 'center', fontSize: 13 },
  inputGrid: { flexDirection: 'row', gap: 12, overflow: 'visible', position: 'relative', zIndex: 20000 },
  totalCard: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 24,
    alignItems: 'center'
  },
  totalItem: { flex: 1, alignItems: 'center' },
  totalLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  totalValue: { fontSize: 20, fontWeight: '800' },
  divider: { width: 1, height: '80%', marginHorizontal: 10 },
  tableHeader: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  table: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', borderBottomWidth: 1, alignItems: 'center' },
  headerRow: { },
  cell: { flex: 1, paddingVertical: 14, paddingHorizontal: 10, fontSize: 14 },
  headerCell: { fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },
  muted: { textAlign: 'center' }
});

export default PriceScreen;
