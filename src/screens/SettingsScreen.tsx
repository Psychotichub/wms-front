// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Screen from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useThemeTokens, useTheme } from '../theme/ThemeProvider';
import { elevation } from '../theme/elevation';
import Button from '../components/ui/Button';
import { useI18n } from '../i18n/I18nProvider';

const DELETE_ACCOUNT_PHRASE = 'DELETE MY ACCOUNT';

const SettingItem = ({ icon, label, value, onPress, t, showArrow = true }) => (
  <Pressable
    disabled={!onPress}
    style={({ pressed }) => [
      styles.item,
      elevation.subtle,
      { backgroundColor: t.colors.card, borderColor: t.colors.border },
      pressed && onPress && { opacity: 0.7 }
    ]}
    onPress={onPress}
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={onPress ? `${label}, ${value}` : undefined}
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
  const { user, logout, apiUrl, getSites, addSite, setActiveSite, request } = useAuth();
  const t = useThemeTokens();
  const { t: tr } = useI18n();
  const { themePreference, setThemePreference } = useTheme();
  const [sites, setSites] = useState([]);
  const [activeSite, setActiveSiteState] = useState(user?.site || '');
  const [newSite, setNewSite] = useState('');
  const [siteMessage, setSiteMessage] = useState('');
  const [isLoadingSites, setIsLoadingSites] = useState(false);
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [privacyExportLoading, setPrivacyExportLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePhraseInput, setDeletePhraseInput] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

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

  const loadDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const data = await request('/api/devices');
      setDevices(Array.isArray(data.devices) ? data.devices : []);
    } catch {
      setDevices([]);
    } finally {
      setDevicesLoading(false);
    }
  }, [request]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleUnbindDevice = async (deviceId) => {
    try {
      await request(`/api/devices/unbind/${encodeURIComponent(deviceId)}`, { method: 'POST' });
      await loadDevices();
    } catch (e) {
      Alert.alert(tr('settings.deviceRemoveTitle'), e.message || tr('settings.deviceRemoveFailed'));
    }
  };

  const handleExportMaterials = async () => {
    setExportLoading(true);
    try {
      const csv = await request('/api/export/materials.csv');
      if (typeof csv !== 'string') {
        throw new Error('Unexpected export format');
      }
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'materials-export.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }
      const baseDir = FileSystem.cacheDirectory;
      if (!baseDir) {
        Alert.alert(tr('settings.exportMaterials'), tr('settings.exportStarted'));
        return;
      }
      const path = `${baseDir}materials-export.csv`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: tr('settings.materialsShareTitle') });
      } else {
        Alert.alert(tr('settings.exportMaterials'), tr('settings.exportStarted'));
      }
    } catch (e) {
      Alert.alert(tr('settings.exportFailed'), e.message || tr('settings.exportUnknownError'));
    } finally {
      setExportLoading(false);
    }
  };

  const handlePrivacyExport = async () => {
    setPrivacyExportLoading(true);
    try {
      const data = await request('/api/privacy/export');
      const str = JSON.stringify(data, null, 2);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([str], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'privacy-export.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }
      const baseDir = FileSystem.cacheDirectory;
      if (!baseDir) {
        Alert.alert(tr('settings.exportMyData'), tr('settings.exportStarted'));
        return;
      }
      const path = `${baseDir}privacy-export.json`;
      await FileSystem.writeAsStringAsync(path, str, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: tr('settings.exportMyData') });
      } else {
        Alert.alert(tr('settings.exportMyData'), tr('settings.exportStarted'));
      }
    } catch (e) {
      Alert.alert(tr('settings.exportFailed'), e.message || tr('settings.exportUnknownError'));
    } finally {
      setPrivacyExportLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (deletePhraseInput.trim() !== DELETE_ACCOUNT_PHRASE) {
      Alert.alert(tr('settings.deleteConfirmTitle'), tr('settings.deleteWrongPhrase'));
      return;
    }
    setDeleteSubmitting(true);
    try {
      await request('/api/privacy/delete-account', {
        method: 'POST',
        body: JSON.stringify({ password: deletePassword, confirmPhrase: DELETE_ACCOUNT_PHRASE })
      });
      setDeleteOpen(false);
      setDeletePassword('');
      setDeletePhraseInput('');
      await logout();
    } catch (e) {
      Alert.alert(tr('settings.deleteFailed'), e.message || tr('settings.exportUnknownError'));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleAddSite = async () => {
    const value = newSite.trim();
    if (!value) return;
    setSiteMessage('');
    const data = await addSite(value);
    if (data?.sites) {
      setSites(data.sites);
      setActiveSiteState(data.activeSite || value);
      setNewSite('');
      setSiteMessage(tr('settings.siteAdded'));
    }
  };

  const handleSelectSite = async (site) => {
    if (site === activeSite) return;
    setSiteMessage('');
    const updatedUser = await setActiveSite(site);
    if (updatedUser?.site) {
      setActiveSiteState(updatedUser.site);
      setSiteMessage(tr('settings.activeSiteSet', { site: updatedUser.site }));
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.colors.text }]}>{tr('settings.title')}</Text>
          <Text style={[styles.subtitle, { color: t.colors.textSecondary }]}>{tr('settings.subtitle')}</Text>
        </View>

        <SectionHeader title={tr('settings.profile')} t={t} />
        <View style={styles.section}>
          <SettingItem
            icon="person-outline"
            label={tr('settings.name')}
            value={user?.name || tr('settings.notSet')}
            t={t}
            showArrow={false}
          />
          <SettingItem
            icon="business-outline"
            label={tr('settings.company')}
            value={user?.company || tr('settings.notSet')}
            t={t}
            showArrow={false}
          />
          <SettingItem
            icon="location-outline"
            label={tr('settings.site')}
            value={user?.site || tr('settings.notSet')}
            t={t}
            showArrow={false}
          />
          <SettingItem
            icon="shield-checkmark-outline"
            label={tr('settings.role')}
            value={user?.role || tr('settings.roleUser')}
            t={t}
            showArrow={false}
          />
        </View>

        <SectionHeader title={tr('settings.appearance')} t={t} />
        <View style={styles.section}>
          <Text style={[styles.themeHelper, { color: t.colors.textSecondary }]}>{tr('settings.theme')}</Text>
          <View style={styles.themeRow}>
            {(['system', 'light', 'dark']).map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setThemePreference(opt)}
                accessibilityRole="button"
                accessibilityLabel={
                  opt === 'system'
                    ? tr('settings.themeA11ySystem')
                    : opt === 'light'
                      ? tr('settings.themeA11yLight')
                      : tr('settings.themeA11yDark')
                }
                accessibilityState={{ selected: themePreference === opt }}
                style={({ focused }) => [
                  styles.themeChip,
                  { borderColor: t.colors.border, backgroundColor: t.colors.card },
                  themePreference === opt && { borderColor: t.colors.primary, borderWidth: 2 },
                  Platform.OS === 'web' &&
                    focused && {
                      outlineWidth: 2,
                      outlineStyle: 'solid',
                      outlineColor: t.colors.focusRing,
                      outlineOffset: 2
                    }
                ]}
              >
                <Text style={[styles.themeChipText, { color: t.colors.text }]}>
                  {opt === 'system'
                    ? tr('settings.themeSystem')
                    : opt === 'light'
                      ? tr('settings.themeLight')
                      : tr('settings.themeDark')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {isAdmin ? (
          <>
            <SectionHeader title={tr('settings.sites')} t={t} />
            <View style={styles.section}>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.card }
                ]}
                placeholder={tr('settings.addSitePlaceholder')}
                value={newSite}
                onChangeText={setNewSite}
                placeholderTextColor={t.colors.textSecondary}
              />
              <Button
                title={isLoadingSites ? tr('settings.saving') : tr('settings.addSiteButton')}
                onPress={handleAddSite}
                disabled={isLoadingSites || !newSite.trim()}
              />
              {siteMessage ? <Text style={[styles.siteMessage, { color: t.colors.textSecondary }]}>{siteMessage}</Text> : null}
              <View style={styles.siteList}>
                {displayedSites.length === 0 ? (
                  <Text style={[styles.siteEmpty, { color: t.colors.textSecondary }]}>{tr('settings.noSitesYet')}</Text>
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
                        <Text style={[styles.siteActive, { color: t.colors.primary }]}>{tr('settings.active')}</Text>
                      ) : (
                        <Text style={[styles.siteSwitch, { color: t.colors.textSecondary }]}>{tr('settings.select')}</Text>
                      )}
                    </Pressable>
                  ))
                )}
              </View>
            </View>
          </>
        ) : null}

        <SectionHeader title={tr('settings.locations')} t={t} />
        <View style={styles.section}>
          <SettingItem
            icon="location-outline"
            label={tr('settings.locationSelection')}
            value={tr('settings.locationSelectionValue')}
            onPress={() => navigation.navigate('Location Selection')}
            t={t}
          />
          {isAdmin ? (
            <SettingItem
              icon="map-outline"
              label={tr('settings.manageLocations')}
              value={tr('settings.manageLocationsValue')}
              onPress={() => navigation.navigate('Manage Locations')}
              t={t}
            />
          ) : null}
        </View>

        <SectionHeader title={tr('settings.attendance')} t={t} />
        <View style={styles.section}>
          <SettingItem
            icon="document-text-outline"
            label={tr('settings.attendanceHistory')}
            value={tr('settings.attendanceHistoryValue')}
            onPress={() => navigation.navigate('Attendance History')}
            t={t}
          />
        </View>

        {isAdmin ? (
          <>
            <SectionHeader title={tr('settings.userManagement')} t={t} />
            <View style={styles.section}>
              <SettingItem
                icon="person-add-outline"
                label={tr('settings.createUser')}
                value={tr('settings.createUserValue')}
                onPress={() => navigation.navigate('Create User')}
                t={t}
              />
            </View>
          </>
        ) : null}

        <SectionHeader title={tr('settings.devicesTitle')} t={t} />
        <View style={styles.section}>
          {devicesLoading ? (
            <ActivityIndicator color={t.colors.primary} style={{ marginVertical: 8 }} />
          ) : devices.filter((d) => d.isActive).length === 0 ? (
            <Text style={[styles.siteEmpty, { color: t.colors.textSecondary }]}>{tr('settings.devicesEmpty')}</Text>
          ) : (
            devices
              .filter((d) => d.isActive)
              .map((d) => (
                <View
                  key={d.deviceId}
                  style={[
                    styles.deviceRow,
                    { borderColor: t.colors.border, backgroundColor: t.colors.card },
                    elevation.subtle
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.deviceName, { color: t.colors.text }]}>
                      {d.deviceName || d.deviceId?.slice(0, 12) || tr('settings.unknownDevice')}
                    </Text>
                    <Text style={[styles.deviceMeta, { color: t.colors.textSecondary }]}>
                      {d.deviceType || tr('settings.unknownType')}
                      {d.lastUsed ? ` · ${new Date(d.lastUsed).toLocaleString()}` : ''}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleUnbindDevice(d.deviceId)}
                    style={({ pressed }) => [
                      styles.revokeBtn,
                      { borderColor: t.colors.danger },
                      pressed && { opacity: 0.7 }
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={tr('settings.devicesRevoke')}
                  >
                    <Text style={{ color: t.colors.danger, fontWeight: '700', fontSize: 12 }}>
                      {tr('settings.devicesRevoke')}
                    </Text>
                  </Pressable>
                </View>
              ))
          )}
        </View>

        <SectionHeader title={tr('settings.dataSection')} t={t} />
        <View style={styles.section}>
          <Text style={[styles.legalBlock, { color: t.colors.textSecondary }]}>{tr('settings.gdprIntro')}</Text>
          <Text style={[styles.legalBlock, { color: t.colors.textSecondary }]}>{tr('settings.gdprExportLegal')}</Text>
          <Text style={[styles.legalBlock, { color: t.colors.textSecondary }]}>{tr('settings.gdprDeleteLegal')}</Text>
          <Button
            title={privacyExportLoading ? '…' : tr('settings.exportMyData')}
            onPress={handlePrivacyExport}
            disabled={privacyExportLoading}
          />
          <Text style={[styles.privacyHint, { color: t.colors.textSecondary }]}>{tr('settings.exportMyDataHint')}</Text>
          <View style={{ marginTop: 12 }}>
            <Button title={tr('settings.deleteAccount')} onPress={() => setDeleteOpen(true)} disabled={deleteSubmitting} />
          </View>
          {isAdmin ? (
            <View style={{ marginTop: 16 }}>
              <SectionHeader title={tr('settings.materialsExportSection')} t={t} />
              <Button
                title={exportLoading ? '…' : tr('settings.exportMaterials')}
                onPress={handleExportMaterials}
                disabled={exportLoading}
              />
            </View>
          ) : null}
        </View>

        <SectionHeader title={tr('settings.security')} t={t} />
        <View style={styles.section}>
          <SettingItem
            icon="lock-closed-outline"
            label={tr('settings.changePassword')}
            value={tr('settings.changePasswordValue')}
            onPress={() => Alert.alert(tr('settings.changePassword'), tr('settings.passwordComingSoon'))}
            t={t}
          />
          <SettingItem
            icon="log-out-outline"
            label={tr('settings.accountLogout')}
            value={tr('settings.accountLogoutValue')}
            onPress={logout}
            t={t}
          />
        </View>

        <SectionHeader title={tr('settings.support')} t={t} />
        <View style={styles.section}>
          <SettingItem
            icon="globe-outline"
            label={tr('settings.apiUrl')}
            value={apiUrl}
            t={t}
            showArrow={false}
          />
          <SettingItem
            icon="information-circle-outline"
            label={tr('settings.version')}
            value="1.0.0 (Psychotic)"
            t={t}
            showArrow={false}
          />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: t.colors.textSecondary }]}>{tr('settings.footerAppName')}</Text>
          <Text style={[styles.footerText, { color: t.colors.textSecondary }]}>{tr('settings.footerCopyright')}</Text>
        </View>

        <Modal
          visible={deleteOpen}
          transparent
          animationType="fade"
          onRequestClose={() => !deleteSubmitting && setDeleteOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFillObject}
              onPress={() => !deleteSubmitting && setDeleteOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={tr('settings.cancel')}
            />
            <View style={styles.modalCardWrap} pointerEvents="box-none">
              <View style={[styles.modalCard, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
                <Text style={[styles.modalTitle, { color: t.colors.text }]}>{tr('settings.deleteConfirmTitle')}</Text>
                <Text style={[styles.modalBody, { color: t.colors.textSecondary }]}>{tr('settings.deleteConfirmMessage')}</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.modalInput,
                    { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.background }
                  ]}
                  placeholder={DELETE_ACCOUNT_PHRASE}
                  placeholderTextColor={t.colors.textSecondary}
                  value={deletePhraseInput}
                  onChangeText={setDeletePhraseInput}
                  autoCapitalize="characters"
                  editable={!deleteSubmitting}
                />
                <TextInput
                  style={[
                    styles.input,
                    styles.modalInput,
                    { borderColor: t.colors.border, color: t.colors.text, backgroundColor: t.colors.background }
                  ]}
                  placeholder={tr('settings.password')}
                  placeholderTextColor={t.colors.textSecondary}
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  secureTextEntry
                  editable={!deleteSubmitting}
                />
                <View style={styles.modalActions}>
                  <Button title={tr('settings.cancel')} onPress={() => !deleteSubmitting && setDeleteOpen(false)} disabled={deleteSubmitting} />
                  <Button
                    title={deleteSubmitting ? '…' : tr('settings.confirmDelete')}
                    onPress={handleConfirmDelete}
                    disabled={deleteSubmitting}
                  />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  privacyHint: {
    fontSize: 12,
    marginTop: 8
  },
  legalBlock: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  modalCardWrap: {
    width: '100%',
    maxWidth: 420,
    zIndex: 1
  },
  modalCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800'
  },
  modalBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20
  },
  modalInput: {
    marginTop: 12
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
    justifyContent: 'flex-end'
  },
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
    padding: 12
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
    borderWidth: 1
  },
  themeHelper: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4
  },
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  themeChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1
  },
  themeChipText: {
    fontSize: 14,
    fontWeight: '600'
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
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '700'
  },
  deviceMeta: {
    fontSize: 12,
    marginTop: 4
  },
  revokeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1
  }
});

export default SettingsScreen;
