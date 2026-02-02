import { View, Text, ScrollView, Pressable, StyleSheet, Alert, Switch } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFullName } from '../../lib/types';

export default function ContactDetailScreen() {
  const { id, isUpdated, previousStatus, from, groupId, firstName, lastName, name } = useLocalSearchParams<{
    id?: string; isUpdated?: string; previousStatus?: string; from?: string; groupId?: string;
    firstName?: string; lastName?: string; name?: string;
  }>();
  const api = useApi();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Display name from route params (e.g. when opened from group with no Friend record)
  const paramDisplayName = [firstName, lastName].filter(Boolean).join(' ') || (name ?? '') || null;

  // Parse previous status if provided (for updated status comparison)
  const parsedPreviousStatus = previousStatus
    ? JSON.parse(decodeURIComponent(previousStatus as string))
    : null;
  const showUpdatedComparison = isUpdated === 'true' && parsedPreviousStatus;

  // Get initials for avatar (reused from ContactListItem pattern)
  const getInitials = (contactOrName: any) => {
    const fullName = typeof contactOrName === 'string' ? contactOrName : getFullName(contactOrName);
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return fullName ? fullName.substring(0, 2).toUpperCase() : '?';
  };

  // Get avatar background color based on name (reused from ContactListItem pattern)
  const getAvatarColor = (contactOrName: any) => {
    const fullName = typeof contactOrName === 'string' ? contactOrName : getFullName(contactOrName);
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80'
    ];
    const index = (fullName || '?').charCodeAt(0) % colors.length;
    return colors[index];
  };

  const { data: contacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: api.getContacts,
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: api.getOrCreateMe,
    staleTime: Infinity,
  });

  const { data: statuses } = useQuery({
    queryKey: ['friends-statuses'],
    queryFn: api.getFriendsStatuses,
  });

  const { data: myStatus } = useQuery({
    queryKey: ['my-status'],
    queryFn: api.getMyStatus,
  });

  const queryClient = useQueryClient();
  const setOnMyWayMutation = useMutation({
    mutationFn: (statusId: string) => api.setOnMyWay(statusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends-statuses'] });
      queryClient.invalidateQueries({ queryKey: ['my-status'] });
    },
  });
  const cancelOnMyWayMutation = useMutation({
    mutationFn: (statusId: string) => api.cancelOnMyWay(statusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends-statuses'] });
      queryClient.invalidateQueries({ queryKey: ['my-status'] });
    },
  });

  const contact = id ? contacts?.find((c: any) => c.id === id) : null;
  const status = statuses?.find((s: any) => s.user?.id === id || s.userId === id);
  const myUserId = currentUser?.id ?? null;
  const amOnMyWay = status?.onMyWayUserIds && myUserId && status.onMyWayUserIds.includes(myUserId);
  const amOnMyWayToAnotherStatus =
    statuses?.some(
      (s: any) => s.id !== status?.id && myUserId && s.onMyWayUserIds?.includes(myUserId)
    ) ?? false;
  const showOnMyWayButton = !!status;
  const hasActiveStatus = !!myStatus;
  const isOnMyWayButtonDisabled = hasActiveStatus || amOnMyWayToAnotherStatus;

  const confirmOnMyWay = (statusId: string) => {
    Alert.alert(
      'On my way',
      "Let this person know you're on your way?",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: "I'm on my way", onPress: () => setOnMyWayMutation.mutate(statusId) },
      ]
    );
  };

  const confirmCancelOnMyWay = (statusId: string) => {
    Alert.alert(
      'Cancel my attendance',
      "Self-check - are you cancelling for the right reasons?" ,
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Yes, cancel', onPress: () => cancelOnMyWayMutation.mutate(statusId) },
      ]
    );
  };

  const handleBack = () => {
    if (from === 'group' && groupId) {
      router.replace(`/(tabs)/activity/groups/${groupId}`);
    } else if (from === 'add-friends') {
      router.replace('/(tabs)/activity/add-friends');
    } else {
      router.replace('/(tabs)/activity');
    }
  };

  // Presentational view when no Friend record but we have display params (e.g. from group)
  if (!contact && paramDisplayName) {
    const displayName = paramDisplayName;
    return (
      <View style={{ flex: 1 }}>
        <View style={[styles.headerContainer, { paddingTop: insets.top + 16 }]}>
          <Pressable
            style={styles.backButton}
            onPress={handleBack}
          >
            <Ionicons name="chevron-back" size={28} color="#007AFF" />
          </Pressable>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: getAvatarColor(displayName) }]}>
              <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
            </View>
          </View>
          <View style={styles.nameContainer}>
            <Text style={styles.nameText} numberOfLines={1}>
              {displayName}
            </Text>
          </View>
        </View>
        <ScrollView style={{ flex: 1, padding: 20 }} />
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Contact not found</Text>
      </View>
    );
  }

  const displayName = getFullName(contact);
  const contactFirstName = contact.firstName || '';

  // Helper to format location for display
  const formatLocation = (location: string) => {
    const locationMap: Record<string, string> = {
      'HOME': 'home',
      'GREENSPACE': 'greenspace',
      'THIRD_PLACE': 'third place',
    };
    return locationMap[location] || location.toLowerCase();
  };

  // Helper to format date/time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Helper: "Available until 2pm" or "Available until 11:15 am"
  const formatAvailableUntil = (dateString: string) => {
    const d = new Date(dateString);
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'pm' : 'am';
    const hour12 = h % 12 || 12;
    if (m === 0) return `Available until ${hour12}${ampm}`;
    const min = m.toString().padStart(2, '0');
    return `Available until ${hour12}:${min} ${ampm}`;
  };

  // Build change message
  const getChangeMessage = () => {
    if (!showUpdatedComparison || !status || !parsedPreviousStatus) return null;
    
    const changes: string[] = [];
    
    if (parsedPreviousStatus.location !== status.location) {
      changes.push(formatLocation(status.location));
    }
    
    if (parsedPreviousStatus.endTime !== status.endTime) {
      changes.push(formatDateTime(status.endTime));
    }
    
    if (parsedPreviousStatus.message !== status.message) {
      changes.push(`"${status.message}"`);
    }
    
    if (changes.length === 0) return null;
    
    return `${contactFirstName} changed ${changes.join(', ')}.`;
  };

  const changeMessage = getChangeMessage();

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.headerContainer, { paddingTop: insets.top + 16 }]}>
        <Pressable 
          style={styles.backButton}
          onPress={handleBack}
        >
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </Pressable>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: getAvatarColor(contact) }]}>
            <Text style={styles.avatarText}>{getInitials(contact)}</Text>
          </View>
        </View>
        <View style={styles.nameContainer}>
          <Text style={styles.nameText} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1, padding: 20 }}>
        {/* Show everyone indicator if this contact is muted */}
        {contact.friendStatus === 'MUTED' && (
          <View style={styles.mutedIndicator}>
            <Ionicons name="volume-mute" size={16} color="#999" />
            <Text style={styles.mutedText}>User's updates are muted and won't show by default in the activity feed. To see their updates, unmute them, or toggle the "show muted user updates" filter </Text>
          </View>
        )}
        {status ? (
          <View>
            {showUpdatedComparison && parsedPreviousStatus ? (
              // Show updated status comparison
              <View>
                {changeMessage && (
                  <Text style={styles.changeMessage}>
                    {changeMessage}
                  </Text>
                )}
                
                {/* Old status with strikethrough */}
                <View style={styles.oldStatusContainer}>
                  <Text style={styles.oldStatusLabel}>Previous Status:</Text>
                  <Text style={styles.oldStatusText}>
                    {parsedPreviousStatus.message}
                  </Text>
                  <Text style={styles.oldStatusText}>
                    Location: {formatLocation(parsedPreviousStatus.location)}
                  </Text>
                  <Text style={styles.oldStatusText}>
                    Until: {formatDateTime(parsedPreviousStatus.endTime)}
                  </Text>
                </View>
                
                {/* New status in green box */}
                <View style={styles.newStatusContainer}>
                  <Text style={styles.newStatusLabel}>Current Status:</Text>
                  <Text style={styles.newStatusText}>
                    {status.message}
                  </Text>
                  <Text style={styles.newStatusText}>
                    Location: {formatLocation(status.location)}
                  </Text>
                  <Text style={styles.newStatusText}>
                    Until: {formatDateTime(status.endTime)}
                  </Text>
                </View>
              </View>
            ) : (
              // Normal status display (not updated)
              <View>
                {status.message && (
                  <Text style={{ fontSize: 16, color: '#333', marginBottom: 10 }}>
                    {status.message}
                  </Text>
                )}
                <Text style={{ fontSize: 14, color: '#999' }}>
                  {formatAvailableUntil(status.endTime)}
                </Text>
              </View>
            )}
            {showOnMyWayButton && (
              <View style={styles.onMyWayButtonWrap}>
                <Pressable
                  style={[
                    styles.onMyWayButton,
                    amOnMyWay && !isOnMyWayButtonDisabled && styles.onMyWayButtonActive,
                    (setOnMyWayMutation.isPending || cancelOnMyWayMutation.isPending) && styles.onMyWayButtonDisabled,
                    isOnMyWayButtonDisabled && styles.onMyWayButtonDisabledByStatus,
                  ]}
                  onPress={() => {
                    if (isOnMyWayButtonDisabled) return;
                    if (setOnMyWayMutation.isPending || cancelOnMyWayMutation.isPending) return;
                    if (amOnMyWay) {
                      confirmCancelOnMyWay(status.id);
                    } else {
                      confirmOnMyWay(status.id);
                    }
                  }}
                  disabled={isOnMyWayButtonDisabled || setOnMyWayMutation.isPending || cancelOnMyWayMutation.isPending}
                >
                {amOnMyWay && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={isOnMyWayButtonDisabled ? '#999' : '#fff'}
                  />
                )}
                  <Text
                    style={[
                      styles.onMyWayButtonText,
                      amOnMyWay && !isOnMyWayButtonDisabled && styles.onMyWayButtonTextActive,
                      isOnMyWayButtonDisabled && styles.onMyWayButtonTextDisabled,
                    ]}
                  >
                    {setOnMyWayMutation.isPending || cancelOnMyWayMutation.isPending
                      ? '…'
                      : amOnMyWay
                        ? "You're attending!"
                        : 'On my way'}
                  </Text>
                </Pressable>
                {isOnMyWayButtonDisabled && (
                  <Text style={styles.onMyWayDisabledHint}>
                    {amOnMyWayToAnotherStatus
                      ? "Cancel your current 'On my way' before heading to another."
                      : 'Button disabled while you have an active status'}
                  </Text>
                )}
                {amOnMyWay && !isOnMyWayButtonDisabled && (
                  <Pressable
                    style={styles.cancelAttendanceButton}
                    onPress={() => {
                      if (setOnMyWayMutation.isPending || cancelOnMyWayMutation.isPending) return;
                      confirmCancelOnMyWay(status.id);
                    }}
                    disabled={setOnMyWayMutation.isPending || cancelOnMyWayMutation.isPending}
                  >
                    <Text style={styles.cancelAttendanceButtonText}>Cancel my attendance</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        ) : (
          <Text>No current status</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
    minHeight: 60,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  nameContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  nameText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  changeMessage: {
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    fontWeight: '500',
  },
  oldStatusContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  oldStatusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  oldStatusText: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
    marginBottom: 4,
  },
  newStatusContainer: {
    padding: 16,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  newStatusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 8,
  },
  newStatusText: {
    fontSize: 14,
    color: '#1B5E20',
    marginBottom: 4,
  },
  mutedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  mutedText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  onMyWayButtonWrap: {
    marginTop: 20,
  },
  onMyWayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#fff',
  },
  onMyWayButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  onMyWayButtonDisabled: {
    opacity: 0.6,
  },
  onMyWayButtonDisabledByStatus: {
    borderColor: '#ccc',
    backgroundColor: '#f5f5f5',
  },
  onMyWayButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  onMyWayButtonTextActive: {
    color: '#fff',
  },
  onMyWayButtonTextDisabled: {
    color: '#999',
  },
  onMyWayDisabledHint: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  cancelAttendanceButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelAttendanceButtonText: {
    fontSize: 15,
    color: '#666',
    textDecorationLine: 'underline',
  },
});

