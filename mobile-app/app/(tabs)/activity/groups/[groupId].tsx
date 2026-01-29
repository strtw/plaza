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
import { createApi } from '../../../../lib/api';
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

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description ?? '');
    }
  }, [group?.id, group?.name, group?.description]);

  const hasChanges =
    name.trim() !== (group?.name ?? '') ||
    (description ?? '') !== (group?.description ?? '');
  const canSave = hasChanges && name.trim().length > 0 && !updateGroupMutation.isPending;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    updateGroupMutation.mutate({ name: name.trim(), description: description.trim() });
  }, [canSave, name, description, updateGroupMutation]);

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
            <Text style={styles.sectionLabel}>Members ({group?.members?.length ?? 0})</Text>
            {group?.members?.length ? (
              <View style={styles.memberList}>
                {group.members.map((member: any) => (
                  <View key={member.id} style={styles.memberRow}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberInitial}>
                        {(member.firstName?.[0] || member.lastName?.[0] || '?').toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {[member.firstName, member.lastName].filter(Boolean).join(' ') || 'Unknown'}
                      </Text>
                      {member.email ? (
                        <Text style={styles.memberEmail}>{member.email}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
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
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
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
