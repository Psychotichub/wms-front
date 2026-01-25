import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, FlatList } from 'react-native';
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

const PANEL_ROW_HEIGHT = 44;
const PANEL_GROUP_HEADER_HEIGHT = 24;
const PANEL_TABLE_HEADER_HEIGHT = 44;
const PANEL_GROUP_GAP = 12;

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

const PanelGroupItem = React.memo(({ item, colors, onEdit, onDelete }) => {
  if (item.__skeleton) {
    return (
      <View style={styles.tableGroup}>
        <SkeletonBar width="40%" height={14} style={{ marginBottom: 8 }} />
        <View style={[styles.table, { borderColor: colors.border }]}>
          <View style={[styles.row, styles.headerRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cell, styles.headerCell, { color: colors.text }]}>Circuit</Text>
            <Text style={[styles.cell, styles.headerCell, { color: colors.text }]}>Action</Text>
          </View>
          {Array.from({ length: 3 }).map((__, rowIdx) => (
            <View key={`panel-skeleton-row-${item.id}-${rowIdx}`} style={[styles.row, { borderColor: colors.border }]}>
              <View style={styles.cell}><SkeletonBar width="60%" height={12} /></View>
              <View style={[styles.cell, styles.actionCell]}>
                <SkeletonBar width={24} height={12} />
                <SkeletonBar width={24} height={12} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  const [panelName, items] = item;

  return (
    <View style={styles.tableGroup}>
      <Text style={[styles.groupHeader, { color: colors.text }]}>{panelName}</Text>
      <View style={[styles.table, { borderColor: colors.border }]}>
        <View
          style={[
            styles.row,
            styles.headerRow,
            { backgroundColor: colors.card, borderColor: colors.border }
          ]}
        >
          <Text style={[styles.cell, styles.headerCell, { color: colors.text }]}>Circuit</Text>
          <Text style={[styles.cell, styles.headerCell, { color: colors.text }]}>Action</Text>
        </View>
        {items.map((panelItem) => (
          <View key={panelItem._id} style={[styles.row, { borderColor: colors.border }]}>
            <Text style={[styles.cell, { color: colors.text }]}>{panelItem.circuit}</Text>
            <View style={[styles.cell, styles.actionCell]}>
              <Pressable style={[styles.actionBtn, { backgroundColor: getRGBA(colors.primary, 0.12) }]} onPress={() => onEdit(panelItem)}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.deleteBtn, { backgroundColor: getRGBA(colors.danger, 0.12) }]} onPress={() => onDelete(panelItem._id)}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
});
PanelGroupItem.displayName = 'PanelGroupItem';

const PanelScreen = () => {
  const { request, user } = useAuth();
  const t = useThemeTokens();
  const hasSite = Boolean(user?.site);

  const [name, setName] = useState('');
  const [circuit, setCircuit] = useState('');
  const [panels, setPanels] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const loadPanels = useCallback(async () => {
    if (!hasSite) {
      setPanels([]);
      return;
    }
    setLoading(true);
    try {
      const data = await request('/api/panels');
      setPanels(data.panels || []);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }, [hasSite, request]);

  useFocusEffect(
    useCallback(() => {
      if (hasSite) {
        loadPanels();
      }
    }, [hasSite, loadPanels])
  );

  const filteredPanels = useMemo(() => {
    if (!searchValue) return panels;
    const needle = searchValue.toLowerCase();
    return panels.filter((p) => (p.name || '').toLowerCase().includes(needle));
  }, [panels, searchValue]);

  const groupedPanels = useMemo(() => {
    const groups = filteredPanels.reduce((acc, panel) => {
      const key = panel.name || 'Untitled';
      if (!acc[key]) acc[key] = [];
      acc[key].push(panel);
      return acc;
    }, {});

    // Sort circuits inside each panel group ascending
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => String(a.circuit || '').localeCompare(String(b.circuit || '')));
    });

    // Return entries sorted by panel name for stable render
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredPanels]);

  const handleSubmit = async () => {
    setMessage('');
    try {
      const payload = { name, circuit };
      if (editingId) {
        await request(`/api/panels/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await request('/api/panels', { method: 'POST', body: JSON.stringify(payload) });
      }
      setName('');
      setCircuit('');
      setEditingId(null);
      setMessage('Panel saved');
      loadPanels();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handleEdit = useCallback((panel) => {
    setEditingId(panel._id);
    setName(panel.name || '');
    setCircuit(panel.circuit || '');
    setMessage('');
  }, []);

  const handleDelete = useCallback(async (id) => {
    setMessage('');
    try {
      await request(`/api/panels/${id}`, { method: 'DELETE' });
      if (editingId === id) {
        setEditingId(null);
        setName('');
        setCircuit('');
      }
      loadPanels();
    } catch (err) {
      setMessage(err.message);
    }
  }, [editingId, loadPanels, request]);

  const panelListData = useMemo(
    () => (loading ? Array.from({ length: 3 }).map((_, idx) => ({ id: `panel-skeleton-${idx}`, __skeleton: true })) : groupedPanels),
    [groupedPanels, loading]
  );

  const groupHeights = useMemo(() => panelListData.map((item) => {
    const rowCount = item.__skeleton ? 3 : item[1]?.length || 0;
    return PANEL_GROUP_HEADER_HEIGHT + PANEL_TABLE_HEADER_HEIGHT + rowCount * PANEL_ROW_HEIGHT + PANEL_GROUP_GAP;
  }), [panelListData]);

  const groupOffsets = useMemo(() => {
    const offsets = [];
    let offset = 0;
    groupHeights.forEach((height) => {
      offsets.push(offset);
      offset += height;
    });
    return offsets;
  }, [groupHeights]);

  const renderPanelGroup = useCallback(
    ({ item }) => (
      <PanelGroupItem
        item={item}
        colors={t.colors}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    ),
    [handleDelete, handleEdit, t.colors]
  );

  const getItemLayout = useCallback(
    (_, index) => ({
      length: groupHeights[index] ?? PANEL_GROUP_HEADER_HEIGHT + PANEL_TABLE_HEADER_HEIGHT + PANEL_GROUP_GAP,
      offset: groupOffsets[index] ?? 0,
      index
    }),
    [groupHeights, groupOffsets]
  );

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
        <Text style={[styles.title, { color: t.colors.text }]}>Panel</Text>
        <Text style={[styles.label, { color: t.colors.textSecondary }]}>Panel name</Text>
        <AutocompleteInput
          data={Array.from(new Set(panels.map((p) => p.name)))}
          value={name}
          onChange={setName}
          onSelect={(item) => setName(item.label)}
          placeholder="Panel name"
          containerStyle={{ marginBottom: 12 }}
        />
        <Text style={[styles.label, { color: t.colors.textSecondary }]}>Circuit</Text>
        <TextInput
          style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
          placeholder="Circuit"
          value={circuit}
          onChangeText={setCircuit}
          placeholderTextColor={t.colors.textSecondary}
        />
        <Button title={editingId ? 'Update Panel' : 'Save Panel'} onPress={handleSubmit} />
        {message ? <Text style={[styles.message, { color: t.colors.text }]}>{message}</Text> : null}

        {loading || panels.length > 0 ? (
          <>
            <Text style={[styles.label, { color: t.colors.textSecondary }]}>Search panel</Text>
            <AutocompleteInput
              data={Array.from(new Set(panels.map((p) => p.name)))}
              value={searchValue}
              onChange={setSearchValue}
              onSelect={(item) => setSearchValue(item.label)}
              placeholder="Type to search panel name"
              containerStyle={{ marginBottom: 12 }}
            />

            <Text style={[styles.tableTitle, { color: t.colors.text }]}>Saved Panels</Text>
            <FlatList
              data={panelListData}
              keyExtractor={(item) => (item.__skeleton ? item.id : item[0])}
              scrollEnabled={false}
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={7}
              removeClippedSubviews
              renderItem={renderPanelGroup}
              getItemLayout={getItemLayout}
            />
            {!loading && groupedPanels.length === 0 ? (
              <EmptyState
                icon="git-branch-outline"
                title="No panels match your search"
                subtitle="Try a different panel name."
              />
            ) : null}
          </>
        ) : (
          !loading ? (
            <EmptyState
              icon="git-branch-outline"
              title="No panels yet"
              subtitle="Create your first panel to get started."
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
    marginBottom: 12,
    backgroundColor: '#fff'
  },
  message: { marginTop: 8 },
  tableTitle: { marginTop: 16, marginBottom: 8, fontSize: 18, fontWeight: '700' },
  table: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', minHeight: PANEL_ROW_HEIGHT },
  headerRow: { backgroundColor: '#f3f4f6' },
  cell: { flex: 1, paddingVertical: 10, paddingHorizontal: 8 },
  headerCell: { fontWeight: '700', color: '#374151' },
  actionCell: { flexDirection: 'row', gap: 8 },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#e0f2fe' },
  actionText: { color: '#0369a1', fontWeight: '600' },
  deleteBtn: { backgroundColor: '#fee2e2' },
  deleteText: { color: '#b91c1c' },
  muted: { color: '#6b7280', marginBottom: 8 }
});

export default PanelScreen;

