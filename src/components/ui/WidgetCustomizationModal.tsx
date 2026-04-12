// @ts-nocheck
import React from 'react';
import { StyleSheet, Text, View, Pressable, Modal, Switch, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { elevation } from '../../theme/elevation';

const WIDGET_I18N_KEYS = {
  overview: { label: 'dashboardWidgets.overviewLabel', description: 'dashboardWidgets.overviewDesc', icon: 'grid-outline' },
  productivityKPIs: { label: 'dashboardWidgets.kpiLabel', description: 'dashboardWidgets.kpiDesc', icon: 'stats-chart-outline' },
  workTrends: { label: 'dashboardWidgets.trendsLabel', description: 'dashboardWidgets.trendsDesc', icon: 'trending-up-outline' },
  topPerformers: { label: 'dashboardWidgets.performersLabel', description: 'dashboardWidgets.performersDesc', icon: 'trophy-outline' },
  quickActions: { label: 'dashboardWidgets.quickLabel', description: 'dashboardWidgets.quickDesc', icon: 'flash-outline' },
  mapView: { label: 'dashboardWidgets.mapLabel', description: 'dashboardWidgets.mapDesc', icon: 'map-outline' },
};

const WidgetCustomizationModal = ({ visible, onClose, widgets, onToggleWidget, onReset }) => {
  const t = useThemeTokens();
  const { t: tr } = useI18n();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={onClose}
      >
        <Pressable
          style={[styles.modalContent, { backgroundColor: t.colors.card }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
            <Text style={[styles.title, { color: t.colors.text }]}>{tr('dashboardWidgets.modalTitle')}</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={tr('dashboardWidgets.a11yClose')}
              hitSlop={8}
              style={[styles.closeButton, { backgroundColor: t.colors.background }]}
            >
              <Ionicons name="close" size={24} color={t.colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.content}>
            <Text style={[styles.subtitle, { color: t.colors.textSecondary }]}>
              {tr('dashboardWidgets.modalSubtitle')}
            </Text>

            {Object.entries(WIDGET_I18N_KEYS).map(([key, config]) => (
              <View
                key={key}
                style={[
                  styles.widgetItem,
                  elevation.medium,
                  { backgroundColor: t.colors.card, borderColor: t.colors.border }
                ]}
              >
                <View style={styles.widgetInfo}>
                  <View style={[styles.iconContainer, { backgroundColor: t.colors.primary + '20' }]}>
                    <Ionicons name={config.icon} size={20} color={t.colors.primary} />
                  </View>
                  <View style={styles.widgetText}>
                    <Text style={[styles.widgetLabel, { color: t.colors.text }]}>
                      {tr(config.label)}
                    </Text>
                    <Text style={[styles.widgetDescription, { color: t.colors.textSecondary }]}>
                      {tr(config.description)}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={widgets[key] ?? true}
                  onValueChange={async () => {
                    try {
                      await onToggleWidget(key);
                    } catch (error) {
                      console.error('Failed to toggle widget:', error);
                    }
                  }}
                  trackColor={{
                    false: t.colors.border,
                    true: t.colors.primary + '80',
                  }}
                  thumbColor={widgets[key] ? t.colors.primary : t.colors.textSecondary}
                  ios_backgroundColor={t.colors.border}
                />
              </View>
            ))}

            <Pressable
              onPress={async () => {
                try {
                  await onReset();
                } catch (error) {
                  console.error('Failed to reset widgets:', error);
                }
              }}
              style={[styles.resetButton, { borderColor: t.colors.border }]}
            >
              <Ionicons name="refresh-outline" size={18} color={t.colors.textSecondary} />
              <Text style={[styles.resetButtonText, { color: t.colors.textSecondary }]}>
                {tr('dashboardWidgets.resetDefaults')}
              </Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  widgetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  widgetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  widgetText: {
    flex: 1,
  },
  widgetLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  widgetDescription: {
    fontSize: 13,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    gap: 8,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default WidgetCustomizationModal;
