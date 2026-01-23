import { View, FlatList, Text, StyleSheet, Pressable, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createApi } from '../lib/api';
import { ContactListItem } from '../components/ContactListItem';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RequestsScreen() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const api = createApi(getToken);
  const queryClient = useQueryClient();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Query pending friends - poll every 30 seconds
  const { data: pendingFriends = [], isLoading, refetch } = useQuery({
    queryKey: ['pending-friends'],
    queryFn: api.getPendingFriends,
    enabled: isLoaded && isSignedIn,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Mutation for accepting a pending friend
  const acceptFriendMutation = useMutation({
    mutationFn: api.acceptFriend,
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['pending-friends', 'friends', 'friends-statuses'] });
    },
    onError: (error: any) => {
      console.error('Error accepting friend:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to accept friend. Please try again.',
        [{ text: 'OK' }]
      );
    },
  });

  // Mutation for muting a friend
  const muteFriendMutation = useMutation({
    mutationFn: api.muteFriend,
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['pending-friends', 'friends', 'friends-statuses'] });
    },
    onError: (error: any) => {
      console.error('Error muting friend:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to mute friend. Please try again.',
        [{ text: 'OK' }]
      );
    },
  });

  // Mutation for blocking a friend
  const blockFriendMutation = useMutation({
    mutationFn: api.blockFriend,
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['pending-friends', 'friends', 'friends-statuses'] });
    },
    onError: (error: any) => {
      console.error('Error blocking friend:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to block friend. Please try again.',
        [{ text: 'OK' }]
      );
    },
  });

  // Map pending friends to contact format for display
  const contactsWithStatus = ((pendingFriends as any[]) || []).map((pf: any) => ({
    id: pf.sharer.id,
    firstName: pf.sharer.firstName,
    lastName: pf.sharer.lastName,
    email: pf.sharer.email,
    isPending: true,
    pendingStatus: pf.status,
  }));

  const headerPaddingTop = insets.top + 16;

  if (!isLoaded || !isSignedIn) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <View style={[styles.headerContainer, { paddingTop: headerPaddingTop }]}>
        <Pressable 
          style={styles.backButton}
          onPress={() => router.push('/(tabs)/contacts')}
        >
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </Pressable>
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>Requests</Text>
          <Text style={styles.subheading}>These people would like to start sharing their updates with you</Text>
        </View>
      </View>
      
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : contactsWithStatus.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 16, color: '#666', textAlign: 'center' }}>
            No pending requests
          </Text>
        </View>
      ) : (
        <FlatList
          data={contactsWithStatus}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5E5' }}>
              <ContactListItem contact={item} />
              <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
                <Pressable
                  onPress={() => acceptFriendMutation.mutate(item.id)}
                  disabled={acceptFriendMutation.isPending}
                  style={{
                    flex: 1,
                    backgroundColor: '#25D366',
                    paddingVertical: 10,
                    borderRadius: 8,
                    alignItems: 'center',
                    opacity: acceptFriendMutation.isPending ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>
                    {acceptFriendMutation.isPending ? 'Accepting...' : 'Accept'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => muteFriendMutation.mutate(item.id)}
                  disabled={muteFriendMutation.isPending}
                  style={{
                    flex: 1,
                    backgroundColor: '#999',
                    paddingVertical: 10,
                    borderRadius: 8,
                    alignItems: 'center',
                    opacity: muteFriendMutation.isPending ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>
                    {muteFriendMutation.isPending ? 'Muting...' : 'Mute'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => blockFriendMutation.mutate(item.id)}
                  disabled={blockFriendMutation.isPending}
                  style={{
                    flex: 1,
                    backgroundColor: '#FF3B30',
                    paddingVertical: 10,
                    borderRadius: 8,
                    alignItems: 'center',
                    opacity: blockFriendMutation.isPending ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>
                    {blockFriendMutation.isPending ? 'Blocking...' : 'Block'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  titleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
