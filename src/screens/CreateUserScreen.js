import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, Platform, FlatList, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import SiteRequiredNotice from '../components/SiteRequiredNotice';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import SkeletonBar from '../components/ui/SkeletonBar';

const USER_ROW_HEIGHT = 48;

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

const UserRow = React.memo(({ item, colors, onSelectUser, onDelete }) => {
  if (item.__skeleton) {
    return (
      <View style={[styles.row, { borderColor: colors.border }]}>
        <View style={[styles.cell, { flex: 2 }]}>
          <SkeletonBar width="60%" height={12} />
          <SkeletonBar width="40%" height={10} style={{ marginTop: 6 }} />
        </View>
        <View style={styles.cell}>
          <SkeletonBar width="50%" height={12} />
        </View>
        <View style={[styles.cell, styles.actionCell, { flex: 2 }]}>
          <SkeletonBar width={24} height={12} />
          <SkeletonBar width={24} height={12} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <View style={[styles.cell, { flex: 2 }]}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>{item.name}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.email}</Text>
      </View>
      <Text style={[styles.cell, { color: colors.text }]}>{item.role}</Text>
      <View style={[styles.cell, styles.actionCell, { flex: 2 }]}>
        <Pressable
          style={[styles.actionBtn, { backgroundColor: getRGBA(colors.primary, 0.12) }]}
          onPress={() => onSelectUser(item)}
        >
          <Ionicons name="key-outline" size={16} color={colors.primary} />
        </Pressable>
        <Pressable
          style={[styles.actionBtn, { backgroundColor: getRGBA(colors.danger, 0.12) }]}
          onPress={() => onDelete(item)}
        >
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
        </Pressable>
      </View>
    </View>
  );
});
UserRow.displayName = 'UserRow';

const CreateUserScreen = () => {
  const navigation = useNavigation();
  const { request, user } = useAuth();
  const t = useThemeTokens();
  const hasSite = Boolean(user?.site);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const loadUsers = useCallback(async () => {
    if (!hasSite) {
      setUsers([]);
      return;
    }
    setLoading(true);
    try {
      const data = await request('/api/users');
      setUsers(data.users || []);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }, [hasSite, request]);

  useFocusEffect(
    useCallback(() => {
      if (hasSite) {
        loadUsers();
      }
    }, [hasSite, loadUsers])
  );

  const handleSubmit = async () => {
    setMessage('');
    try {
      await request('/api/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role, company })
      });
      setName('');
      setEmail('');
      setPassword('');
      setRole('user');
      setCompany('');
      setMessage('User created');
      loadUsers();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handleUpdatePassword = async () => {
    if (!selectedUser || !newPassword) return;
    setMessage('');
    try {
      await request(`/api/users/${selectedUser._id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password: newPassword })
      });
      setMessage(`Password updated for ${selectedUser.name}`);
      setSelectedUser(null);
      setNewPassword('');
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handleDeleteUser = useCallback(async (userItem) => {
    if (!userItem || !userItem._id) return;
    
    const userName = userItem.name || userItem.email || 'this user';
    const isWeb = Platform.OS === 'web';
    
    // Show confirmation dialog
    if (isWeb) {
      const shouldDelete = window.confirm(
        `Are you sure you want to delete the user account for ${userName}? This action cannot be undone.`
      );
      if (!shouldDelete) {
        return;
      }
      
      // Web path - execute delete
      setMessage('');
      try {
        await request(`/api/users/${userItem._id}`, { method: 'DELETE' });
        setMessage('User deleted');
        loadUsers();
      } catch (err) {
        setMessage(err.message);
      }
    } else {
      // For iOS and Android, use Alert.alert
      // Since Alert.alert is not async, we'll use a promise wrapper
      return new Promise((resolve) => {
        Alert.alert(
          'Delete User Account',
          `Are you sure you want to delete the user account for ${userName}? This action cannot be undone.`,
          [
            { 
              text: 'Cancel', 
              style: 'cancel',
              onPress: () => {
                resolve();
              }
            },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  setMessage('');
                  await request(`/api/users/${userItem._id}`, { method: 'DELETE' });
                  setMessage('User deleted');
                  loadUsers();
                  resolve();
                } catch (err) {
                  setMessage(err.message);
                  resolve();
                }
              }
            }
          ]
        );
      });
    }
  }, [loadUsers, request]);

  const renderUserItem = useCallback(
    ({ item }) => (
      <UserRow
        item={item}
        colors={t.colors}
        onSelectUser={setSelectedUser}
        onDelete={handleDeleteUser}
      />
    ),
    [handleDeleteUser, t.colors]
  );
  const getItemLayout = useCallback((_, index) => ({
    length: USER_ROW_HEIGHT,
    offset: USER_ROW_HEIGHT * index,
    index
  }), []);

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
        <View style={[styles.header, { backgroundColor: t.colors.card, borderBottomColor: t.colors.border }]}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={t.colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: t.colors.text }]}>Create User</Text>
          <View style={styles.headerRight} />
        </View>
        <Text style={[styles.title, { color: t.colors.text }]}>Create User</Text>
        <TextInput
          style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
          placeholder="Name"
          value={name}
          onChangeText={setName}
          placeholderTextColor={t.colors.textSecondary}
        />
        <TextInput
          style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholderTextColor={t.colors.textSecondary}
        />
        <TextInput
          style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
          placeholder="Initial Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholderTextColor={t.colors.textSecondary}
        />
        <TextInput
          style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
          placeholder="Company (optional)"
          value={company}
          onChangeText={setCompany}
          placeholderTextColor={t.colors.textSecondary}
        />
        <TextInput
          style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }]}
          placeholder="Role (admin/user)"
          value={role}
          onChangeText={setRole}
          placeholderTextColor={t.colors.textSecondary}
        />
        <Button title="Create Account" onPress={handleSubmit} />

        {message ? <Text style={[styles.message, { color: t.colors.text }]}>{message}</Text> : null}

        <Text style={[styles.tableTitle, { color: t.colors.text, marginTop: 32 }]}>Managed Users</Text>
        
        <View style={[styles.table, { borderColor: t.colors.border }]}>
          <View style={[styles.row, styles.headerRow, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <Text style={[styles.cell, styles.headerCell, { color: t.colors.text, flex: 2 }]}>User</Text>
            <Text style={[styles.cell, styles.headerCell, { color: t.colors.text }]}>Role</Text>
            <Text style={[styles.cell, styles.headerCell, { color: t.colors.text, flex: 2 }]}>Action</Text>
          </View>
          <FlatList
            data={loading ? Array.from({ length: 4 }).map((_, idx) => ({ id: `user-skeleton-${idx}`, __skeleton: true })) : users}
            keyExtractor={(item) => (item.__skeleton ? item.id : item._id)}
            scrollEnabled={false}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={7}
            removeClippedSubviews
            renderItem={renderUserItem}
            getItemLayout={getItemLayout}
          />
        </View>
        {!loading && users.length === 0 ? (
          <EmptyState
            icon="person-add-outline"
            title="No users yet"
            subtitle="Create a user to manage accounts here."
          />
        ) : null}

        {selectedUser && (
          <View style={[styles.modal, { backgroundColor: t.colors.card, borderColor: t.colors.primary }]}>
            <Text style={[styles.modalTitle, { color: t.colors.text }]}>Reset Password for {selectedUser.name}</Text>
            <TextInput
              style={[styles.input, { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.background }]}
              placeholder="New Password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholderTextColor={t.colors.textSecondary}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title="Update" onPress={handleUpdatePassword} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="secondary" onPress={() => setSelectedUser(null)} />
              </View>
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 16
  },
  backButton: {
    padding: 8,
    borderRadius: 8
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center'
  },
  headerRight: {
    width: 40
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12
  },
  message: { marginTop: 16, textAlign: 'center', fontWeight: '600' },
  tableTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  table: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  row: { flexDirection: 'row', borderBottomWidth: 1, alignItems: 'center', minHeight: USER_ROW_HEIGHT },
  headerRow: { },
  cell: { flex: 1, paddingVertical: 10, paddingHorizontal: 8 },
  headerCell: { fontWeight: '700' },
  actionCell: { flexDirection: 'row', gap: 4 },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6 },
  modal: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 5 },
      default: { boxShadow: '0px 4px 12px rgba(0,0,0,0.1)' }
    })
  },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 }
});

export default CreateUserScreen;
