import { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createApi } from '../../../lib/api';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '../../../stores/userStore';
import { StatusLocation } from '../../../lib/types';

function formatLocation(location: string): string {
  const map: Record<string, string> = {
    HOME: 'home',
    GREENSPACE: 'greenspace',
    THIRD_PLACE: 'third place',
  };
  return map[location] || location.toLowerCase();
}

function formatAvailableUntil(dateString: string): string {
  const d = new Date(dateString);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  if (m === 0) return `Available until ${hour12}${ampm}`;
  const min = m.toString().padStart(2, '0');
  return `Available until ${hour12}:${min} ${ampm}`;
}

export default function MyStatusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const api = createApi(getToken);
  const queryClient = useQueryClient();
  const { setCurrentStatus } = useUserStore();
  const clearedByUserRef = useRef(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ['my-status'],
    queryFn: async () => {
      const result = await api.getMyStatus();
      return result ?? null;
    },
    enabled: isLoaded && isSignedIn,
  });

  const deleteStatusMutation = useMutation({
    mutationFn: api.deleteMyStatus,
    onSuccess: () => {
      router.replace('/(tabs)/activity');
      queryClient.setQueryData(['my-status'], null);
      setCurrentStatus(null);
      queryClient.invalidateQueries({ queryKey: ['my-status'] });
      queryClient.invalidateQueries({ queryKey: ['friends-statuses'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to clear status.');
    },
  });

  const handleClearStatus = () => {
    Alert.alert(
      'Clear status',
      'Are you sure you want to clear your status? Your friends will no longer see it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearedByUserRef.current = true;
            deleteStatusMutation.mutate();
          },
        },
      ]
    );
  };

  const handleEditStatus = () => {
    router.push('/(tabs)/activity/set-status');
  };

  if (!isLoaded || !isSignedIn) return null;

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (!status || !status.endTime) {
    if (!clearedByUserRef.current) {
      router.replace('/(tabs)/activity/set-status');
    }
    return null;
  }

  const end = new Date(status.endTime);
  const now = new Date();
  const isExpired = end < now;

  if (isExpired) {
    router.replace('/(tabs)/activity/set-status');
    return null;
  }

  const sharedCount = (status as any).sharedWith?.length ?? 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </Pressable>
        <Text style={styles.headerTitle}>My status</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.detailCard}>
          {status.message ? (
            <Text style={styles.message}>{status.message}</Text>
          ) : null}
          <View style={styles.row}>
            <Ionicons
              name={
                status.location === StatusLocation.HOME
                  ? 'home-outline'
                  : status.location === StatusLocation.GREENSPACE
                    ? 'leaf'
                    : status.location === StatusLocation.THIRD_PLACE
                      ? 'business'
                      : 'location'
              }
              size={20}
              color="#666"
            />
            <Text style={styles.metaText}>{formatLocation(status.location)}</Text>
          </View>
          <Text style={styles.metaText}>{formatAvailableUntil(status.endTime)}</Text>
          {sharedCount > 0 && (
            <Text style={styles.metaText}>Shared with {sharedCount} {sharedCount === 1 ? 'person' : 'people'}</Text>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          onPress={handleEditStatus}
        >
          <Ionicons name="pencil" size={22} color="#fff" />
          <Text style={styles.primaryButtonText}>Edit status</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.clearButton, pressed && styles.buttonPressed]}
          onPress={handleClearStatus}
          disabled={deleteStatusMutation.isPending}
        >
          <Ionicons name="trash-outline" size={22} color="#FF3B30" />
          <Text style={styles.clearButtonText}>
            {deleteStatusMutation.isPending ? 'Clearing…' : 'Clear status'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  headerRight: {
    width: 44,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 24,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  message: {
    fontSize: 18,
    color: '#000',
    marginBottom: 12,
    lineHeight: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  metaText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 6,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  clearButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FF3B30',
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
