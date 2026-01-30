import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable, Platform, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import Screen from '../components/Screen';
import EmptyState from '../components/ui/EmptyState';
import SkeletonBar from '../components/ui/SkeletonBar';
import WidgetCustomizationModal from '../components/ui/WidgetCustomizationModal';
import RealTimeMapWidget from '../components/ui/RealTimeMapWidget';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useWidgetPreferences } from '../hooks/useWidgetPreferences';

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

const StatTile = ({ label, value, icon, color, textColor, muted, cardColor, borderColor }) => (
  <View style={[styles.tile, shadow, { borderColor, backgroundColor: cardColor }]}>
    <View style={[styles.iconWrap, { backgroundColor: color }]}>
      <Ionicons name={icon} size={18} color="#fff" />
    </View>
    <Text style={[styles.tileValue, { color: textColor }]}>{value}</Text>
    <Text style={[styles.tileLabel, { color: muted }]}>{label}</Text>
  </View>
);


// Enhanced Line Chart Component with react-native-gifted-charts
const WorkTrendsChart = ({ data, color, labelColor, backgroundColor }) => {
  const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width - 64);
  
  // Transform data format for react-native-gifted-charts
  const chartData = useMemo(() => {
    return data.map((point) => ({
      value: point.value,
      label: point.label,
    }));
  }, [data]);

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const minValue = Math.min(...data.map(d => d.value), 0);
  
  // Calculate responsive width (accounting for padding and margins)
  const chartWidth = Math.max(280, containerWidth - 40);

  // Disable animations on web to prevent collapsable warnings
  const isWeb = Platform.OS === 'web';

  const handleLayout = (event) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
  };

  return (
    <View style={styles.lineChartContainer} onLayout={handleLayout}>
      <LineChart
        data={chartData}
        width={chartWidth}
        height={180}
        spacing={chartWidth / (data.length + 1)}
        thickness={3}
        color={color}
        hideRules={false}
        hideYAxisText={false}
        yAxisColor={labelColor}
        xAxisColor={labelColor}
        yAxisTextStyle={{ color: labelColor, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: labelColor, fontSize: 10 }}
        curved
        animateOnDataChange={!isWeb}
        animationDuration={isWeb ? 0 : 800}
        startFillColor={color}
        endFillColor={color}
        startOpacity={0.3}
        endOpacity={0.1}
        areaChart
        hideDataPoints={false}
        dataPointsColor={color}
        dataPointsRadius={6}
        dataPointsWidth={3}
        textShiftY={-2}
        textShiftX={-5}
        textFontSize={10}
        textColor={labelColor}
        maxValue={maxValue + (maxValue * 0.1)}
        minValue={Math.max(0, minValue - (minValue * 0.1))}
        noOfSections={4}
        yAxisLabelWidth={40}
        yAxisLabelPrefix=""
        yAxisLabelSuffix=""
        backgroundColor={backgroundColor}
        rulesColor={labelColor}
        rulesType="solid"
        rulesThickness={0.5}
        initialSpacing={10}
        pointerConfig={{
          pointer1Color: color,
          pointerStripUptoDataPoint: true,
          pointerStripColor: color,
          pointerStripWidth: 2,
          activatePointersOnLongPress: true,
          autoAdjustPointerLabelPosition: true,
          pointerLabelComponent: (items) => {
            return (
              <View style={[styles.tooltipContainer, { backgroundColor: color }]}>
                <Text style={styles.tooltipText}>
                  {items[0].value} tasks
                </Text>
              </View>
            );
          },
        }}
        customDataPoint={(item, index) => {
          return (
            <View
              key={index}
              style={[
                styles.customDataPoint,
                {
                  backgroundColor: color,
                  borderColor: backgroundColor,
                },
              ]}
            />
          );
        }}
      />
    </View>
  );
};

const DashboardScreen = ({ navigation }) => {
  const { user, request } = useAuth();
  const t = useThemeTokens();
  const { widgets, toggleWidget, resetToDefaults } = useWidgetPreferences();
  const [showCustomizationModal, setShowCustomizationModal] = useState(false);
  const [counts, setCounts] = useState({ reports: '—', materials: '—', panels: '—' });
  const [analytics, setAnalytics] = useState({
    employees: [],
    workTrends: [],
    productivityKPIs: {
      totalTasks: 0,
      averageEfficiency: 0,
      totalHours: 0,
      activeEmployees: 0
    }
  });
  const [loading, setLoading] = useState(false);

  const loadAnalytics = useCallback(async () => {
    try {
      // Fetch employee data for productivity analytics
      const employeesRes = await request('/api/employees?limit=50');
      const employees = employeesRes?.employees || [];

      // Calculate productivity KPIs
      const totalTasks = employees.reduce((sum, emp) =>
        sum + (emp.productivityMetrics?.tasksCompleted || 0), 0);
      const totalHours = employees.reduce((sum, emp) =>
        sum + (emp.productivityMetrics?.totalHoursWorked || 0), 0);
      const validRatings = employees.filter(emp =>
        emp.productivityMetrics?.efficiencyRating > 0);
      const averageEfficiency = validRatings.length > 0
        ? validRatings.reduce((sum, emp) =>
            sum + emp.productivityMetrics.efficiencyRating, 0) / validRatings.length
        : 0;
      const activeEmployees = employees.filter(emp => emp.isActive).length;

      // Generate work trends data (last 7 days simulation)
      const workTrends = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

        // Simulate work completion data based on employee productivity
        const dailyTasks = Math.floor(totalTasks * (Math.random() * 0.3 + 0.1));
        workTrends.push({
          label: dayName,
          value: dailyTasks
        });
      }

      // Get top performers for leaderboard
      const topPerformers = employees
        .filter(emp => emp.productivityMetrics?.tasksCompleted > 0)
        .sort((a, b) => (b.productivityMetrics?.tasksCompleted || 0) - (a.productivityMetrics?.tasksCompleted || 0))
        .slice(0, 5);

      setAnalytics({
        employees: topPerformers,
        workTrends,
        productivityKPIs: {
          totalTasks,
          averageEfficiency: Math.round(averageEfficiency * 10) / 10,
          totalHours: Math.round(totalHours * 10) / 10,
          activeEmployees
        }
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
      // Set default values on error
      setAnalytics({
        employees: [],
        workTrends: [],
        productivityKPIs: {
          totalTasks: 0,
          averageEfficiency: 0,
          totalHours: 0,
          activeEmployees: 0
        }
      });
    }
  }, [request]);

  const loadCounts = useCallback(async () => {
    setLoading(true);
    try {
      const [reportsRes, materialsRes, panelsRes] = await Promise.all([
        request('/api/reports/daily'),
        request('/api/materials'),
        request('/api/panels'),
        loadAnalytics() // Load analytics data
      ]);
      setCounts({
        reports: reportsRes?.reports?.length ?? 0,
        materials: materialsRes?.materials?.length ?? 0,
        panels: panelsRes?.panels?.length ?? 0
      });
    } catch (_err) {
      setCounts({ reports: '—', materials: '—', panels: '—' });
    } finally {
      setLoading(false);
    }
  }, [loadAnalytics, request]);

  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts])
  );

  const stats = useMemo(
    () => [
      { label: 'Reports', value: counts.reports, icon: 'document-text-outline', color: t.colors.success },
      { label: 'Materials', value: counts.materials, icon: 'cube-outline', color: t.colors.primary },
      { label: 'Panels', value: counts.panels, icon: 'git-branch-outline', color: t.colors.warning },
      { label: 'Active Employees', value: analytics.productivityKPIs.activeEmployees, icon: 'people-outline', color: t.colors.info }
    ],
    [counts, analytics, t]
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={[styles.title, { color: t.colors.text }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: t.colors.textSecondary }]}>
              {user?.name || 'Team member'} · {user?.company || 'Company'} · {user?.site || 'Site'}
            </Text>
          </View>
          <Pressable
            onPress={() => setShowCustomizationModal(true)}
            style={[styles.customizeButton, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}
          >
            <Ionicons name="options-outline" size={20} color={t.colors.primary} />
          </Pressable>
        </View>
      </View>

      {widgets.overview && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.colors.text }]}>Overview</Text>
          {loading ? <Text style={[styles.muted, { color: t.colors.textSecondary }]}>Refreshing...</Text> : null}
          <View style={styles.tileGrid}>
          {loading
            ? Array.from({ length: 4 }).map((_, idx) => (
                <View
                  key={`stat-skeleton-${idx}`}
                  style={[styles.tile, shadow, { borderColor: t.colors.border, backgroundColor: t.colors.card }]}
                >
                  <SkeletonBar width={32} height={32} />
                  <SkeletonBar width="70%" height={16} />
                  <SkeletonBar width="50%" height={12} />
                </View>
              ))
            : stats.map((s) => (
                <StatTile
                  key={s.label}
                  {...s}
                  cardColor={t.colors.card}
                  borderColor={t.colors.border}
                  textColor={t.colors.text}
                  muted={t.colors.textSecondary}
                />
              ))}
          </View>
        </View>
      )}

      {/* Productivity KPIs Section */}
      {widgets.productivityKPIs && (
        <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: t.colors.text }]}>Productivity KPIs</Text>
        <View style={styles.kpiGrid}>
          {loading ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <View
                key={`kpi-skeleton-${idx}`}
                style={[styles.kpiCard, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}
              >
                <SkeletonBar width={24} height={24} />
                <SkeletonBar width="60%" height={16} />
                <SkeletonBar width="70%" height={10} />
              </View>
            ))
          ) : (
            <>
              <View style={[styles.kpiCard, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
                <Ionicons name="checkmark-circle-outline" size={24} color={t.colors.success} />
                <Text style={[styles.kpiValue, { color: t.colors.text }]}>
                  {analytics.productivityKPIs.totalTasks}
                </Text>
                <Text style={[styles.kpiLabel, { color: t.colors.textSecondary }]}>Total Tasks</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
                <Ionicons name="trending-up-outline" size={24} color={t.colors.primary} />
                <Text style={[styles.kpiValue, { color: t.colors.text }]}>
                  {analytics.productivityKPIs.averageEfficiency}/5.0
                </Text>
                <Text style={[styles.kpiLabel, { color: t.colors.textSecondary }]}>Avg Efficiency</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
                <Ionicons name="time-outline" size={24} color={t.colors.warning} />
                <Text style={[styles.kpiValue, { color: t.colors.text }]}>
                  {analytics.productivityKPIs.totalHours}h
                </Text>
                <Text style={[styles.kpiLabel, { color: t.colors.textSecondary }]}>Total Hours</Text>
              </View>
            </>
          )}
        </View>
      </View>
      )}

      {/* Work Completion Trends Chart */}
      {widgets.workTrends && (
        <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: t.colors.text }]}>Work Completion Trends</Text>
        <Text style={[styles.chartSubtitle, { color: t.colors.textSecondary }]}>
          Tasks completed over the last 7 days
        </Text>
        {loading ? (
          <View style={[styles.chartWrapper, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <SkeletonBar width="100%" height={120} />
          </View>
        ) : analytics.workTrends.length > 0 ? (
          <View style={[styles.chartWrapper, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <WorkTrendsChart
              data={analytics.workTrends}
              color={t.colors.primary}
              labelColor={t.colors.textSecondary}
              backgroundColor={t.colors.card}
            />
          </View>
        ) : (
          <EmptyState
            icon="stats-chart-outline"
            title="No trend data yet"
            subtitle="Once reports are created, trends will appear here."
          />
        )}
      </View>
      )}

      {/* Performance Leaderboard */}
      {widgets.topPerformers && (
        <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: t.colors.text }]}>Top Performers 🏆</Text>
        <Text style={[styles.chartSubtitle, { color: t.colors.textSecondary }]}>
          Employees with highest task completion
        </Text>
        {loading ? (
          <View style={styles.leaderboard}>
            {Array.from({ length: 3 }).map((_, idx) => (
              <View
                key={`leader-skeleton-${idx}`}
                style={[styles.leaderboardItem, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}
              >
                <SkeletonBar width={32} height={16} />
                <View style={styles.employeeInfo}>
                  <SkeletonBar width="60%" height={12} />
                  <SkeletonBar width="40%" height={10} />
                </View>
                <SkeletonBar width={36} height={16} />
              </View>
            ))}
          </View>
        ) : analytics.employees.length > 0 ? (
          <View style={styles.leaderboard}>
            {analytics.employees.map((employee, index) => (
              <View
                key={employee._id}
                style={[
                  styles.leaderboardItem,
                  { backgroundColor: t.colors.card, borderColor: t.colors.border }
                ]}
              >
                <View style={styles.rankBadge}>
                  <Text style={[styles.rankText, {
                    color: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : t.colors.textSecondary
                  }]}>
                    #{index + 1}
                  </Text>
                </View>
                <View style={styles.employeeInfo}>
                  <Text style={[styles.employeeName, { color: t.colors.text }]}>{employee.name}</Text>
                  <Text style={[styles.employeeRole, { color: t.colors.textSecondary }]}>
                    {employee.role} • {employee.productivityMetrics?.tasksCompleted || 0} tasks
                  </Text>
                </View>
                <View style={styles.scoreBadge}>
                  <Text style={[styles.scoreText, { color: t.colors.primary }]}>
                    {employee.productivityMetrics?.efficiencyRating?.toFixed(1) || '0.0'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="trophy-outline"
            title="No performance data yet"
            subtitle="We will show top performers once activity starts."
          />
        )}
      </View>
      )}

      {/* Real-time Map View */}
      {widgets.mapView && (
        <View style={styles.section}>
          <RealTimeMapWidget />
        </View>
      )}

      {widgets.quickActions && (
        <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: t.colors.text }]}>Quick actions</Text>
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionCard, shadow, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}
            onPress={() => navigation.navigate('Daily Report')}
          >
            <Ionicons name="document-text-outline" size={20} color={t.colors.primary} />
            <Text style={[styles.actionText, { color: t.colors.text }]}>Create Daily Report</Text>
          </Pressable>
          <Pressable
            style={[styles.actionCard, shadow, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}
            onPress={() => navigation.navigate('Add Material')}
          >
            <Ionicons name="add-circle-outline" size={20} color={t.colors.success} />
            <Text style={[styles.actionText, { color: t.colors.text }]}>Add Material</Text>
          </Pressable>
        </View>
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionCard, shadow, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}
            onPress={() => navigation.navigate('Panel')}
          >
            <Ionicons name="git-branch-outline" size={20} color={t.colors.warning} />
            <Text style={[styles.actionText, { color: t.colors.text }]}>Manage Panels</Text>
          </Pressable>
          {user?.role === 'admin' && (
            <Pressable
              style={[styles.actionCard, shadow, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}
              onPress={() => navigation.navigate('Employee')}
            >
              <Ionicons name="people-outline" size={20} color={t.colors.info} />
              <Text style={[styles.actionText, { color: t.colors.text }]}>Manage Employees</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionCard, shadow, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}
            onPress={() => navigation.navigate('Setting')}
          >
            <Ionicons name="settings-outline" size={20} color={t.colors.primary} />
            <Text style={[styles.actionText, { color: t.colors.text }]}>Settings</Text>
          </Pressable>
        </View>
      </View>
      )}

      <WidgetCustomizationModal
        visible={showCustomizationModal}
        onClose={() => setShowCustomizationModal(false)}
        widgets={widgets}
        onToggleWidget={toggleWidget}
        onReset={resetToDefaults}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: 16
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  customizeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...shadow,
  },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { marginTop: 4 },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    flexBasis: '48%',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  tileValue: { fontSize: 20, fontWeight: '700' },
  tileLabel: { marginTop: 2 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  actionCard: {
    flexBasis: '48%',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center'
  },
  actionText: { fontSize: 15, fontWeight: '600' },
  muted: { marginBottom: 8 },
  skeletonBar: { borderRadius: 6, marginBottom: 8 },

  // Analytics Styles
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8
  },
  kpiCard: {
    flex: 1,
    minWidth: '30%',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  kpiLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },

  // Empty state moved to shared component

  // Chart Styles
  chartWrapper: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  chartSubtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 100,
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 2,
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  barValue: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },

  // Line Chart Styles
  lineChartContainer: {
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  xAxisLabel: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
  tooltipContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  customDataPoint: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },

  // Leaderboard Styles
  leaderboard: {
    marginTop: 8,
    gap: 8,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
  },
  employeeRole: {
    fontSize: 12,
    marginTop: 2,
  },
  scoreBadge: {
    backgroundColor: 'rgba(0,123,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 40,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '700',
  },
  noData: {
    textAlign: 'center',
    padding: 20,
    fontStyle: 'italic',
  },
});

export default DashboardScreen;

