import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Animated,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import * as Contacts from 'expo-contacts';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { createApi } from '../lib/api';
import { hashPhones } from '../lib/phone-hash.util';

export type FindFriendsModalProps = {
  visible: boolean;
  onClose: (count?: number) => void;
};

export function FindFriendsModal({ visible, onClose }: FindFriendsModalProps) {
  const { getToken } = useAuth();
  const api = createApi(getToken!);
  const queryClient = useQueryClient();

  const [deviceContacts, setDeviceContacts] = useState<Array<{ name: string; phone: string }>>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [needsFullAccess, setNeedsFullAccess] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [contactsInPlaza, setContactsInPlaza] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const noteWiggle = useRef(new Animated.Value(0)).current;
  const tenSecondTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStartedWiggleTimer = useRef(false);

  const runNoteWiggle = () => {
    Animated.sequence([
      Animated.timing(noteWiggle, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(noteWiggle, { toValue: -1, duration: 100, useNativeDriver: true }),
      Animated.timing(noteWiggle, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(noteWiggle, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start(() => noteWiggle.setValue(0));
  };

  // When modal closes, clear the wiggle timer and reset so next time we can start again
  useEffect(() => {
    if (!visible) {
      if (tenSecondTimer.current) {
        clearTimeout(tenSecondTimer.current);
        tenSecondTimer.current = null;
      }
      hasStartedWiggleTimer.current = false;
    }
  }, [visible]);

  // Start 10s wiggle timer only when exactly one user is selected; wiggle runs once at 10s. Re-opening with 2+ selected does not wiggle.
  useEffect(() => {
    if (!visible) return;
    if (selectedContacts.size < 1) {
      if (tenSecondTimer.current) {
        clearTimeout(tenSecondTimer.current);
        tenSecondTimer.current = null;
      }
      hasStartedWiggleTimer.current = false;
      return;
    }
    if (selectedContacts.size > 1) return; // e.g. re-opened with 2+ already selected — never start timer
    if (hasStartedWiggleTimer.current) return;
    hasStartedWiggleTimer.current = true;
    tenSecondTimer.current = setTimeout(runNoteWiggle, 10000);
  }, [visible, selectedContacts.size]);

  const noteRotation = noteWiggle.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-4deg', '0deg', '4deg'],
  });

  const checkContactsMutation = useMutation({ mutationFn: api.checkContacts });
  const matchContactsMutation = useMutation({
    mutationFn: api.matchContacts,
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to match contacts. Please try again.', [{ text: 'OK' }]);
    },
  });

  const loadContacts = async () => {
    setIsLoadingContacts(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Contacts permission is required to sync your contacts.', [{ text: 'OK' }]);
        setIsLoadingContacts(false);
        return;
      }
      setDeviceContacts([]);
      const result = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });
      const contacts = result.data
        .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0)
        .map((c) => ({
          name: c.name || 'Unknown',
          phone: (c.phoneNumbers?.[0]?.number || '').replace(/\D/g, ''),
        }))
        .filter((item) => item.phone.length >= 10);
      const hasLimitedAccess = contacts.length < 5 && result.data.length < 5;
      setNeedsFullAccess(hasLimitedAccess);
      setDeviceContacts(contacts);
      if (contacts.length > 0) {
        await checkContactsInPlaza(contacts);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      setDeviceContacts([]);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const checkContactsInPlaza = async (contacts: Array<{ name: string; phone: string }>) => {
    try {
      if (contacts.length === 0) return;
      const phoneNumbers = contacts.map((c) => c.phone);
      const phoneHashes = await hashPhones(phoneNumbers, api.hashPhones);
      const checkResult = await api.checkContacts(phoneHashes);
      const plazaUserPhones = new Set<string>();
      const hashToPhone = new Map<string, string>();
      for (let i = 0; i < phoneNumbers.length; i++) {
        hashToPhone.set(phoneHashes[i], phoneNumbers[i]);
      }
      checkResult.existingUsers.forEach((user: { phoneHash: string }) => {
        const phone = hashToPhone.get(user.phoneHash);
        if (phone) plazaUserPhones.add(phone);
      });
      setContactsInPlaza(plazaUserPhones);
    } catch (error) {
      console.error('Error checking contacts in Plaza:', error);
    }
  };

  const handleInviteContact = async (contact: { name: string; phone: string }) => {
    try {
      let inviteCode: string;
      try {
        const inviteResult = await api.generateInvite();
        inviteCode = inviteResult.code;
      } catch {
        const chars = '0123456789abcdef';
        inviteCode = Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      }
      const normalizedPhone = contact.phone.startsWith('+') ? contact.phone : contact.phone.length === 10 ? `+1${contact.phone}` : `+${contact.phone}`;
      const appStoreUrl = 'https://apps.apple.com/app/id/YOUR_APP_ID';
      const message = `Join me on Plaza! Download here: ${appStoreUrl}\n\nInvite code: ${inviteCode}`;
      const smsUrl = `sms:${normalizedPhone}?body=${encodeURIComponent(message)}`;
      const canOpen = await Linking.canOpenURL(smsUrl);
      if (canOpen) {
        await Linking.openURL(smsUrl);
      } else {
        await Linking.openURL(`sms:${normalizedPhone}`);
        await Clipboard.setStringAsync(message);
        Alert.alert('SMS Opened', `Message copied to clipboard. Paste it in the SMS to ${contact.name}.`, [{ text: 'OK' }]);
      }
    } catch (error: any) {
      Alert.alert('Error', `Unable to open SMS. Please send an invite manually to ${contact.name}.`, [{ text: 'OK' }]);
    }
  };

  useEffect(() => {
    if (visible) {
      loadContacts();
    } else {
      setDeviceContacts([]);
      setIsLoadingContacts(false);
      setNeedsFullAccess(false);
      setSearchQuery('');
      // Keep selectedContacts so selection persists when modal is reopened
    }
  }, [visible]);

  const handleDone = async () => {
    const selected = deviceContacts.filter((c) => selectedContacts.has(c.phone));
    if (selected.length === 0) return;
    try {
      const phoneHashes = await hashPhones(selected.map((c) => c.phone), api.hashPhones);
      await matchContactsMutation.mutateAsync(phoneHashes);
      await queryClient.invalidateQueries({ queryKey: ['friends'] });
      const count = selected.length;
      onClose(count);
      // Keep selectedContacts so selection persists when modal is reopened
    } catch {
      // Error already shown by mutation
    }
  };

  const filteredContacts = deviceContacts.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });
  const plazaUsers = filteredContacts.filter((c) => contactsInPlaza.has(c.phone));
  const nonPlazaUsers = filteredContacts.filter((c) => !contactsInPlaza.has(c.phone));

  const demoGroups = [
    { id: 'coffee', label: 'Coffee', letter: 'C', backgroundColor: '#E8D5B7', count: 3 },
    { id: 'musicians', label: 'Musicians', letter: 'M', backgroundColor: '#D4E4F7', count: 5 },
  ];
  const toggleGroup = (groupId: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  type ListItem = { type: 'header'; title: string; key: string } | { type: 'contact'; contact: { name: string; phone: string }; isPlaza: boolean };
  const listData: ListItem[] = [
    ...(plazaUsers.length > 0 ? [{ type: 'header' as const, title: 'contacts', key: 'plaza-header' }] : []),
    ...plazaUsers.map((c) => ({ type: 'contact' as const, contact: c, isPlaza: true })),
    ...(nonPlazaUsers.length > 0 ? [{ type: 'header' as const, title: 'Not on Plaza', key: 'non-plaza-header' }] : []),
    ...nonPlazaUsers.map((c) => ({ type: 'contact' as const, contact: c, isPlaza: false })),
  ];

  const renderContactItem = (item: { name: string; phone: string }, isInPlaza: boolean) => {
    const isSelected = selectedContacts.has(item.phone);
    if (!isInPlaza) {
      return (
        <View style={styles.contactItem}>
          <View style={styles.contactInfo}>
            <View style={styles.contactNameRow}>
              <Text style={styles.contactName}>{item.name}</Text>
              <Pressable onPress={() => handleInviteContact(item)}>
                <Text style={styles.inviteLink}>Invite</Text>
              </Pressable>
            </View>
            <Text style={styles.contactPhone}>{item.phone}</Text>
          </View>
        </View>
      );
    }
    return (
      <Pressable
        style={styles.contactItem}
        onPress={() => {
          const next = new Set(selectedContacts);
          if (isSelected) next.delete(item.phone);
          else next.add(item.phone);
          setSelectedContacts(next);
        }}
      >
        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
          {isSelected && <View style={styles.checkboxInner} />}
        </View>
        <View style={styles.contactInfo}>
          <View style={styles.contactNameRow}>
            <Text style={styles.contactName}>{item.name}</Text>
            <View style={styles.plazaBadge}>
              <Text style={styles.plazaBadgeText}>On Plaza</Text>
            </View>
          </View>
          <Text style={styles.contactPhone}>{item.phone}</Text>
        </View>
      </Pressable>
    );
  };

  const showDevButton = (process.env.EXPO_PUBLIC_API_URL?.includes('dev') || process.env.EXPO_PUBLIC_API_URL?.includes('localhost') || __DEV__) as boolean;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => onClose()}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Pressable onPress={() => onClose()}>
            <Text style={styles.modalCloseButton}>Close</Text>
          </Pressable>
          <View style={styles.headerButtons}>
            {showDevButton && (
              <Pressable
                style={styles.devButton}
                onPress={async () => {
                  const nonPlaza = deviceContacts.filter((c) => !contactsInPlaza.has(c.phone));
                  if (nonPlaza.length === 0) {
                    Alert.alert('No Contacts Available', 'All your contacts are already Plaza users, or load contacts first.');
                    return;
                  }
                  const shuffled = [...nonPlaza].sort(() => Math.random() - 0.5);
                  const count = Math.min(3 + Math.floor(Math.random() * 2), shuffled.length);
                  const selected = shuffled.slice(0, count);
                  try {
                    await api.createMockUsers(selected.map((c) => ({ phone: c.phone, name: c.name })));
                    await checkContactsInPlaza(deviceContacts);
                    Alert.alert('Mock Users Created', `Created ${selected.length} test user(s).`, [{ text: 'OK' }]);
                  } catch (e: any) {
                    Alert.alert('Error', e.message || 'Failed to create mock users.');
                  }
                }}
              >
                <Text style={styles.devButtonText}>Create Mock Users</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.doneButton, (selectedContacts.size < 2 || matchContactsMutation.isPending || checkContactsMutation.isPending) && styles.doneButtonDisabled]}
              onPress={handleDone}
              disabled={selectedContacts.size < 2 || matchContactsMutation.isPending || checkContactsMutation.isPending}
            >
              {matchContactsMutation.isPending || checkContactsMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.doneButtonText, selectedContacts.size < 2 && styles.doneButtonTextDisabled]}>
                  Done
                </Text>
              )}
            </Pressable>
          </View>
        </View>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add friends</Text>
          <Animated.Text style={[styles.modalNote, { transform: [{ rotate: noteRotation }] }]}>
            A two friend minimum is required to set a status
          </Animated.Text>

          {!isLoadingContacts && deviceContacts.length > 0 && (
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search contacts..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          {selectedContacts.size > 0 && (
            <View style={styles.selectedPillsSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedPillsScroll} contentContainerStyle={styles.selectedPillsContent}>
                {Array.from(selectedContacts).map((phone) => {
                  const contact = deviceContacts.find((c) => c.phone === phone);
                  const name = contact?.name ?? phone;
                  return (
                    <View key={phone} style={styles.selectedPill}>
                      <Text style={styles.selectedPillText} numberOfLines={1}>{name}</Text>
                      <Pressable style={styles.selectedPillX} onPress={() => setSelectedContacts((prev) => { const next = new Set(prev); next.delete(phone); return next; })} hitSlop={10}>
                        <Ionicons name="close-circle" size={20} color="#333" />
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {!isLoadingContacts && deviceContacts.length > 0 && (
            <View style={styles.groupsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>my groups</Text>
              </View>
              <View style={styles.groupsRow}>
                {demoGroups.map((group) => {
                  const isSelected = selectedGroups.has(group.id);
                  return (
                    <Pressable key={group.id} onPress={() => toggleGroup(group.id)}>
                      <View style={styles.groupAvatarWrapper}>
                        <View style={styles.groupAvatarWithBadge}>
                          <View style={[styles.groupAvatar, { backgroundColor: group.backgroundColor }, isSelected && styles.groupAvatarSelected]}>
                            <Text style={styles.groupAvatarLetter}>{group.letter}</Text>
                          </View>
                          <View style={styles.groupCountBadge}>
                            <Text style={styles.groupCountBadgeText}>{group.count}</Text>
                          </View>
                        </View>
                        <Text style={styles.groupAvatarLabel}>{group.label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {needsFullAccess && (
            <View style={styles.permissionWarningBox}>
              <Text style={styles.permissionWarningTitle}>Limited Contact Access</Text>
              <Text style={styles.permissionWarningText}>Grant access to all contacts to find all your friends.</Text>
              <Pressable style={styles.settingsButton} onPress={() => Linking.openSettings().catch(() => {})}>
                <Text style={styles.settingsButtonText}>Open Settings</Text>
              </Pressable>
            </View>
          )}

          {isLoadingContacts ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading contacts...</Text>
            </View>
          ) : (
            <FlatList
              data={listData}
              keyExtractor={(item, index) => (item.type === 'header' ? item.key : `${item.contact.phone}-${index}`)}
              renderItem={({ item }) =>
                item.type === 'header' ? (
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderText}>{item.title}</Text>
                  </View>
                ) : (
                  renderContactItem(item.contact, item.isPlaza)
                )
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{searchQuery.trim() ? `No contacts found matching "${searchQuery}"` : 'No contacts found'}</Text>
                  {needsFullAccess && (
                    <Pressable style={styles.settingsButton} onPress={() => Linking.openSettings().catch(() => {})}>
                      <Text style={styles.settingsButtonText}>Open Settings to Grant Full Access</Text>
                    </Pressable>
                  )}
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  modalCloseButton: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  headerButtons: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  devButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FF9500' },
  devButtonText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  doneButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#007AFF' },
  doneButtonDisabled: { backgroundColor: '#e0e0e0' },
  doneButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  doneButtonTextDisabled: { color: '#999' },
  modalContent: { flex: 1, padding: 20 },
  modalTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  modalNote: { fontSize: 14, color: '#666', marginBottom: 16 },
  modalSubtitle: { fontSize: 16, color: '#666', marginBottom: 20 },
  searchContainer: { marginBottom: 16 },
  searchInput: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, fontSize: 16, color: '#000', borderWidth: 1, borderColor: '#e0e0e0' },
  groupsSection: { marginBottom: 16 },
  groupsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingTop: 12, paddingHorizontal: 4 },
  groupAvatarAdd: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupAvatarWrapper: { alignItems: 'center', gap: 4 },
  groupAvatarWithBadge: { position: 'relative' },
  groupCountBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupCountBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupAvatarSelected: { borderWidth: 2, borderColor: '#007AFF' },
  groupAvatarLetter: { fontSize: 18, fontWeight: '600', color: '#333' },
  groupAvatarLabel: { fontSize: 12, color: '#666', fontWeight: '500' },
  selectedPillsSection: { marginBottom: 16 },
  selectedPillsScroll: { flexGrow: 0, height: 44 },
  selectedPillsContent: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 24 },
  selectedPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F4FD', paddingVertical: 8, paddingLeft: 12, paddingRight: 4, borderRadius: 20, gap: 6 },
  selectedPillText: { fontSize: 14, color: '#007AFF', fontWeight: '500', maxWidth: 140 },
  selectedPillX: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  permissionWarningBox: { backgroundColor: '#FFF3CD', borderColor: '#FFC107', borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 20 },
  permissionWarningTitle: { fontSize: 16, fontWeight: '600', color: '#856404', marginBottom: 8 },
  permissionWarningText: { fontSize: 14, color: '#856404', marginBottom: 12, lineHeight: 20 },
  settingsButton: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, alignItems: 'center' },
  settingsButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  contactItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  checkbox: { width: 24, height: 24, borderWidth: 2, borderColor: '#007AFF', borderRadius: 4, marginRight: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkboxChecked: { backgroundColor: '#007AFF' },
  checkboxInner: { width: 8, height: 8, borderRadius: 2, backgroundColor: '#fff' },
  contactInfo: { flex: 1 },
  contactNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 },
  contactName: { fontSize: 16, fontWeight: '500' },
  plazaBadge: { backgroundColor: '#34C759', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  plazaBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff', textTransform: 'uppercase' },
  contactPhone: { fontSize: 14, color: '#666' },
  sectionHeader: { backgroundColor: '#f5f5f5', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  sectionHeaderText: { fontSize: 13, fontWeight: '600', color: '#666', textTransform: 'uppercase' },
  inviteLink: { fontSize: 14, color: '#007AFF', fontWeight: '500' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#666' },
});
