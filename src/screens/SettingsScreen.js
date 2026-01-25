import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable, Platform, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens } from '../theme/ThemeProvider';
import Button from '../components/ui/Button';

const SettingItem = ({ icon, label, value, onPress, t, showArrow = true }) => (
  <Pressable
    style={({ pressed }) => [
      styles.item,
      { backgroundColor: t.colors.card, borderColor: t.colors.border },
      pressed && { opacity: 0.7 }
    ]}
    onPress={onPress}
  >
    <View style={styles.itemLeft}>
      <View style={[styles.iconWrap, { backgroundColor: t.colors.background }]}>
        <Ionicons name={icon} size={18} color={t.colors.primary} />
      </View>
      <View>
        <Text style={[styles.label, { color: t.colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.value, { color: t.colors.text }]}>{value}</Text>
      </View>
    </View>
    {showArrow ? <Ionicons name="chevron-forward" size={18} color={t.colors.textSecondary} /> : null}
  </Pressable>
);

const SectionHeader = ({ title, t }) => (
  <Text style={[styles.sectionTitle, { color: t.colors.primary }]}>{title.toUpperCase()}</Text>
);

const SettingsScreen = () => {
  const navigation = useNavigation();
  const { user, logout, apiUrl, getSites, addSite, setActiveSite } = useAuth();
  const t = useThemeTokens();
  const [sites, setSites] = useState([]);
  const [activeSite, setActiveSiteState] = useState(user?.site || '');
  const [newSite, setNewSite] = useState('');
  const [siteMessage, setSiteMessage] = useState('');
  const [isLoadingSites, setIsLoadingSites] = useState(false);

  const isAdmin = user?.role === 'admin';

  const displayedSites = useMemo(() => {
    const base = sites.length
      ? sites
      : (Array.isArray(user?.sites) && user.sites.length ? user.sites : []);
    const list = base.length ? base : (user?.site ? [user.site] : []);
    return Array.from(new Set(list.filter(Boolean)));
  }, [sites, user?.sites, user?.site]);

  const loadSites = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingSites(true);
    try {
      const data = await getSites();
      setSites(data.sites || []);
      if (data.activeSite) {
        setActiveSiteState(data.activeSite);
      }
    } catch (err) {
      setSiteMessage(err.message);
    } finally {
      setIsLoadingSites(false);
    }
  }, [getSites, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      loadSites();
    }
  }, [isAdmin, loadSites]);

  useEffect(() => {
    setActiveSiteState(user?.site || '');
  }, [user?.site]);

  const handleAddSite = async () => {
    const value = newSite.trim();
    if (!value) return;
    setSiteMessage('');
    const data = await addSite(value);
    if (data?.sites) {
      setSites(data.sites);
      setActiveSiteState(data.activeSite || value);
      setNewSite('');
      setSiteMessage('Site added');
    }
  };

  const handleSelectSite = async (site) => {
    if (site === activeSite) return;
    setSiteMessage('');
    const updatedUser = await setActiveSite(site);
    if (updatedUser?.site) {
      setActiveSiteState(updatedUser.site);
      setSiteMessage(`Active site set to ${updatedUser.site}`);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.colors.text }]}>Settings</Text>
          <Text style={[styles.subtitle, { color: t.colors.textSecondary }]}>Manage your preferences</Text>
        </View>

        <SectionHeader title="Profile" t={t} />
        <View style={styles.section}>
          <SettingItem
            icon="person-outline"
            label="Name"
            value={user?.name || 'Not set'}
            t={t}
            showArrow={false}
          />
          <SettingItem
            icon="business-outline"
            label="Company"
            value={user?.company || 'Not set'}
            t={t}
            showArrow={false}
          />
          <SettingItem
            icon="location-outline"
            label="Site"
            value={user?.site || 'Not set'}
            t={t}
            showArrow={false}
          />
          <SettingItem
            icon="shield-checkmark-outline"
            label="Role"
            value={user?.role || 'User'}
            t={t}
            showArrow={false}
          />
        </View>

        {isAdmin ? (
          <>
            <SectionHeader title="Sites" t={t} />
            <View style={styles.section}>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }
                ]}
                placeholder="Add a site (e.g. Arsi)"
                value={newSite}
                onChangeText={setNewSite}
                placeholderTextColor={t.colors.textSecondary}
              />
              <Button
                title={isLoadingSites ? 'Saving...' : 'Add Site'}
                onPress={handleAddSite}
                disabled={isLoadingSites || !newSite.trim()}
              />
              {siteMessage ? <Text style={[styles.siteMessage, { color: t.colors.textSecondary }]}>{siteMessage}</Text> : null}
              <View style={styles.siteList}>
                {displayedSites.length === 0 ? (
                  <Text style={[styles.siteEmpty, { color: t.colors.textSecondary }]}>
                    No sites configured yet.
                  </Text>
                ) : (
                  displayedSites.map((site) => (
                    <Pressable
                      key={site}
                      onPress={() => handleSelectSite(site)}
                      style={[
                        styles.siteItem,
                        { borderColor: t.colors.border, backgroundColor: t.colors.card },
                        site === activeSite && { borderColor: t.colors.primary }
                      ]}
                    >
                      <Text style={[styles.siteName, { color: t.colors.text }]}>{site}</Text>
                      {site === activeSite ? (
                        <Text style={[styles.siteActive, { color: t.colors.primary }]}>Active</Text>
                      ) : (
                        <Text style={[styles.siteSwitch, { color: t.colors.textSecondary }]}>Select</Text>
                      )}
                    </Pressable>
                  ))
                )}
              </View>
            </View>
          </>
        ) : null}

        <SectionHeader title="Locations" t={t} />
        <View style={styles.section}>
          <SettingItem
            icon="location-outline"
            label="Location Selection"
            value="Select work location"
            onPress={() => navigation.navigate('Location Selection')}
            t={t}
          />
          {isAdmin ? (
            <SettingItem
              icon="map-outline"
              label="Manage Locations"
              value="Create and edit geofences"
              onPress={() => navigation.navigate('Manage Locations')}
              t={t}
            />
          ) : null}
        </View>

        <SectionHeader title="Attendance" t={t} />
        <View style={styles.section}>
          <SettingItem
            icon="document-text-outline"
            label="Attendance History"
            value="View past attendance records"
            onPress={() => navigation.navigate('Attendance History')}
            t={t}
          />
        </View>

        {isAdmin ? (
          <>
            <SectionHeader title="User Management" t={t} />
            <View style={styles.section}>
              <SettingItem
                icon="person-add-outline"
                label="Create User"
                value="Add new user accounts"
                onPress={() => navigation.navigate('Create User')}
                t={t}
              />
            </View>
          </>
        ) : null}

        <SectionHeader title="Security" t={t} />
        <View style={styles.section}>
          <SettingItem
            icon="lock-closed-outline"
            label="Password"
            value="Change password"
            onPress={() => alert('Feature coming soon')}
            t={t}
          />
          <SettingItem
            icon="log-out-outline"
            label="Account"
            value="Logout of session"
            onPress={logout}
            t={t}
          />
        </View>

        <SectionHeader title="Support" t={t} />
        <View style={styles.section}>
          <SettingItem
            icon="globe-outline"
            label="API URL"
            value={apiUrl}
            t={t}
            showArrow={false}
          />
          <SettingItem
            icon="information-circle-outline"
            label="Version"
            value="1.0.0 (Psychotic)"
            t={t}
            showArrow={false}
          />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: t.colors.textSecondary }]}>
            Work Management System (WMS)
          </Text>
          <Text style={[styles.footerText, { color: t.colors.textSecondary }]}>
            © 2026 Psychotic Deployments
          </Text>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  header: { marginBottom: 24, marginTop: 8 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 16, marginTop: 4 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4
  },
  section: {
    gap: 8
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff'
  },
  siteMessage: {
    fontSize: 12
  },
  siteList: {
    gap: 8
  },
  siteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1
  },
  siteName: {
    fontSize: 14,
    fontWeight: '600'
  },
  siteActive: {
    fontSize: 12,
    fontWeight: '700'
  },
  siteSwitch: {
    fontSize: 12,
    fontWeight: '600'
  },
  siteEmpty: {
    fontSize: 13,
    paddingVertical: 4
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
      default: { boxShadow: '0px 2px 4px rgba(0,0,0,0.05)' }
    })
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  label: {
    fontSize: 12,
    fontWeight: '500'
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 1
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
    gap: 4
  },
  footerText: {
    fontSize: 12
  }
});

export default SettingsScreen;
