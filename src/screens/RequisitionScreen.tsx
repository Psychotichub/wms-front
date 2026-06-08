// @ts-nocheck
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Screen from '../components/Screen';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import SkeletonBar from '../components/ui/SkeletonBar';
import AnimatedListItem from '../components/ui/AnimatedListItem';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { useBreakpoint } from '../hooks/useBreakpoint';

// ── Helpers ──────────────────────────────────────────────────────────────────

const getRGBA = (hex, alpha) => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex;
  let h = hex;
  if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const STATUS_FILTERS = ['all', 'requested', 'approved', 'dispatched', 'delivered', 'rejected'];

const STATUS_VARIANT = {
  requested: 'warning',
  approved: 'success',
  dispatched: 'info',
  delivered: 'success',
  rejected: 'danger'
};

const PRIORITY_VARIANT = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger'
};

const TIMELINE_STEPS = ['requested', 'approved', 'dispatched', 'delivered'];
const TIMELINE_ICONS = {
  requested: 'time-outline',
  approved: 'checkmark-circle-outline',
  dispatched: 'car-outline',
  delivered: 'cube-outline',
  rejected: 'close-circle-outline'
};

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const fmtDateTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

// ── Skeleton Data ────────────────────────────────────────────────────────────

const SKELETON_DATA = Array.from({ length: 4 }).map((_, i) => ({
  _id: `skel-${i}`,
  __skeleton: true
}));

// ══════════════════════════════════════════════════════════════════════════════
// SCREEN
// ══════════════════════════════════════════════════════════════════════════════

const RequisitionScreen = () => {
  const { request, user } = useAuth();
  const t = useThemeTokens();
  const { t: tr } = useI18n();
  useBreakpoint();
  const isAdmin = user?.role === 'admin';
  const isDark = t.mode === 'dark';

  // ── State ──────────────────────────────────────────────────────────────────

  const [view, setView] = useState('list'); // 'list' | 'form' | 'detail'
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedReq, setSelectedReq] = useState(null);
  const [message, setMessage] = useState('');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formPriority, setFormPriority] = useState('medium');
  const [formNotes, setFormNotes] = useState('');
  const [formItems, setFormItems] = useState([{ name: '', quantity: '1', unit: 'pcs' }]);
  const [editingId, setEditingId] = useState(null);

  // Material autocomplete state
  const [materials, setMaterials] = useState([]);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);

  // Review state (admin actions)
  const [reviewNote, setReviewNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadRequisitions = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const data = await request(`/api/requisitions${params}`);
      setRequisitions(data.requisitions || []);
    } catch {
      setMessage(tr('requisitions.loadFail'));
    } finally {
      setLoading(false);
    }
  }, [request, statusFilter, tr]);

  const loadPendingCount = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = await request('/api/requisitions/pending-count');
      setPendingCount(data.count || 0);
    } catch { /* ignore */ }
  }, [request, isAdmin]);

  const loadMaterials = useCallback(async () => {
    try {
      const data = await request('/api/materials?limit=2000');
      setMaterials(data.materials || []);
    } catch { /* ignore */ }
  }, [request]);

  useFocusEffect(
    useCallback(() => {
      loadRequisitions();
      loadPendingCount();
      loadMaterials();
    }, [loadRequisitions, loadPendingCount, loadMaterials])
  );

  // ── Form handlers ─────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormTitle('');
    setFormPriority('medium');
    setFormNotes('');
    setFormItems([{ name: '', quantity: '1', unit: 'pcs' }]);
    setEditingId(null);
  };

  const openCreateForm = () => {
    resetForm();
    setView('form');
  };

  const openEditForm = (req) => {
    setFormTitle(req.title);
    setFormPriority(req.priority);
    setFormNotes(req.notes || '');
    setFormItems(
      req.items.map((it) => ({
        name: it.name,
        quantity: String(it.quantity),
        unit: it.unit || 'pcs'
      }))
    );
    setEditingId(req._id);
    setView('form');
  };

  const addItem = () => {
    setFormItems((prev) => [...prev, { name: '', quantity: '1', unit: 'pcs' }]);
  };

  const removeItem = (idx) => {
    setFormItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, field, value) => {
    setFormItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
    // Show suggestions when typing in name field
    if (field === 'name') {
      setActiveSuggestionIdx(value.trim().length > 0 ? idx : -1);
    }
  };

  const selectMaterial = (idx, mat) => {
    setFormItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], name: mat.name, unit: mat.unit || 'pcs' };
      return copy;
    });
    setActiveSuggestionIdx(-1);
  };

  const getSuggestions = (query) => {
    if (!query || query.trim().length < 1) return [];
    const q = query.toLowerCase();
    return materials.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 6);
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) {
      setMessage(tr('requisitions.titleRequired'));
      return;
    }
    const validItems = formItems.filter((it) => it.name.trim());
    if (validItems.length === 0) {
      setMessage(tr('requisitions.itemsRequired'));
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        title: formTitle.trim(),
        priority: formPriority,
        notes: formNotes.trim(),
        items: validItems.map((it) => ({
          name: it.name.trim(),
          quantity: parseFloat(it.quantity) || 1,
          unit: it.unit.trim() || 'pcs'
        }))
      };

      if (editingId) {
        await request(`/api/requisitions/${editingId}`, {
          method: 'PUT',
          body: payload
        });
        setMessage(tr('requisitions.updated'));
      } else {
        await request('/api/requisitions', {
          method: 'POST',
          body: payload
        });
        setMessage(tr('requisitions.created'));
      }

      resetForm();
      setView('list');
      loadRequisitions();
      loadPendingCount();
    } catch (err) {
      setMessage(err.message || tr('requisitions.saveFail'));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Admin actions ─────────────────────────────────────────────────────────

  const handleReview = async (action) => {
    if (!reviewNote.trim()) {
      setMessage(tr('requisitions.reviewNoteRequired'));
      return;
    }
    setActionLoading(true);
    try {
      const data = await request(`/api/requisitions/${selectedReq._id}/review`, {
        method: 'PATCH',
        body: { action, note: reviewNote.trim() }
      });
      setMessage(action === 'approve' ? tr('requisitions.approved') : tr('requisitions.rejected'));
      setSelectedReq(data.requisition);
      setReviewNote('');
      loadRequisitions();
      loadPendingCount();
    } catch (err) {
      setMessage(err.message || tr('requisitions.actionFail'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDispatch = async () => {
    setActionLoading(true);
    try {
      const data = await request(`/api/requisitions/${selectedReq._id}/dispatch`, {
        method: 'PATCH'
      });
      setMessage(tr('requisitions.dispatched'));
      setSelectedReq(data.requisition);
      loadRequisitions();
    } catch (err) {
      setMessage(err.message || tr('requisitions.actionFail'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeliver = async () => {
    setActionLoading(true);
    try {
      const data = await request(`/api/requisitions/${selectedReq._id}/deliver`, {
        method: 'PATCH'
      });
      setMessage(tr('requisitions.delivered'));
      setSelectedReq(data.requisition);
      loadRequisitions();
    } catch (err) {
      setMessage(err.message || tr('requisitions.actionFail'));
    } finally {
      setActionLoading(false);
    }
  };

  const openDetail = async (req) => {
    try {
      const data = await request(`/api/requisitions/${req._id}`);
      setSelectedReq(data.requisition);
      setReviewNote('');
      setView('detail');
    } catch (err) {
      setMessage(err.message || tr('requisitions.loadFail'));
    }
  };

  // ── Clear message ─────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Status Timeline
  // ══════════════════════════════════════════════════════════════════════════

  const renderTimeline = (req) => {
    const isRejected = req.status === 'rejected';
    const statusIdx = TIMELINE_STEPS.indexOf(req.status);
    const history = req.statusHistory || [];

    const getHistoryEntry = (status) => history.find((h) => h.status === status);

    return (
      <View style={s.timelineContainer}>
        {TIMELINE_STEPS.map((step, idx) => {
          const entry = getHistoryEntry(step);
          const isActive = idx <= statusIdx && !isRejected;
          const isCurrent = req.status === step;
          const dotColor = isActive ? t.colors.success : t.colors.border;
          const lineColor = idx < statusIdx && !isRejected ? t.colors.success : t.colors.border;

          return (
            <View key={step} style={s.timelineRow}>
              {/* Dot + Line */}
              <View style={s.timelineDotCol}>
                <View
                  style={[
                    s.timelineDot,
                    {
                      backgroundColor: isActive ? dotColor : 'transparent',
                      borderColor: dotColor,
                      borderWidth: 2
                    },
                    isCurrent && { borderColor: t.colors.primary, backgroundColor: t.colors.primary }
                  ]}
                >
                  {isActive && (
                    <Ionicons
                      name={TIMELINE_ICONS[step]}
                      size={14}
                      color={t.colors.onPrimary || '#fff'}
                    />
                  )}
                </View>
                {idx < TIMELINE_STEPS.length - 1 && (
                  <View style={[s.timelineLine, { backgroundColor: lineColor }]} />
                )}
              </View>

              {/* Content */}
              <View style={s.timelineContent}>
                <Text
                  style={[
                    t.typography.body,
                    {
                      color: isActive ? t.colors.text : t.colors.textSecondary,
                      fontWeight: isCurrent ? '700' : '500'
                    }
                  ]}
                >
                  {tr(`requisitions.timeline${step.charAt(0).toUpperCase() + step.slice(1)}`)}
                </Text>
                {entry && (
                  <View style={{ marginTop: 2 }}>
                    <Text style={[t.typography.small, { color: t.colors.textSecondary }]}>
                      {fmtDateTime(entry.changedAt)}
                      {entry.changedBy?.name ? ` · ${entry.changedBy.name}` : ''}
                    </Text>
                    {entry.note ? (
                      <Text style={[t.typography.small, { color: t.colors.textSecondary, fontStyle: 'italic', marginTop: 2 }]}>
                        "{entry.note}"
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {/* Rejected branch */}
        {isRejected && (
          <View style={s.timelineRow}>
            <View style={s.timelineDotCol}>
              <View
                style={[
                  s.timelineDot,
                  {
                    backgroundColor: t.colors.danger,
                    borderColor: t.colors.danger,
                    borderWidth: 2
                  }
                ]}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </View>
            </View>
            <View style={s.timelineContent}>
              <Text style={[t.typography.body, { color: t.colors.danger, fontWeight: '700' }]}>
                {tr('requisitions.timelineRejected')}
              </Text>
              {(() => {
                const rejEntry = getHistoryEntry('rejected');
                if (!rejEntry) return null;
                return (
                  <View style={{ marginTop: 2 }}>
                    <Text style={[t.typography.small, { color: t.colors.textSecondary }]}>
                      {fmtDateTime(rejEntry.changedAt)}
                      {rejEntry.changedBy?.name ? ` · ${rejEntry.changedBy.name}` : ''}
                    </Text>
                    {rejEntry.note ? (
                      <Text style={[t.typography.small, { color: t.colors.danger, fontStyle: 'italic', marginTop: 2 }]}>
                        "{rejEntry.note}"
                      </Text>
                    ) : null}
                  </View>
                );
              })()}
            </View>
          </View>
        )}
      </View>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Detail View
  // ══════════════════════════════════════════════════════════════════════════

  const renderDetail = () => {
    if (!selectedReq) return null;
    const req = selectedReq;

    return (
      <Screen>
        {/* Back */}
        <Pressable style={s.backRow} onPress={() => setView('list')}>
          <Ionicons name="chevron-back" size={20} color={t.colors.primary} />
          <Text style={[t.typography.body, { color: t.colors.primary, fontWeight: '600' }]}>
            {tr('requisitions.backToList')}
          </Text>
        </Pressable>

        {/* Message */}
        {message ? (
          <View style={[s.messageBanner, { backgroundColor: getRGBA(t.colors.success, 0.12) }]}>
            <Text style={[t.typography.small, { color: t.colors.success }]}>{message}</Text>
          </View>
        ) : null}

        {/* Header Card */}
        <View style={[s.card, { backgroundColor: isDark ? getRGBA(t.colors.surface, 0.7) : t.colors.card, borderColor: t.colors.border }]}>
          <View style={s.detailHeader}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[t.typography.h2, { color: t.colors.text }]}>{req.title}</Text>
              <View style={s.badgeRow}>
                <StatusBadge
                  label={tr(`requisitions.status${req.status.charAt(0).toUpperCase() + req.status.slice(1)}`)}
                  variant={STATUS_VARIANT[req.status]}
                />
                <StatusBadge
                  label={tr(`requisitions.priority${req.priority.charAt(0).toUpperCase() + req.priority.slice(1)}`)}
                  variant={PRIORITY_VARIANT[req.priority]}
                />
              </View>
            </View>
          </View>

          {/* Meta */}
          <View style={[s.metaGrid, { borderTopColor: t.colors.border }]}>
            <View style={s.metaItem}>
              <Text style={[t.typography.small, { color: t.colors.textSecondary }]}>
                {tr('requisitions.requestedBy')}
              </Text>
              <Text style={[t.typography.body, { color: t.colors.text, fontWeight: '600' }]}>
                {req.requestedBy?.name || '—'}
              </Text>
            </View>
            <View style={s.metaItem}>
              <Text style={[t.typography.small, { color: t.colors.textSecondary }]}>
                {tr('requisitions.requestDate')}
              </Text>
              <Text style={[t.typography.body, { color: t.colors.text, fontWeight: '600' }]}>
                {fmtDate(req.createdAt)}
              </Text>
            </View>
            {req.reviewedBy && (
              <View style={s.metaItem}>
                <Text style={[t.typography.small, { color: t.colors.textSecondary }]}>
                  {tr('requisitions.reviewedBy')}
                </Text>
                <Text style={[t.typography.body, { color: t.colors.text, fontWeight: '600' }]}>
                  {req.reviewedBy?.name || '—'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Items Card */}
        <View style={[s.card, { backgroundColor: isDark ? getRGBA(t.colors.surface, 0.7) : t.colors.card, borderColor: t.colors.border }]}>
          <Text style={[t.typography.h3, { color: t.colors.text, marginBottom: 10 }]}>
            {tr('requisitions.itemsSection')}
          </Text>
          {/* Table Header */}
          <View style={[s.itemTableHeader, { borderBottomColor: t.colors.border }]}>
            <Text style={[t.typography.small, s.itemColName, { color: t.colors.textSecondary }]}>
              {tr('requisitions.itemName')}
            </Text>
            <Text style={[t.typography.small, s.itemColQty, { color: t.colors.textSecondary }]}>
              {tr('requisitions.itemQty')}
            </Text>
            <Text style={[t.typography.small, s.itemColUnit, { color: t.colors.textSecondary }]}>
              {tr('requisitions.itemUnit')}
            </Text>
          </View>
          {req.items.map((item, idx) => (
            <View
              key={idx}
              style={[
                s.itemTableRow,
                idx < req.items.length - 1 && { borderBottomColor: t.colors.border, borderBottomWidth: 1 }
              ]}
            >
              <Text style={[t.typography.body, s.itemColName, { color: t.colors.text }]}>
                {item.name}
              </Text>
              <Text style={[t.typography.body, s.itemColQty, { color: t.colors.text, fontWeight: '700' }]}>
                {item.quantity}
              </Text>
              <Text style={[t.typography.body, s.itemColUnit, { color: t.colors.textSecondary }]}>
                {item.unit}
              </Text>
            </View>
          ))}
        </View>

        {/* Notes */}
        {req.notes ? (
          <View style={[s.card, { backgroundColor: isDark ? getRGBA(t.colors.surface, 0.7) : t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[t.typography.h3, { color: t.colors.text, marginBottom: 6 }]}>
              {tr('requisitions.notesSection')}
            </Text>
            <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>{req.notes}</Text>
          </View>
        ) : null}

        {/* Timeline */}
        <View style={[s.card, { backgroundColor: isDark ? getRGBA(t.colors.surface, 0.7) : t.colors.card, borderColor: t.colors.border }]}>
          <Text style={[t.typography.h3, { color: t.colors.text, marginBottom: 12 }]}>
            {tr('requisitions.timelineSection')}
          </Text>
          {renderTimeline(req)}
        </View>

        {/* Admin Actions */}
        {isAdmin && (
          <View style={[s.card, { backgroundColor: isDark ? getRGBA(t.colors.surface, 0.7) : t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[t.typography.h3, { color: t.colors.text, marginBottom: 10 }]}>
              {tr('requisitions.actionsSection')}
            </Text>

            {req.status === 'requested' && (
              <>
                <Text style={[t.typography.small, { color: t.colors.textSecondary, marginBottom: 4 }]}>
                  {tr('requisitions.reviewNoteLabel')}
                </Text>
                <TextInput
                  style={[
                    s.textInput,
                    {
                      color: t.colors.text,
                      backgroundColor: isDark ? getRGBA(t.colors.card, 0.5) : t.colors.background,
                      borderColor: t.colors.border
                    }
                  ]}
                  value={reviewNote}
                  onChangeText={setReviewNote}
                  placeholder={tr('requisitions.reviewNotePlaceholder')}
                  placeholderTextColor={t.colors.textSecondary}
                  multiline
                />
                <View style={s.actionBtnRow}>
                  <Pressable
                    style={[s.actionBtn, { backgroundColor: getRGBA(t.colors.success, 0.15), borderColor: t.colors.success }]}
                    onPress={() => handleReview('approve')}
                    disabled={actionLoading}
                  >
                    <Ionicons name="checkmark-circle" size={18} color={t.colors.success} />
                    <Text style={[t.typography.body, { color: t.colors.success, fontWeight: '700' }]}>
                      {tr('requisitions.approveBtn')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[s.actionBtn, { backgroundColor: getRGBA(t.colors.danger, 0.15), borderColor: t.colors.danger }]}
                    onPress={() => handleReview('reject')}
                    disabled={actionLoading}
                  >
                    <Ionicons name="close-circle" size={18} color={t.colors.danger} />
                    <Text style={[t.typography.body, { color: t.colors.danger, fontWeight: '700' }]}>
                      {tr('requisitions.rejectBtn')}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            {req.status === 'approved' && (
              <View style={s.actionBtnRow}>
                <Pressable
                  style={[s.actionBtn, { backgroundColor: getRGBA(t.colors.info, 0.15), borderColor: t.colors.info }]}
                  onPress={handleDispatch}
                  disabled={actionLoading}
                >
                  <Ionicons name="car-outline" size={18} color={t.colors.info} />
                  <Text style={[t.typography.body, { color: t.colors.info, fontWeight: '700' }]}>
                    {tr('requisitions.dispatchBtn')}
                  </Text>
                </Pressable>
              </View>
            )}

            {req.status === 'dispatched' && (
              <View style={s.actionBtnRow}>
                <Pressable
                  style={[s.actionBtn, { backgroundColor: getRGBA(t.colors.success, 0.15), borderColor: t.colors.success }]}
                  onPress={handleDeliver}
                  disabled={actionLoading}
                >
                  <Ionicons name="cube-outline" size={18} color={t.colors.success} />
                  <Text style={[t.typography.body, { color: t.colors.success, fontWeight: '700' }]}>
                    {tr('requisitions.deliverBtn')}
                  </Text>
                </Pressable>
              </View>
            )}

            {(req.status === 'delivered' || req.status === 'rejected') && (
              <Text style={[t.typography.body, { color: t.colors.textSecondary, fontStyle: 'italic' }]}>
                —
              </Text>
            )}
          </View>
        )}

        {/* Edit button for requester */}
        {!isAdmin && req.status === 'requested' && (
          <View style={{ marginTop: 8 }}>
            <Button
              title={tr('requisitions.editBtn')}
              variant="secondary"
              onPress={() => openEditForm(req)}
            />
          </View>
        )}
      </Screen>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: Form View
  // ══════════════════════════════════════════════════════════════════════════

  const renderForm = () => {
    const priorities = ['low', 'medium', 'high', 'urgent'];

    return (
      <Screen>
        {/* Back */}
        <Pressable style={s.backRow} onPress={() => { resetForm(); setView('list'); }}>
          <Ionicons name="chevron-back" size={20} color={t.colors.primary} />
          <Text style={[t.typography.body, { color: t.colors.primary, fontWeight: '600' }]}>
            {tr('requisitions.backToList')}
          </Text>
        </Pressable>

        <View style={[s.card, { backgroundColor: isDark ? getRGBA(t.colors.surface, 0.7) : t.colors.card, borderColor: t.colors.border }]}>
          <Text style={[t.typography.h2, { color: t.colors.text, marginBottom: 16 }]}>
            {editingId ? tr('requisitions.editFormTitle') : tr('requisitions.formTitle')}
          </Text>

          {/* Title */}
          <Text style={[t.typography.small, { color: t.colors.textSecondary, marginBottom: 4 }]}>
            {tr('requisitions.labelTitle')}
          </Text>
          <TextInput
            style={[s.textInput, { color: t.colors.text, backgroundColor: isDark ? getRGBA(t.colors.card, 0.5) : t.colors.background, borderColor: t.colors.border }]}
            value={formTitle}
            onChangeText={setFormTitle}
            placeholder={tr('requisitions.placeholderTitle')}
            placeholderTextColor={t.colors.textSecondary}
          />

          {/* Priority */}
          <Text style={[t.typography.small, { color: t.colors.textSecondary, marginTop: 12, marginBottom: 6 }]}>
            {tr('requisitions.labelPriority')}
          </Text>
          <View style={s.chipRow}>
            {priorities.map((p) => {
              const active = formPriority === p;
              return (
                <Pressable
                  key={p}
                  style={[
                    s.chip,
                    {
                      backgroundColor: active ? getRGBA(t.colors.primary, 0.15) : getRGBA(t.colors.border, 0.3),
                      borderColor: active ? t.colors.primary : t.colors.border
                    }
                  ]}
                  onPress={() => setFormPriority(p)}
                >
                  <Text
                    style={[
                      t.typography.small,
                      { color: active ? t.colors.primary : t.colors.textSecondary, fontWeight: active ? '700' : '500' }
                    ]}
                  >
                    {tr(`requisitions.priority${p.charAt(0).toUpperCase() + p.slice(1)}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Items */}
          <Text style={[t.typography.small, { color: t.colors.textSecondary, marginTop: 14, marginBottom: 6 }]}>
            {tr('requisitions.labelItems')}
          </Text>
          {formItems.map((item, idx) => {
            const suggestions = activeSuggestionIdx === idx ? getSuggestions(item.name) : [];
            return (
              <View key={idx} style={{ zIndex: 1000 - idx }}>
                <View style={s.formItemRow}>
                  <View style={[s.formItemName, { position: 'relative' }]}>
                    <TextInput
                      style={[s.textInput, { color: t.colors.text, backgroundColor: isDark ? getRGBA(t.colors.card, 0.5) : t.colors.background, borderColor: activeSuggestionIdx === idx && suggestions.length > 0 ? t.colors.primary : t.colors.border }]}
                      value={item.name}
                      onChangeText={(v) => updateItem(idx, 'name', v)}
                      placeholder={tr('requisitions.itemName')}
                      placeholderTextColor={t.colors.textSecondary}
                      onFocus={() => { if (item.name.trim().length > 0) setActiveSuggestionIdx(idx); }}
                      onBlur={() => setTimeout(() => setActiveSuggestionIdx(-1), 200)}
                    />
                    {suggestions.length > 0 && (
                      <View style={[s.suggestionDropdown, { backgroundColor: isDark ? t.colors.surface : t.colors.card, borderColor: t.colors.border }]}>
                        {suggestions.map((mat) => (
                          <Pressable
                            key={mat._id}
                            style={({ pressed }) => [s.suggestionItem, pressed && { backgroundColor: getRGBA(t.colors.primary, 0.1) }]}
                            onPress={() => selectMaterial(idx, mat)}
                          >
                            <Ionicons name="cube-outline" size={14} color={t.colors.primary} style={{ marginRight: 6 }} />
                            <Text style={[t.typography.body, { color: t.colors.text, flex: 1 }]} numberOfLines={1}>
                              {mat.name}
                            </Text>
                            <Text style={[t.typography.small, { color: t.colors.textSecondary }]}>
                              {mat.unit || 'pcs'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                  <TextInput
                    style={[s.textInput, s.formItemQty, { color: t.colors.text, backgroundColor: isDark ? getRGBA(t.colors.card, 0.5) : t.colors.background, borderColor: t.colors.border }]}
                    value={item.quantity}
                    onChangeText={(v) => updateItem(idx, 'quantity', v)}
                    placeholder={tr('requisitions.itemQty')}
                    placeholderTextColor={t.colors.textSecondary}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[s.textInput, s.formItemUnit, { color: t.colors.text, backgroundColor: isDark ? getRGBA(t.colors.card, 0.5) : t.colors.background, borderColor: t.colors.border }]}
                    value={item.unit}
                    onChangeText={(v) => updateItem(idx, 'unit', v)}
                    placeholder={tr('requisitions.itemUnit')}
                    placeholderTextColor={t.colors.textSecondary}
                  />
                  {formItems.length > 1 && (
                    <Pressable onPress={() => removeItem(idx)} style={s.removeItemBtn}>
                      <Ionicons name="close-circle" size={20} color={t.colors.danger} />
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
          <Pressable style={s.addItemBtn} onPress={addItem}>
            <Ionicons name="add-circle-outline" size={18} color={t.colors.primary} />
            <Text style={[t.typography.small, { color: t.colors.primary, fontWeight: '600' }]}>
              {tr('requisitions.addItem')}
            </Text>
          </Pressable>

          {/* Notes */}
          <Text style={[t.typography.small, { color: t.colors.textSecondary, marginTop: 14, marginBottom: 4 }]}>
            {tr('requisitions.labelNotes')}
          </Text>
          <TextInput
            style={[s.textInput, { color: t.colors.text, backgroundColor: isDark ? getRGBA(t.colors.card, 0.5) : t.colors.background, borderColor: t.colors.border, minHeight: 60 }]}
            value={formNotes}
            onChangeText={setFormNotes}
            placeholder={tr('requisitions.placeholderNotes')}
            placeholderTextColor={t.colors.textSecondary}
            multiline
          />

          {/* Message */}
          {message ? (
            <View style={[s.messageBanner, { backgroundColor: getRGBA(t.colors.warning, 0.12), marginTop: 10 }]}>
              <Text style={[t.typography.small, { color: t.colors.warning }]}>{message}</Text>
            </View>
          ) : null}

          {/* Buttons */}
          <View style={[s.actionBtnRow, { marginTop: 16 }]}>
            <Pressable
              style={[s.chip, { borderColor: t.colors.border, backgroundColor: getRGBA(t.colors.border, 0.2), paddingHorizontal: 20, paddingVertical: 10 }]}
              onPress={() => { resetForm(); setView('list'); }}
            >
              <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>
                {tr('requisitions.cancel')}
              </Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Button
                title={editingId ? tr('requisitions.update') : tr('requisitions.submit')}
                onPress={handleSubmit}
                disabled={actionLoading}
              />
            </View>
          </View>
        </View>
      </Screen>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: List View
  // ══════════════════════════════════════════════════════════════════════════

  const renderReqCard = ({ item, index }) => {
    if (item.__skeleton) {
      return (
        <AnimatedListItem index={index}>
          <View style={[s.card, { backgroundColor: isDark ? getRGBA(t.colors.surface, 0.7) : t.colors.card, borderColor: t.colors.border }]}>
            <SkeletonBar width="60%" height={14} />
            <View style={{ height: 6 }} />
            <SkeletonBar width="40%" height={10} />
            <View style={{ height: 6 }} />
            <SkeletonBar width="80%" height={10} />
          </View>
        </AnimatedListItem>
      );
    }

    return (
      <AnimatedListItem index={index}>
        <Pressable
          style={({ pressed }) => [
            s.card,
            {
              backgroundColor: isDark ? getRGBA(t.colors.surface, 0.7) : t.colors.card,
              borderColor: pressed ? t.colors.primary : t.colors.border
            },
            pressed && { opacity: 0.9 }
          ]}
          onPress={() => openDetail(item)}
        >
          {/* Top row: title + priority */}
          <View style={s.cardTopRow}>
            <Text
              numberOfLines={1}
              style={[t.typography.body, { color: t.colors.text, fontWeight: '700', flex: 1 }]}
            >
              {item.title}
            </Text>
            <StatusBadge
              label={tr(`requisitions.priority${item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}`)}
              variant={PRIORITY_VARIANT[item.priority]}
            />
          </View>

          {/* Bottom row: status + date + items count */}
          <View style={s.cardBottomRow}>
            <StatusBadge
              label={tr(`requisitions.status${item.status.charAt(0).toUpperCase() + item.status.slice(1)}`)}
              variant={STATUS_VARIANT[item.status]}
            />
            <Text style={[t.typography.small, { color: t.colors.textSecondary }]}>
              {fmtDate(item.createdAt)}
            </Text>
            <Text style={[t.typography.small, { color: t.colors.textSecondary }]}>
              {item.items?.length || 0} item{(item.items?.length || 0) !== 1 ? 's' : ''}
            </Text>
            {item.requestedBy?.name && (
              <Text style={[t.typography.small, { color: t.colors.textSecondary }]} numberOfLines={1}>
                {item.requestedBy.name}
              </Text>
            )}
          </View>
        </Pressable>
      </AnimatedListItem>
    );
  };

  const listData = loading ? SKELETON_DATA : requisitions;

  const renderList = () => (
    <Screen>
      {/* Header */}
      <View style={s.listHeader}>
        <Text style={[t.typography.h1, { color: t.colors.text }]}>
          {tr('requisitions.screenTitle')}
        </Text>
        <Button title={tr('requisitions.newRequest')} onPress={openCreateForm} />
      </View>

      {/* Message */}
      {message ? (
        <View style={[s.messageBanner, { backgroundColor: getRGBA(t.colors.success, 0.12) }]}>
          <Text style={[t.typography.small, { color: t.colors.success }]}>{message}</Text>
        </View>
      ) : null}

      {/* Pending alert (admin) */}
      {isAdmin && pendingCount > 0 && (
        <LinearGradient
          colors={isDark ? ['rgba(245, 158, 11, 0.15)', 'rgba(245, 158, 11, 0.05)'] : ['rgba(245, 158, 11, 0.10)', 'rgba(245, 158, 11, 0.02)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.pendingAlert, { borderColor: getRGBA(t.colors.warning, 0.3) }]}
        >
          <Ionicons name="alert-circle" size={20} color={t.colors.warning} />
          <Text style={[t.typography.body, { color: t.colors.warning, fontWeight: '600', flex: 1 }]}>
            {tr('requisitions.pendingAlert', { count: pendingCount })}
          </Text>
        </LinearGradient>
      )}

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterContent}>
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f;
          return (
            <Pressable
              key={f}
              style={[
                s.chip,
                {
                  backgroundColor: active ? getRGBA(t.colors.primary, 0.15) : getRGBA(t.colors.border, 0.3),
                  borderColor: active ? t.colors.primary : t.colors.border
                }
              ]}
              onPress={() => setStatusFilter(f)}
            >
              <Text
                style={[
                  t.typography.small,
                  {
                    color: active ? t.colors.primary : t.colors.textSecondary,
                    fontWeight: active ? '700' : '500'
                  }
                ]}
              >
                {tr(`requisitions.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* List */}
      <FlatList
        data={listData}
        keyExtractor={(item) => item._id}
        renderItem={renderReqCard}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="document-text-outline"
              title={statusFilter !== 'all' ? tr('requisitions.emptyFilterTitle') : tr('requisitions.emptyTitle')}
              subtitle={statusFilter !== 'all' ? tr('requisitions.emptyFilterSubtitle') : tr('requisitions.emptySubtitle')}
              actionLabel={tr('requisitions.newRequest')}
              onAction={openCreateForm}
            />
          ) : null
        }
      />
    </Screen>
  );

  // ── Main render ────────────────────────────────────────────────────────────

  if (view === 'detail') return renderDetail();
  if (view === 'form') return renderForm();
  return renderList();
};

// ══════════════════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8
  },
  pendingAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12
  },
  filterScroll: {
    marginBottom: 12,
    maxHeight: 44
  },
  filterContent: {
    gap: 8,
    paddingVertical: 2
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap'
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  metaGrid: {
    borderTopWidth: 1,
    paddingTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16
  },
  metaItem: {
    minWidth: 120,
    gap: 2
  },
  itemTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingBottom: 6,
    marginBottom: 4
  },
  itemTableRow: {
    flexDirection: 'row',
    paddingVertical: 8
  },
  itemColName: { flex: 3 },
  itemColQty: { flex: 1, textAlign: 'center' },
  itemColUnit: { flex: 1, textAlign: 'center' },
  timelineContainer: {
    paddingLeft: 4
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 52
  },
  timelineDotCol: {
    width: 28,
    alignItems: 'center'
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 2,
    alignSelf: 'center'
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    marginBottom: 2
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    flexWrap: 'wrap'
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1
  },
  formItemRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
    alignItems: 'center'
  },
  formItemName: { flex: 3 },
  formItemQty: { flex: 1 },
  formItemUnit: { flex: 1 },
  removeItemBtn: {
    padding: 4
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6
  },
  messageBanner: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 10
  },
  suggestionDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 2,
    maxHeight: 200,
    overflow: 'hidden',
    ...({ boxShadow: '0 4px 12px rgba(0,0,0,0.12)' })
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.15)'
  }
});

export default RequisitionScreen;
