import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, ScrollView, Alert, FlatList, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import Button from '../components/ui/Button';
import AutocompleteInput from '../components/ui/AutocompleteInput';
import EmptyState from '../components/ui/EmptyState';
import SkeletonBar from '../components/ui/SkeletonBar';

const EMPLOYEE_ITEM_HEIGHT = 140;

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

const getRoleColor = (role) => {
  switch (role) {
    case 'admin': return '#ef4444';
    case 'manager': return '#f59e0b';
    case 'supervisor': return '#3b82f6';
    case 'worker': return '#10b981';
    default: return '#6b7280';
  }
};

const EmployeeItem = React.memo(({ item, colors, onEdit, onDelete }) => {
  if (item.__skeleton) {
    return (
      <View style={[styles.employeeCard, { backgroundColor: getRGBA(colors.card, 0.5) }]}>
        <View style={styles.employeeHeader}>
          <View style={styles.employeeInfo}>
            <SkeletonBar width="60%" height={14} />
            <SkeletonBar width="40%" height={12} style={{ marginTop: 6 }} />
          </View>
          <View style={styles.employeeActions}>
            <SkeletonBar width={24} height={12} />
            <SkeletonBar width={24} height={12} />
          </View>
        </View>
        <View style={styles.employeeStats}>
          <View style={styles.statItem}>
            <SkeletonBar width="60%" height={10} />
            <SkeletonBar width="40%" height={12} style={{ marginTop: 6 }} />
          </View>
          <View style={styles.statItem}>
            <SkeletonBar width="60%" height={10} />
            <SkeletonBar width="40%" height={12} style={{ marginTop: 6 }} />
          </View>
          <View style={styles.statItem}>
            <SkeletonBar width="60%" height={10} />
            <SkeletonBar width="40%" height={12} style={{ marginTop: 6 }} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.employeeCard, { backgroundColor: getRGBA(colors.card, 0.5) }]}>
      <View style={styles.employeeHeader}>
        <View style={styles.employeeInfo}>
          <Text style={[styles.employeeName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.employeeEmail, { color: colors.textSecondary }]}>{item.email}</Text>
          <View style={styles.employeeMeta}>
            <Text style={[styles.employeeRole, { color: getRoleColor(item.role) }]}>
              {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
            </Text>
            {item.department ? (
              <Text style={[styles.employeeDept, { color: colors.textSecondary }]}>
                • {item.department}
              </Text>
            ) : null}
            {item.user ? (
              <Text style={[styles.employeeDept, { color: colors.success, marginLeft: 4 }]}>
                • Has Account
              </Text>
            ) : (
              <Text style={[styles.employeeDept, { color: colors.warning, marginLeft: 4 }]}>
                • No Account
              </Text>
            )}
          </View>
        </View>
        <View style={styles.employeeActions}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: getRGBA(colors.primary, 0.12) }]}
            onPress={() => onEdit(item)}
          >
            <Ionicons name="create-outline" size={16} color={colors.primary} />
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.deleteBtn, { backgroundColor: getRGBA(colors.danger, 0.12) }]}
            onPress={() => onDelete(item._id)}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </Pressable>
        </View>
      </View>

      <View style={styles.employeeStats}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Tasks Completed</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {item.productivityMetrics?.tasksCompleted || 0}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Hours</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {item.productivityMetrics?.totalHoursWorked?.toFixed(1) || '0.0'}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Rating</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {`${item.productivityMetrics?.efficiencyRating?.toFixed(1) || '0.0'}/5.0`}
          </Text>
        </View>
      </View>
    </View>
  );
});
EmployeeItem.displayName = 'EmployeeItem';

// Password Requirements Component
const PasswordRequirements = ({ password, colors }) => {
  const requirements = [
    { 
      text: 'At least 6 characters', 
      met: password.length >= 6 
    },
    { 
      text: 'At least one capital letter', 
      met: /[A-Z]/.test(password) 
    },
    { 
      text: 'At least one lowercase letter', 
      met: /[a-z]/.test(password) 
    },
    { 
      text: 'At least one number', 
      met: /[0-9]/.test(password) 
    },
    { 
      text: 'At least one special character (!@#$%^&*...)', 
      met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) 
    }
  ];

  if (!password || password.length === 0) {
    return (
      <View style={{ marginTop: 8 }}>
        <Text style={[{ fontSize: 12, marginBottom: 4, color: colors.textSecondary }]}>
          Password must contain:
        </Text>
        {requirements.map((req, idx) => (
          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <Ionicons 
              name="ellipse-outline" 
              size={12} 
              color={colors.textSecondary} 
              style={{ marginRight: 6 }}
            />
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              {req.text}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={[{ fontSize: 12, marginBottom: 4, color: colors.textSecondary }]}>
        Password requirements:
      </Text>
      {requirements.map((req, idx) => (
        <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
          <Ionicons 
            name={req.met ? "checkmark-circle" : "ellipse-outline"} 
            size={14} 
            color={req.met ? colors.success : colors.textSecondary} 
            style={{ marginRight: 6 }}
          />
          <Text style={{ 
            fontSize: 12, 
            color: req.met ? colors.success : colors.textSecondary,
            textDecorationLine: req.met ? 'none' : 'none'
          }}>
            {req.text}
          </Text>
        </View>
      ))}
    </View>
  );
};

const EmployeeScreen = () => {
  const { request } = useAuth();
  const t = useThemeTokens();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [geofences, setGeofences] = useState([]);
  const [loadingGeofences, setLoadingGeofences] = useState(false);
  const [employeePreferences, setEmployeePreferences] = useState({
    selectedGeofenceId: null,
    workingHours: { startTime: '08:00', endTime: '16:30' }
  });
  const [loadingPreferences, setLoadingPreferences] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'worker',
    department: '',
    skills: [],
    hourlyRate: '0',
    password: '' // Password for creating User account
  });

  const roleOptions = [
    { label: 'Worker', value: 'worker' },
    { label: 'Supervisor', value: 'supervisor' },
    { label: 'Manager', value: 'manager' },
    { label: 'Admin', value: 'admin' }
  ];

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request('/api/employees');
      setEmployees(data.employees || []);
    } catch (error) {
      setMessage(error.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [request]);

  const loadGeofences = useCallback(async () => {
    setLoadingGeofences(true);
    try {
      const data = await request('/api/locations/geofences');
      setGeofences(data.geofences || []);
    } catch (error) {
      console.error('Failed to load geofences:', error);
    } finally {
      setLoadingGeofences(false);
    }
  }, [request]);

  const loadEmployeePreferences = useCallback(async (employeeId) => {
    if (!employeeId) return;
    setLoadingPreferences(true);
    try {
      const data = await request(`/api/employees/${employeeId}/preferences`);
      if (data?.preferences) {
        setEmployeePreferences({
          selectedGeofenceId: data.preferences.selectedGeofenceId || null,
          workingHours: data.preferences.workingHours || { startTime: '08:00', endTime: '16:30' }
        });
      }
    } catch (error) {
      console.error('Failed to load employee preferences:', error);
      // Set defaults if failed
      setEmployeePreferences({
        selectedGeofenceId: null,
        workingHours: { startTime: '08:00', endTime: '16:30' }
      });
    } finally {
      setLoadingPreferences(false);
    }
  }, [request]);

  const saveEmployeePreferences = useCallback(async (employeeId) => {
    if (!employeeId) return;
    try {
      await request(`/api/employees/${employeeId}/preferences`, {
        method: 'PUT',
        body: JSON.stringify({
          selectedGeofenceId: employeePreferences.selectedGeofenceId,
          workingHours: employeePreferences.workingHours
        })
      });
      setMessage('Employee preferences updated successfully');
    } catch (error) {
      setMessage(error.message || 'Failed to update employee preferences');
    }
  }, [request, employeePreferences]);

  useFocusEffect(
    useCallback(() => {
      loadEmployees();
    }, [loadEmployees])
  );

  const filteredEmployees = useMemo(() => {
    if (!searchValue) return employees;
    const needle = searchValue.toLowerCase();
    return employees.filter(employee =>
      employee.name.toLowerCase().includes(needle) ||
      employee.email.toLowerCase().includes(needle) ||
      employee.department?.toLowerCase().includes(needle)
    );
  }, [employees, searchValue]);

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'worker',
      department: '',
      skills: [],
      hourlyRate: '0',
      password: ''
    });
    setEditingId(null);
    setShowForm(false);
    setShowPreferences(false);
    setEmployeePreferences({
      selectedGeofenceId: null,
      workingHours: { startTime: '08:00', endTime: '16:30' }
    });
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        ...formData,
        skills: formData.skills.filter(skill => skill.trim() !== ''),
        hourlyRate: parseFloat(formData.hourlyRate) || 0
      };

      // Only include password if provided (for creating/updating User account)
      if (!payload.password || payload.password.trim() === '') {
        delete payload.password;
      }

      if (editingId) {
        const response = await request(`/api/employees/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        setMessage(response.message || 'Employee updated successfully');
      } else {
        const response = await request('/api/employees', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setMessage(response.message || 'Employee created successfully');
      }

      resetForm();
      loadEmployees();
    } catch (error) {
      setMessage(error.message || 'Failed to save employee');
    }
  };

  const handleEdit = useCallback(async (employee) => {
    setFormData({
      name: employee.name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      role: employee.role || 'worker',
      department: employee.department || '',
      skills: employee.skills || [],
      hourlyRate: String(employee.hourlyRate || 0),
      password: '' // Don't pre-fill password for security
    });
    setEditingId(employee._id);
    setShowForm(true);
    setShowPreferences(false);
    
    // Load geofences and employee preferences when editing
    await loadGeofences();
    await loadEmployeePreferences(employee._id);
  }, [loadGeofences, loadEmployeePreferences]);

  const handleDelete = useCallback(async (id) => {
    const isWeb = Platform.OS === 'web';
    
    if (isWeb) {
      const shouldDelete = window.confirm(
        'Are you sure you want to delete this employee? This will permanently delete the employee record and their associated user account. This action cannot be undone.'
      );
      if (!shouldDelete) {
        return;
      }
      
      try {
        await request(`/api/employees/${id}`, { method: 'DELETE' });
        setMessage('Employee and account deleted successfully');
        loadEmployees();
      } catch (error) {
        setMessage(error.message || 'Failed to delete employee');
      }
    } else {
      // For iOS and Android, use Alert.alert
      Alert.alert(
        'Confirm Deletion',
        'Are you sure you want to delete this employee? This will permanently delete the employee record and their associated user account. This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await request(`/api/employees/${id}`, { method: 'DELETE' });
                setMessage('Employee and account deleted successfully');
                loadEmployees();
              } catch (error) {
                setMessage(error.message || 'Failed to delete employee');
              }
            }
          }
        ]
      );
    }
  }, [loadEmployees, request]);

  const renderEmployeeItem = useCallback(
    ({ item }) => (
      <EmployeeItem
        item={item}
        colors={t.colors}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    ),
    [handleEdit, handleDelete, t.colors]
  );
  const getItemLayout = useCallback((_, index) => ({
    length: EMPLOYEE_ITEM_HEIGHT,
    offset: EMPLOYEE_ITEM_HEIGHT * index,
    index
  }), []);

  return (
    <Screen>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.colors.text }]}>Employee Management</Text>
          <Pressable
            style={[styles.addBtn, { backgroundColor: t.colors.primary }]}
            onPress={() => setShowForm(!showForm)}
          >
            <Ionicons name={showForm ? "close" : "add"} size={20} color="#0b1220" />
            <Text style={[styles.addBtnText, { color: '#0b1220' }]}>
              {showForm ? 'Cancel' : 'Add Employee'}
            </Text>
          </Pressable>
        </View>

        {showForm && (
          <View style={[styles.form, { backgroundColor: getRGBA(t.colors.card, 0.5) }]}>
            <Text style={[styles.formTitle, { color: t.colors.text }]}>
              {editingId ? 'Edit Employee' : 'Add New Employee'}
            </Text>

            <TextInput
              style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
              placeholder="Full Name"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholderTextColor={t.colors.textSecondary}
            />

            <TextInput
              style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
              placeholder="Email Address"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              placeholderTextColor={t.colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
              placeholder="Phone Number"
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              placeholderTextColor={t.colors.textSecondary}
              keyboardType="phone-pad"
            />

            <View style={styles.roleRow}>
              {roleOptions.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.roleChip,
                    { borderColor: t.colors.border, backgroundColor: t.colors.card },
                    formData.role === option.value && {
                      borderColor: getRoleColor(option.value),
                      backgroundColor: getRGBA(getRoleColor(option.value), 0.1)
                    }
                  ]}
                  onPress={() => setFormData({ ...formData, role: option.value })}
                >
                  <Text
                    style={[
                      styles.roleText,
                      { color: t.colors.text },
                      formData.role === option.value && { color: getRoleColor(option.value), fontWeight: '700' }
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
              placeholder="Department"
              value={formData.department}
              onChangeText={(text) => setFormData({ ...formData, department: text })}
              placeholderTextColor={t.colors.textSecondary}
            />

            <TextInput
              style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
              placeholder="Hourly Rate (e.g., 25.00)"
              value={formData.hourlyRate}
              onChangeText={(text) => setFormData({ ...formData, hourlyRate: text })}
              placeholderTextColor={t.colors.textSecondary}
              keyboardType="numeric"
            />

            <Text style={[styles.label, { color: t.colors.textSecondary, marginTop: 8 }]}>
              {editingId ? 'Password (leave empty to keep current)' : 'Password (optional - creates login account)'}
            </Text>
            <TextInput
              style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
              placeholder={editingId ? "New password (min 6 characters)" : "Password for login account (min 6 characters)"}
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              placeholderTextColor={t.colors.textSecondary}
              secureTextEntry
            />
            {(passwordFocused || formData.password.length > 0) && (
              <PasswordRequirements password={formData.password} colors={t.colors} />
            )}
            {!editingId && (
              <Text style={[styles.helperText, { color: t.colors.textSecondary, marginTop: 8 }]}>
                If password is provided, a user account will be created so the employee can log in and receive tasks.
              </Text>
            )}

            {editingId && (
              <>
                <Pressable
                  style={[styles.preferencesToggle, { borderColor: t.colors.border, backgroundColor: t.colors.card }]}
                  onPress={() => setShowPreferences(!showPreferences)}
                >
                  <View style={styles.preferencesToggleHeader}>
                    <Ionicons 
                      name={showPreferences ? "chevron-down" : "chevron-forward"} 
                      size={20} 
                      color={t.colors.textSecondary} 
                    />
                    <Text style={[styles.preferencesToggleText, { color: t.colors.text }]}>
                      Location & Working Hours Preferences
                    </Text>
                  </View>
                </Pressable>

                {showPreferences && (
                  <View style={[styles.preferencesSection, { backgroundColor: getRGBA(t.colors.card, 0.3) }]}>
                    {loadingPreferences ? (
                      <Text style={[styles.helperText, { color: t.colors.textSecondary }]}>Loading preferences...</Text>
                    ) : (
                      <>
                        <Text style={[styles.label, { color: t.colors.textSecondary, marginTop: 0 }]}>
                          Default Location
                        </Text>
                        {loadingGeofences ? (
                          <Text style={[styles.helperText, { color: t.colors.textSecondary }]}>Loading locations...</Text>
                        ) : (
                          <View style={styles.locationSelect}>
                            {geofences.map((geofence) => (
                              <Pressable
                                key={geofence.id}
                                style={[
                                  styles.locationChip,
                                  { borderColor: t.colors.border, backgroundColor: t.colors.card },
                                  employeePreferences.selectedGeofenceId === geofence.id && {
                                    borderColor: t.colors.primary,
                                    backgroundColor: getRGBA(t.colors.primary, 0.1)
                                  }
                                ]}
                                onPress={() => setEmployeePreferences({
                                  ...employeePreferences,
                                  selectedGeofenceId: employeePreferences.selectedGeofenceId === geofence.id ? null : geofence.id
                                })}
                              >
                                <Text
                                  style={[
                                    styles.locationChipText,
                                    { color: t.colors.text },
                                    employeePreferences.selectedGeofenceId === geofence.id && {
                                      color: t.colors.primary,
                                      fontWeight: '700'
                                    }
                                  ]}
                                >
                                  {geofence.name}
                                </Text>
                                {employeePreferences.selectedGeofenceId === geofence.id && (
                                  <Ionicons name="checkmark-circle" size={16} color={t.colors.primary} style={{ marginLeft: 4 }} />
                                )}
                              </Pressable>
                            ))}
                            {geofences.length === 0 && (
                              <Text style={[styles.helperText, { color: t.colors.textSecondary }]}>
                                No locations available. Create locations in Manage Locations.
                              </Text>
                            )}
                          </View>
                        )}

                        <Text style={[styles.label, { color: t.colors.textSecondary, marginTop: 16 }]}>
                          Working Hours
                        </Text>
                        <View style={styles.workingHoursRow}>
                          <View style={styles.timeInputContainer}>
                            <Text style={[styles.timeLabel, { color: t.colors.textSecondary }]}>Start Time</Text>
                            <TextInput
                              style={[styles.timeInput, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
                              placeholder="08:00"
                              value={employeePreferences.workingHours.startTime}
                              onChangeText={(text) => setEmployeePreferences({
                                ...employeePreferences,
                                workingHours: { ...employeePreferences.workingHours, startTime: text }
                              })}
                              placeholderTextColor={t.colors.textSecondary}
                            />
                          </View>
                          <View style={styles.timeInputContainer}>
                            <Text style={[styles.timeLabel, { color: t.colors.textSecondary }]}>End Time</Text>
                            <TextInput
                              style={[styles.timeInput, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
                              placeholder="16:30"
                              value={employeePreferences.workingHours.endTime}
                              onChangeText={(text) => setEmployeePreferences({
                                ...employeePreferences,
                                workingHours: { ...employeePreferences.workingHours, endTime: text }
                              })}
                              placeholderTextColor={t.colors.textSecondary}
                            />
                          </View>
                        </View>
                        <Text style={[styles.helperText, { color: t.colors.textSecondary }]}>
                          Format: HH:MM (e.g., 08:00, 16:30)
                        </Text>

                        <View style={styles.preferencesActions}>
                          <Button 
                            title="Save Preferences" 
                            onPress={() => saveEmployeePreferences(editingId)} 
                            variant="secondary"
                          />
                        </View>
                      </>
                    )}
                  </View>
                )}
              </>
            )}

            <View style={styles.formActions}>
              <Button title="Cancel" onPress={resetForm} variant="secondary" />
              <Button title={editingId ? 'Update Employee' : 'Create Employee'} onPress={handleSubmit} />
            </View>
          </View>
        )}

        {message ? <Text style={[styles.message, { color: t.colors.text }]}>{message}</Text> : null}

        <Text style={[styles.label, { color: t.colors.textSecondary }]}>Search employees</Text>
        <AutocompleteInput
          data={employees.map(emp => emp.name)}
          value={searchValue}
          onChange={setSearchValue}
          onSelect={(item) => setSearchValue(item.label)}
          placeholder="Search by name, email, or department"
          containerStyle={{ marginBottom: 12 }}
        />

        <Text style={[styles.sectionTitle, { color: t.colors.text }]}>
          Employees ({filteredEmployees.length})
        </Text>

        <FlatList
          data={loading ? Array.from({ length: 4 }).map((_, idx) => ({ id: `employee-skeleton-${idx}`, __skeleton: true })) : filteredEmployees}
          keyExtractor={(item) => (item.__skeleton ? item.id : item._id)}
          scrollEnabled={false}
          contentContainerStyle={styles.employeeList}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews
          renderItem={renderEmployeeItem}
          getItemLayout={getItemLayout}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon="people-outline"
                title="No employees yet"
                subtitle="Create an employee to start tracking performance."
              />
            ) : null
          }
        />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 32
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  title: {
    fontSize: 24,
    fontWeight: '700'
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  addBtnText: {
    fontWeight: '600',
    fontSize: 14
  },
  form: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)'
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16
  },
  helperText: {
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
    fontStyle: 'italic'
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  roleChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center'
  },
  roleText: {
    fontSize: 14,
    fontWeight: '500'
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16
  },
  message: {
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 16
  },
  label: {
    marginBottom: 6,
    fontWeight: '600'
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12
  },
  loading: {
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 16
  },
  employeeList: {
    gap: 12
  },
  employeeCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    minHeight: EMPLOYEE_ITEM_HEIGHT - 12
  },
  employeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  employeeInfo: {
    flex: 1
  },
  employeeName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2
  },
  employeeEmail: {
    fontSize: 14,
    marginBottom: 4
  },
  employeeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  employeeRole: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  employeeDept: {
    fontSize: 12,
    marginLeft: 4
  },
  employeeActions: {
    flexDirection: 'row',
    gap: 8
  },
  actionBtn: {
    padding: 8,
    borderRadius: 6,
    minWidth: 36,
    alignItems: 'center'
  },
  deleteBtn: {
    // Additional styles for delete button if needed
  },
  employeeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 12
  },
  statItem: {
    alignItems: 'center',
    flex: 1
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600'
  },
  preferencesToggle: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    marginBottom: 12
  },
  preferencesToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  preferencesToggleText: {
    fontSize: 16,
    fontWeight: '600'
  },
  preferencesSection: {
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)'
  },
  locationSelect: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 100
  },
  locationChipText: {
    fontSize: 14,
    fontWeight: '500'
  },
  workingHoursRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8
  },
  timeInputContainer: {
    flex: 1
  },
  timeLabel: {
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '500'
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16
  },
  preferencesActions: {
    marginTop: 16
  }
});

export default EmployeeScreen;
