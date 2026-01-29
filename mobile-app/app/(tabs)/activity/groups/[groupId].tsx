import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import * as ExpoContacts from 'expo-contacts';
import { createApi } from '../../../../lib/api';
import { hashPhones } from '../../../../lib/phone-hash.util';
import { useCallback, useEffect, useState } from 'react';

export default function GroupEditScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const api = createApi(getToken);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isMemberEditMode, setIsMemberEditMode] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [pendingRemovalIds, setPendingRemovalIds] = useState<Set<string>>(new Set());
  const [phoneByMemberId, setPhoneByMemberId] = useState<Record<string, string>>({});

  const { data: group, isLoading, error } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => api.getGroup(groupId!),
    enabled: Boolean(isSignedIn && isLoaded && groupId),
  });

  const updateGroupMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      api.updateGroup(groupId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      setIsEditing(false);
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message || 'Failed to save group');
    },
  });

  const removeMembersMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      for (const userId of userIds) {
        await api.removeGroupMember(groupId!, userId);
      }
    },
    onSuccess: (_, userIds) => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      setPendingRemovalIds(new Set());
      setIsMemberEditMode(false);
      setSelectedMemberIds(new Set());
      Alert.alert('Done', `${userIds.length} member(s) removed from the group.`);
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message || 'Failed to remove members');
    },
  });

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description ?? '');
    }
  }, [group?.id, group?.name, group?.description]);

  // Resolve member phones from device contacts (same logic as add-friends)
  useEffect(() => {
    if (!group?.members?.length || !api) return;
    let cancelled = false;
    (async () => {
      try {
        // Only use contacts if permission was already granted (e.g. in add-friends); never request here
        const { status } = await ExpoContacts.getPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const result = await ExpoContacts.getContactsAsync({
          fields: [ExpoContacts.Fields.PhoneNumbers, ExpoContacts.Fields.Name],
        });
        const data = result.data;
        if (cancelled || !data?.length) return;
        const deviceContacts = data
          .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0)
          .map((c) => ({
            name: c.name ?? '',
            phone: (c.phoneNumbers?.[0]?.number ?? '').replace(/\D/g, ''),
          }))
          .filter((item) => item.phone.length >= 10);
        if (deviceContacts.length === 0 || cancelled) return;
        const phoneNumbers = deviceContacts.map((c) => c.phone);
        const phoneHashes = await hashPhones(phoneNumbers, api.hashPhones);
        if (cancelled) return;
        const checkResult = await api.checkContacts(phoneHashes);
        if (cancelled) return;
        const hashToPhone = new Map<string, string>();
        for (let i = 0; i < phoneNumbers.length; i++) {
          hashToPhone.set(phoneHashes[i], phoneNumbers[i]);
        }
        const next: Record<string, string> = {};
        (checkResult.existingUsers ?? []).forEach((user: { phoneHash: string; id: string }) => {
          const phone = hashToPhone.get(user.phoneHash);
          if (phone) next[user.id] = phone;
        });
        if (!cancelled) setPhoneByMemberId(next);
      } catch (e) {
        if (!cancelled) console.error('[GroupEdit] Error resolving member phones:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [group?.id, group?.members?.length]);

  const hasChanges =
    name.trim() !== (group?.name ?? '') ||
    (description ?? '') !== (group?.description ?? '');
  const hasPendingRemovals = pendingRemovalIds.size > 0;
  const canSave =
    ((hasChanges && name.trim().length > 0) || hasPendingRemovals) &&
    !updateGroupMutation.isPending &&
    !removeMembersMutation.isPending;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    if (hasChanges && name.trim().length > 0) {
      updateGroupMutation.mutate(
        { name: name.trim(), description: description.trim() },
        {
          onSuccess: () => {
            if (pendingRemovalIds.size > 0) {
              removeMembersMutation.mutate(Array.from(pendingRemovalIds));
            }
          },
        }
      );
    } else if (pendingRemovalIds.size > 0) {
      removeMembersMutation.mutate(Array.from(pendingRemovalIds));
    }
  }, [canSave, hasChanges, name, description, pendingRemovalIds, updateGroupMutation, removeMembersMutation]);

  const handleStageRemovals = useCallback(() => {
    if (selectedMemberIds.size === 0) return;
    setPendingRemovalIds((prev) => new Set([...prev, ...selectedMemberIds]));
    setSelectedMemberIds(new Set());
  }, [selectedMemberIds]);

  const toggleMemberSelection = useCallback((userId: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  if (!isLoaded || !isSignedIn || !groupId) {
    return null;
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top + 60 }]}>
        <Text style={styles.errorText}>Failed to load group</Text>
        <Pressable style={styles.backOnly} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </Pressable>
      </View>
    );
  }

  const displayName = group?.name ?? 'Group';
  const displayDescription = group?.description ?? '';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.headerContainer, { paddingTop: insets.top + 16 }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </Pressable>
        <View style={styles.headerCenter}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#007AFF" style={styles.headerLoader} />
          ) : (
            <>
              <View style={styles.titleRow}>
                {isEditing ? (
                  <TextInput
                    style={styles.titleInput}
                    value={name}
                    onChangeText={setName}
                    placeholder="Group name"
                    placeholderTextColor="#999"
                    autoFocus
                    selectTextOnFocus
                  />
                ) : (
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {displayName}
                  </Text>
                )}
                <Pressable
                  style={styles.editIconButton}
                  onPress={() => setIsEditing((e) => !e)}
                  hitSlop={12}
                >
                  <Ionicons
                    name={isEditing ? 'close-circle' : 'pencil'}
                    size={22}
                    color="#007AFF"
                  />
                </Pressable>
              </View>
            </>
          )}
        </View>
        <Pressable
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text
            style={[
              styles.saveButtonText,
              !canSave && styles.saveButtonTextDisabled,
            ]}
          >
            Save
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading group...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Description</Text>
            {isEditing ? (
              <TextInput
                style={styles.descriptionInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional description"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            ) : (
              <Text style={styles.descriptionText}>
                {displayDescription || 'No description'}
              </Text>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>
                Members ({Math.max(0, (group?.members?.length ?? 0) - pendingRemovalIds.size)})
              </Text>
              <View style={styles.memberActionsRow}>
                <Pressable
                  style={styles.editGroupButton}
                  onPress={() => {
                    if (isMemberEditMode) {
                      setIsMemberEditMode(false);
                      setSelectedMemberIds(new Set());
                      setPendingRemovalIds(new Set());
                    } else {
                      setIsMemberEditMode(true);
                      setSelectedMemberIds(new Set());
                    }
                  }}
                >
                  <Ionicons name={isMemberEditMode ? 'close-circle-outline' : 'create-outline'} size={18} color="#007AFF" />
                  <Text style={styles.editGroupButtonText}>{isMemberEditMode ? 'Cancel' : 'Edit group'}</Text>
                </Pressable>
                {isMemberEditMode && (
                  <Pressable
                    style={[styles.trashButton, selectedMemberIds.size === 0 && styles.trashButtonDisabled]}
                    onPress={handleStageRemovals}
                    disabled={selectedMemberIds.size === 0}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color="#fff"
                    />
                  </Pressable>
                )}
                {!isMemberEditMode && (
                  <Pressable
                    style={styles.addFriendButton}
                    onPress={() => router.push(`/(tabs)/activity/add-friends?from=groups&groupId=${encodeURIComponent(groupId!)}`)}
                  >
                    <Ionicons name="person-add-outline" size={18} color="#fff" />
                    <Text style={styles.addFriendButtonText}>Add friend</Text>
                  </Pressable>
                )}
              </View>
            </View>
            {(group?.members?.length ?? 0) > 0 ? (
              <View style={styles.memberList}>
                {(group?.members ?? []).filter((m: any) => !pendingRemovalIds.has(m.id)).map((member: any) => {
                  const memberPhone = phoneByMemberId[member.id];
                  // Same navigation as ContactListItem when clicking status: /contact/:id so profile opens identically
                  const openContact = () => {
                    const params: Record<string, string> = { from: 'group', groupId: groupId! };
                    if (member.firstName != null) params.firstName = member.firstName;
                    if (member.lastName != null) params.lastName = member.lastName;
                    const queryString = Object.keys(params).length > 0
                      ? '?' + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
                      : '';
                    router.push(`/contact/${member.id}${queryString}`);
                  };
                  return (
                    <Pressable
                      key={member.id}
                      style={styles.memberRow}
                      onPress={isMemberEditMode ? () => toggleMemberSelection(member.id) : openContact}
                    >
                      {isMemberEditMode && (
                        <View style={[styles.memberCheckbox, selectedMemberIds.has(member.id) && styles.memberCheckboxChecked]}>
                          {selectedMemberIds.has(member.id) && <View style={styles.memberCheckboxInner} />}
                        </View>
                      )}
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberInitial}>
                          {(member.firstName?.[0] || member.lastName?.[0] || '?').toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>
                          {[member.firstName, member.lastName].filter(Boolean).join(' ') || 'Unknown'}
                        </Text>
                        <Text style={styles.memberEmail}>
                          {memberPhone ?? '—'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyMembers}>No members yet</Text>
            )}
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  backOnly: {
    position: 'absolute',
    left: 16,
    top: 16,
    padding: 4,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
  },
  headerLoader: {
    alignSelf: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  titleInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  editIconButton: {
    padding: 4,
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  saveButtonTextDisabled: {
    color: '#999',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentInner: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  memberActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trashButton: {
    padding: 8,
    paddingHorizontal: 14,
    marginRight: 4,
    backgroundColor: '#ff0000',
    borderRadius: 8,
  },
  trashButtonDisabled: {
    opacity: 0.5,
  },
  addFriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  addFriendButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  editGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  editGroupButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  descriptionText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  descriptionInput: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  memberList: {
    gap: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  memberCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#007AFF',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCheckboxChecked: {
    backgroundColor: '#007AFF',
  },
  memberCheckboxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  memberEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  emptyMembers: {
    fontSize: 15,
    color: '#999',
  },
});
