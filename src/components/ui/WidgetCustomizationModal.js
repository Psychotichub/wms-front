import React from 'react';
import { StyleSheet, Text, View, Pressable, Modal, Switch, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeTokens } from '../../theme/ThemeProvider';

const shadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12
  },
  android: { elevation: 3 },
  default: { boxShadow: '0px 8px 16px rgba(0,0,0,0.12)' }
});

const WIDGET_LABELS = {
  overview: {
    label: 'Overview Tiles',
    description: 'Reports, Materials, Panels, and Active Employees',
    icon: 'grid-outline',
  },
  productivityKPIs: {
    label: 'Productivity KPIs',
    description: 'Total Tasks, Average Efficiency, Total Hours',
    icon: 'stats-chart-outline',
  },
  workTrends: {
    label: 'Work Trends Chart',
    description: 'Tasks completed over the last 7 days',
    icon: 'trending-up-outline',
  },
  topPerformers: {
    label: 'Top Performers',
    description: 'Employee leaderboard',
    icon: 'trophy-outline',
  },
  quickActions: {
    label: 'Quick Actions',
    description: 'Shortcuts to common tasks',
    icon: 'flash-outline',
  },
  mapView: {
    label: 'Real-time Map',
    description: 'Active sites and employee clock-in locations',
    icon: 'map-outline',
  },
};

const WidgetCustomizationModal = ({ visible, onClose, widgets, onToggleWidget, onReset }) => {
  const t = useThemeTokens();

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
            <Text style={[styles.title, { color: t.colors.text }]}>Customize Dashboard</Text>
            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: t.colors.background }]}
            >
              <Ionicons name="close" size={24} color={t.colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.content}>
            <Text style={[styles.subtitle, { color: t.colors.textSecondary }]}>
              Toggle widgets to show or hide them on your dashboard
            </Text>

            {Object.entries(WIDGET_LABELS).map(([key, config]) => (
              <View
                key={key}
                style={[
                  styles.widgetItem,
                  shadow,
                  { backgroundColor: t.colors.card, borderColor: t.colors.border }
                ]}
              >
                <View style={styles.widgetInfo}>
                  <View style={[styles.iconContainer, { backgroundColor: t.colors.primary + '20' }]}>
                    <Ionicons name={config.icon} size={20} color={t.colors.primary} />
                  </View>
                  <View style={styles.widgetText}>
                    <Text style={[styles.widgetLabel, { color: t.colors.text }]}>
                      {config.label}
                    </Text>
                    <Text style={[styles.widgetDescription, { color: t.colors.textSecondary }]}>
                      {config.description}
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
                Reset to Defaults
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
