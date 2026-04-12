// @ts-nocheck
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { elevation } from '../theme/elevation';

const buildDefaultColumns = (tr) => [
  { id: 'col_1', title: tr('isolation.colDate') },
  { id: 'col_2', title: tr('isolation.colCircuit') },
  { id: 'col_3', title: tr('isolation.colCable') },
  { id: 'col_4', title: tr('isolation.colL12') },
  { id: 'col_5', title: tr('isolation.colL23') },
  { id: 'col_6', title: tr('isolation.colL31') },
  { id: 'col_7', title: tr('isolation.colL1E') },
  { id: 'col_8', title: tr('isolation.colL2E') },
  { id: 'col_9', title: tr('isolation.colL3E') },
  { id: 'col_10', title: tr('isolation.colL1N') },
  { id: 'col_11', title: tr('isolation.colL2N') },
  { id: 'col_12', title: tr('isolation.colL3N') },
  { id: 'col_13', title: tr('isolation.colNE') },
  { id: 'col_14', title: tr('isolation.colVoltage') },
  { id: 'col_15', title: tr('isolation.colResult') },
  { id: 'col_16', title: tr('isolation.colRemarks') }
];

const MEGAOHM_COL_IDS = new Set([
  'col_4', 'col_5', 'col_6', 'col_7', 'col_8', 'col_9',
  'col_10', 'col_11', 'col_12', 'col_13'
]);

const MEGAOHM_COL_LABELS = {
  col_4: 'L1-L2', col_5: 'L2-L3', col_6: 'L3-L1',
  col_7: 'L1-E', col_8: 'L2-E', col_9: 'L3-E',
  col_10: 'L1-N', col_11: 'L2-N', col_12: 'L3-N',
  col_13: 'N-E'
};

const computeResult = (cells) => {
  const failedCols = [];
  let hasValue = false;
  for (const colId of MEGAOHM_COL_IDS) {
    const raw = (cells[colId] ?? '').trim();
    if (raw === '') continue;
    const num = parseFloat(raw);
    if (isNaN(num)) continue;
    hasValue = true;
    if (num < 1) failedCols.push(MEGAOHM_COL_LABELS[colId] || colId);
  }
  if (!hasValue) return { result: '', remarks: '' };
  if (failedCols.length > 0) {
    return { result: 'FAIL', remarks: `Low IR: ${failedCols.join(', ')}` };
  }
  return { result: 'PASS', remarks: '' };
};

const todayString = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

let globalColCounter = 16;

const makeEmptyRow = (columns, index, circuitInfo) => {
  const cells = {};
  columns.forEach((c) => { cells[c.id] = ''; });
  if (circuitInfo) {
    if (typeof circuitInfo === 'string') {
      cells.col_2 = circuitInfo;
    } else {
      cells.col_2 = circuitInfo.circuit || '';
      cells.col_3 = circuitInfo.cableSize || '';
    }
  }
  return { id: `row_${Date.now()}_${index}`, cells };
};

const createPanelFromRecords = (name, records, columnDefs) => ({
  id: `panel_${Date.now()}_${name.replace(/\s/g, '_')}`,
  name,
  columns: columnDefs.map((c) => ({ ...c })),
  rows: records.length > 0
    ? records.map((rec, i) => makeEmptyRow(columnDefs, i, rec))
    : [makeEmptyRow(columnDefs, 0)],
  collapsed: false
});

const mergePanelDbWithTests = (panelRecords, existingTestPanels, columnDefs) => {
  const grouped = {};
  for (const rec of panelRecords) {
    const key = rec.name;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({ circuit: rec.circuit, cableSize: rec.cableSize || '' });
  }

  const existingByName = {};
  for (const tp of existingTestPanels) {
    existingByName[tp.name] = tp;
  }

  const merged = [];
  const processedNames = new Set();

  for (const [panelName, records] of Object.entries(grouped)) {
    processedNames.add(panelName);
    const existing = existingByName[panelName];

    if (existing) {
      const existingCircuits = new Set(
        existing.rows.map((r) => (r.cells?.col_2 ?? '').trim().toLowerCase()).filter(Boolean)
      );
      const newRecords = records.filter(
        (r) => !existingCircuits.has(r.circuit.trim().toLowerCase())
      );
      const additionalRows = newRecords.map((r, i) =>
        makeEmptyRow(existing.columns || columnDefs, existing.rows.length + i, r)
      );
      merged.push({
        ...existing,
        rows: [...existing.rows, ...additionalRows]
      });
    } else {
      merged.push(createPanelFromRecords(panelName, records, columnDefs));
    }
  }

  for (const tp of existingTestPanels) {
    if (!processedNames.has(tp.name)) {
      merged.push(tp);
    }
  }

  return merged;
};

const COL_WIDTH = 140;
const ROW_NUM_WIDTH = 48;

// ─── Single panel table ───────────────────────────────────────────────
const PanelTable = ({ panel, onUpdate, onDelete, totalPanels, tr }) => {
  const t = useThemeTokens();
  const [editingCell, setEditingCell] = useState(null);
  const [editingHeader, setEditingHeader] = useState(null);
  const [newColName, setNewColName] = useState('');
  const [showColInput, setShowColInput] = useState(false);
  const [editingName, setEditingName] = useState(false);

  const { columns, rows, collapsed } = panel;

  const patch = (fields) => onUpdate({ ...panel, ...fields });

  const toggleCollapse = () => patch({ collapsed: !collapsed });

  const handleNameChange = (name) => patch({ name });

  const handleCellChange = (rowId, colId, value) => {
    patch({
      rows: rows.map((r) => {
        if (r.id !== rowId) return r;
        const updatedCells = { ...r.cells, [colId]: value };

        if (MEGAOHM_COL_IDS.has(colId)) {
          const { result, remarks } = computeResult(updatedCells);
          updatedCells.col_15 = result;
          updatedCells.col_16 = remarks;
          if (value.trim() && !updatedCells.col_1) {
            updatedCells.col_1 = todayString();
          }
        }

        return { ...r, cells: updatedCells };
      })
    });
  };

  const handleHeaderChange = (colId, value) => {
    patch({
      columns: columns.map((c) => (c.id === colId ? { ...c, title: value } : c))
    });
  };

  const addRow = () => {
    patch({ rows: [...rows, makeEmptyRow(columns, rows.length)] });
  };

  const deleteRow = (rowId) => {
    if (rows.length <= 1) return;
    const doDelete = () => patch({ rows: rows.filter((r) => r.id !== rowId) });
    if (Platform.OS === 'web') {
      if (window.confirm(tr('isolation.deleteRowMsg'))) doDelete();
    } else {
      Alert.alert(tr('isolation.deleteRowTitle'), tr('isolation.deleteRowMsg'), [
        { text: tr('common.cancel'), style: 'cancel' },
        { text: tr('common.delete'), style: 'destructive', onPress: doDelete }
      ]);
    }
  };

  const addColumn = () => {
    const name = newColName.trim();
    if (!name) return;
    globalColCounter += 1;
    const id = `col_${globalColCounter}`;
    patch({
      columns: [...columns, { id, title: name }],
      rows: rows.map((r) => ({ ...r, cells: { ...r.cells, [id]: '' } }))
    });
    setNewColName('');
    setShowColInput(false);
  };

  const deleteColumn = (colId) => {
    if (columns.length <= 1) return;
    const doDelete = () => {
      patch({
        columns: columns.filter((c) => c.id !== colId),
        rows: rows.map((r) => {
          const cells = { ...r.cells };
          delete cells[colId];
          return { ...r, cells };
        })
      });
    };
    if (Platform.OS === 'web') {
      if (window.confirm(tr('isolation.deleteColMsg'))) doDelete();
    } else {
      Alert.alert(tr('isolation.deleteColTitle'), tr('isolation.deleteColMsg'), [
        { text: tr('common.cancel'), style: 'cancel' },
        { text: tr('common.delete'), style: 'destructive', onPress: doDelete }
      ]);
    }
  };

  const confirmDeletePanel = () => {
    if (totalPanels <= 1) return;
    const doIt = () => onDelete(panel.id);
    if (Platform.OS === 'web') {
      if (window.confirm(tr('isolation.deletePanelMsg', { name: panel.name }))) doIt();
    } else {
      Alert.alert(tr('isolation.deletePanelTitle'), tr('isolation.deletePanelMsg', { name: panel.name }), [
        { text: tr('common.cancel'), style: 'cancel' },
        { text: tr('common.delete'), style: 'destructive', onPress: doIt }
      ]);
    }
  };

  const tableWidth = ROW_NUM_WIDTH + columns.length * COL_WIDTH + 40;

  return (
    <View style={[styles.panelCard, elevation.medium, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
      <Pressable
        style={[styles.panelHeader, { borderColor: t.colors.border }]}
        onPress={toggleCollapse}
      >
        <View style={styles.panelHeaderLeft}>
          <Ionicons
            name={collapsed ? 'chevron-forward' : 'chevron-down'}
            size={18}
            color={t.colors.primary}
          />
          {editingName ? (
            <TextInput
              style={[styles.panelNameInput, { color: t.colors.text, borderColor: t.colors.primary }]}
              value={panel.name}
              onChangeText={handleNameChange}
              onBlur={() => setEditingName(false)}
              onSubmitEditing={() => setEditingName(false)}
              autoFocus
              selectTextOnFocus
            />
          ) : (
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); setEditingName(true); }}
              onLongPress={() => setEditingName(true)}
            >
              <Text style={[styles.panelName, { color: t.colors.text }]}>{panel.name}</Text>
            </Pressable>
          )}
          <View style={[styles.badge, { backgroundColor: t.colors.primary + '15' }]}>
            <Text style={[styles.badgeText, { color: t.colors.primary }]}>
              {rows.length === 1
                ? tr('isolation.cableOne', { count: rows.length })
                : tr('isolation.cableMany', { count: rows.length })}
            </Text>
          </View>
        </View>
        <View style={styles.panelHeaderRight}>
          <Pressable
            style={styles.panelIconBtn}
            onPress={(e) => { e.stopPropagation?.(); setEditingName(true); }}
            hitSlop={6}
          >
            <Ionicons name="pencil-outline" size={15} color={t.colors.textSecondary} />
          </Pressable>
          {totalPanels > 1 && (
            <Pressable
              style={styles.panelIconBtn}
              onPress={(e) => { e.stopPropagation?.(); confirmDeletePanel(); }}
              hitSlop={6}
            >
              <Ionicons name="trash-outline" size={15} color={t.colors.danger} />
            </Pressable>
          )}
        </View>
      </Pressable>

      {collapsed ? null : (
        <View style={styles.panelBody}>
          <View style={styles.toolbar}>
            <Pressable
              style={[styles.toolBtn, { backgroundColor: t.colors.primary }]}
              onPress={addRow}
            >
              <Ionicons name="add" size={16} color={t.colors.onPrimary} />
              <Text style={[styles.toolBtnText, { color: t.colors.onPrimary }]}>{tr('isolation.row')}</Text>
            </Pressable>

            {showColInput ? (
              <View style={[styles.colInputWrap, { borderColor: t.colors.border, backgroundColor: t.colors.surface }]}>
                <TextInput
                  style={[styles.colInput, { color: t.colors.text }]}
                  placeholder={tr('isolation.colPlaceholder')}
                  placeholderTextColor={t.colors.muted}
                  value={newColName}
                  onChangeText={setNewColName}
                  onSubmitEditing={addColumn}
                  autoFocus
                />
                <Pressable style={[styles.colInputBtn, { backgroundColor: t.colors.primary }]} onPress={addColumn}>
                  <Ionicons name="checkmark" size={16} color={t.colors.onPrimary} />
                </Pressable>
                <Pressable
                  style={[styles.colInputBtn, { backgroundColor: t.colors.danger }]}
                  onPress={() => { setShowColInput(false); setNewColName(''); }}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[styles.toolBtn, { backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border }]}
                onPress={() => setShowColInput(true)}
              >
                <Ionicons name="add" size={16} color={t.colors.primary} />
                <Text style={[styles.toolBtnText, { color: t.colors.text }]}>{tr('isolation.column')}</Text>
              </Pressable>
            )}
          </View>

          <View style={[styles.tableContainer, { borderColor: t.colors.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={{ minWidth: tableWidth }}>
                <View style={[styles.headerRow, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
                  <View style={[styles.rowNumHeader, { width: ROW_NUM_WIDTH, borderColor: t.colors.border }]}>
                    <Text style={[styles.rowNumText, { color: t.colors.muted }]}>#</Text>
                  </View>
                  {columns.map((col) => {
                    const isEditing = editingHeader === col.id;
                    return (
                      <View key={col.id} style={[styles.headerCell, { width: COL_WIDTH, borderColor: t.colors.border }]}>
                        {isEditing ? (
                          <TextInput
                            style={[styles.headerInput, { color: t.colors.text }]}
                            value={col.title}
                            onChangeText={(v) => handleHeaderChange(col.id, v)}
                            onBlur={() => setEditingHeader(null)}
                            onSubmitEditing={() => setEditingHeader(null)}
                            autoFocus
                            selectTextOnFocus
                          />
                        ) : (
                          <Pressable style={styles.headerContent} onPress={() => setEditingHeader(col.id)}>
                            <Text style={[styles.headerText, { color: t.colors.text }]} numberOfLines={2}>
                              {col.title}
                            </Text>
                          </Pressable>
                        )}
                        {columns.length > 1 && (
                          <Pressable style={styles.deleteColBtn} onPress={() => deleteColumn(col.id)} hitSlop={6}>
                            <Ionicons name="close-circle" size={14} color={t.colors.danger} />
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                  <View style={styles.deleteColPlaceholder} />
                </View>

                {rows.map((row, rowIndex) => (
                  <View
                    key={row.id}
                    style={[
                      styles.bodyRow,
                      { backgroundColor: rowIndex % 2 === 0 ? t.colors.card : t.colors.surface, borderColor: t.colors.border }
                    ]}
                  >
                    <View style={[styles.rowNumCell, { width: ROW_NUM_WIDTH, borderColor: t.colors.border }]}>
                      <Text style={[styles.rowNumText, { color: t.colors.muted }]}>{rowIndex + 1}</Text>
                    </View>
                    {columns.map((col) => {
                      const cellKey = `${row.id}_${col.id}`;
                      const isEditing = editingCell === cellKey;
                      const value = row.cells[col.id] ?? '';
                      const isReadOnly = col.id === 'col_15' || col.id === 'col_16' || col.id === 'col_1';

                      let cellColor = value ? t.colors.text : t.colors.muted;
                      if (col.id === 'col_15' && value) {
                        cellColor = value === 'PASS' ? t.colors.success : t.colors.danger;
                      }

                      return (
                        <View key={cellKey} style={[styles.cell, { width: COL_WIDTH, borderColor: t.colors.border }]}>
                          {isReadOnly ? (
                            <View style={styles.cellTouchable}>
                              <Text
                                style={[
                                  styles.cellText,
                                  { color: cellColor, fontWeight: col.id === 'col_15' && value ? '700' : undefined }
                                ]}
                                numberOfLines={2}
                              >
                                {value
                                  ? col.id === 'col_15'
                                    ? value === 'PASS'
                                      ? tr('isolation.passLabel')
                                      : value === 'FAIL'
                                        ? tr('isolation.failLabel')
                                        : value
                                    : value
                                  : col.id === 'col_15'
                                    ? '—'
                                    : col.id === 'col_1'
                                      ? tr('isolation.autoValue')
                                      : col.id === 'col_16'
                                        ? '—'
                                        : ''}
                              </Text>
                            </View>
                          ) : isEditing ? (
                            <TextInput
                              style={[styles.cellInput, { color: t.colors.text }]}
                              value={value}
                              onChangeText={(v) => handleCellChange(row.id, col.id, v)}
                              onBlur={() => setEditingCell(null)}
                              onSubmitEditing={() => setEditingCell(null)}
                              autoFocus
                              selectTextOnFocus
                            />
                          ) : (
                            <Pressable style={styles.cellTouchable} onPress={() => setEditingCell(cellKey)}>
                              <Text
                                style={[styles.cellText, { color: cellColor }]}
                                numberOfLines={2}
                              >
                                {value || tr('isolation.tapEdit')}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                    <Pressable style={styles.deleteRowBtn} onPress={() => deleteRow(row.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={16} color={rows.length > 1 ? t.colors.danger : t.colors.muted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          <Pressable style={[styles.addRowBar, { borderColor: t.colors.border }]} onPress={addRow}>
            <Ionicons name="add-circle-outline" size={18} color={t.colors.primary} />
            <Text style={[styles.addRowText, { color: t.colors.primary }]}>{tr('isolation.addRow')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

// ─── Serialize panels for API (convert Map-like cells to plain objects) ──
const serializePanels = (panels) =>
  panels.map((p) => ({
    ...p,
    rows: p.rows.map((r) => ({
      ...r,
      cells: typeof r.cells?.toJSON === 'function' ? r.cells.toJSON() : { ...r.cells }
    }))
  }));

// ─── Main screen ──────────────────────────────────────────────────────
const IsolationTestScreen = () => {
  const t = useThemeTokens();
  const { t: tr } = useI18n();
  const { request } = useAuth();
  const [panels, setPanels] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const saveTimer = useRef(null);
  const panelsRef = useRef(panels);

  useEffect(() => { panelsRef.current = panels; }, [panels]);

  const showStatus = (msg) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 2500);
  };

  // ── Load panel DB + existing test data, then merge ──
  const loadPanels = useCallback(async () => {
    try {
      setLoading(true);
      const [panelDbData, testData] = await Promise.all([
        request('/api/panels').catch(() => ({ panels: [] })),
        request('/api/isolation-tests').catch(() => ({ panels: [] })),
      ]);

      const panelRecords = panelDbData?.panels || [];
      const existingTests = testData?.panels || [];

      // Isolation tables only follow the Panel page. If there are no panels in
      // the DB, do not show orphaned rows from old isolation-test saves.
      if (panelRecords.length === 0) {
        setPanels([]);
        return;
      }

      const merged = mergePanelDbWithTests(panelRecords, existingTests, buildDefaultColumns(tr));
      setPanels(merged);
    } catch {
      setPanels([]);
    } finally {
      setLoading(false);
    }
  }, [request, tr]);

  useFocusEffect(
    useCallback(() => {
      loadPanels();
    }, [loadPanels])
  );

  // ── Auto-save with debounce ──
  const debounceSave = useCallback(
    (updatedPanels) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          setSaving(true);
          await request('/api/isolation-tests', {
            method: 'PUT',
            body: { panels: serializePanels(updatedPanels) }
          });
          showStatus(tr('isolation.saved'));
        } catch {
          showStatus(tr('isolation.saveFailed'));
        } finally {
          setSaving(false);
        }
      }, 1200);
    },
    [request, tr]
  );

  const updatePanels = useCallback(
    (next) => {
      setPanels(next);
      debounceSave(next);
    },
    [debounceSave]
  );

  const filteredPanels = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return panels;
    return panels.filter((p) => p.name.toLowerCase().includes(q));
  }, [panels, search]);

  const updatePanel = useCallback(
    (updated) => {
      const next = panels.map((p) => (p.id === updated.id ? updated : p));
      updatePanels(next);
    },
    [panels, updatePanels]
  );

  const deletePanel = useCallback(
    (id) => {
      const next = panels.filter((p) => p.id !== id);
      updatePanels(next);
    },
    [panels, updatePanels]
  );

  const matchCount = filteredPanels.length;
  const hasSearch = search.trim().length > 0;

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={t.colors.primary} />
          <Text style={[styles.loadingText, { color: t.colors.textSecondary }]}>{tr('isolation.loading')}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: t.colors.text }]}>{tr('isolation.title')}</Text>
            {saving ? (
              <View style={styles.savingBadge}>
                <ActivityIndicator size="small" color={t.colors.primary} />
                <Text style={[styles.savingText, { color: t.colors.primary }]}>{tr('isolation.saving')}</Text>
              </View>
            ) : statusMsg ? (
              <View style={[styles.savingBadge, { backgroundColor: t.colors.success + '18' }]}>
                <Ionicons name="checkmark-circle" size={14} color={t.colors.success} />
                <Text style={[styles.savingText, { color: t.colors.success }]}>{statusMsg}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.subtitle, { color: t.colors.textSecondary }]}>{tr('isolation.subtitle')}</Text>
        </View>

        <View style={[styles.searchBar, elevation.subtle, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <Ionicons name="search" size={18} color={t.colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: t.colors.text }]}
            placeholder={tr('isolation.searchPlaceholder')}
            placeholderTextColor={t.colors.muted}
            value={search}
            onChangeText={setSearch}
          />
          {hasSearch ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={t.colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {hasSearch && (
          <Text style={[styles.searchResult, { color: t.colors.textSecondary }]}>
            {matchCount === 0
              ? tr('isolation.searchNoMatch', { q: search.trim() })
              : matchCount === 1
                ? tr('isolation.panelsFoundOne', { count: matchCount })
                : tr('isolation.panelsFoundMany', { count: matchCount })}
          </Text>
        )}

        <View style={[styles.syncBanner, { borderColor: t.colors.border, backgroundColor: t.colors.surface }]}>
          <Ionicons name="sync-outline" size={16} color={t.colors.primary} />
          <Text style={[styles.syncText, { color: t.colors.textSecondary }]}>
            Panels and circuits are synced from the Panel page
          </Text>
        </View>

        {filteredPanels.map((panel) => (
          <PanelTable
            key={panel.id}
            panel={panel}
            onUpdate={updatePanel}
            onDelete={deletePanel}
            totalPanels={panels.length}
            tr={tr}
          />
        ))}

        {panels.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="flask-outline" size={48} color={t.colors.muted} />
            <Text style={[styles.emptyText, { color: t.colors.textSecondary }]}>{tr('isolation.emptyPanels')}</Text>
          </View>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  header: { marginBottom: 16, marginTop: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4 },

  savingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  savingText: { fontSize: 12, fontWeight: '600' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  loadingText: { fontSize: 14 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    gap: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
    margin: 0
  },
  searchResult: {
    fontSize: 12,
    marginBottom: 8,
    marginLeft: 4
  },

  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16
  },
  syncText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1
  },

  panelCard: {
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden'
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1
  },
  panelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  panelHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  panelName: {
    fontSize: 16,
    fontWeight: '700'
  },
  panelNameInput: {
    fontSize: 16,
    fontWeight: '700',
    borderBottomWidth: 2,
    paddingVertical: 2,
    paddingHorizontal: 4,
    minWidth: 100
  },
  panelIconBtn: {
    padding: 4
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  panelBody: {
    padding: 10
  },

  toolbar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  toolBtnText: { fontSize: 13, fontWeight: '700' },

  colInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden'
  },
  colInput: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    minWidth: 120
  },
  colInputBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },

  tableContainer: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden'
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 2
  },
  rowNumHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    paddingVertical: 10
  },
  headerCell: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    justifyContent: 'center'
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center'
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase'
  },
  headerInput: {
    fontSize: 12,
    fontWeight: '700',
    padding: 0,
    margin: 0,
    letterSpacing: 0.3
  },
  deleteColBtn: {
    position: 'absolute',
    top: 2,
    right: 2
  },
  bodyRow: {
    flexDirection: 'row',
    borderBottomWidth: 1
  },
  rowNumCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    paddingVertical: 10
  },
  rowNumText: {
    fontSize: 12,
    fontWeight: '600'
  },
  cell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    justifyContent: 'center',
    minHeight: 40
  },
  cellTouchable: {
    flex: 1,
    justifyContent: 'center'
  },
  cellText: {
    fontSize: 13
  },
  cellInput: {
    fontSize: 13,
    padding: 0,
    margin: 0
  },
  deleteColPlaceholder: {
    width: 36
  },
  deleteRowBtn: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  addRowBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10
  },
  addRowText: {
    fontSize: 13,
    fontWeight: '600'
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center'
  }
});

export default IsolationTestScreen;
