import { View, FlatList, Text, RefreshControl, ActivityIndicator, StyleSheet, Modal, Pressable, Alert, Linking, TextInput, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createApi } from '../../lib/api';
import { ContactListItem } from '../../components/ContactListItem';
import { useAuth } from '@clerk/clerk-expo';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFullName } from '../../lib/types';
import { FindFriendsModal } from '../../components/FindFriendsModal';
import { HamburgerMenu } from '../../components/HamburgerMenu';

function HomeScreenContent() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const api = createApi(getToken);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [savedContacts, setSavedContacts] = useState<Array<{ name: string; phone: string }>>([]);
  const hasHandledOpenInvite = useRef(false); // Track if we've already handled the openInvite param
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // All hooks must be called before any conditional returns
  const { data: contacts, isLoading, refetch } = useQuery({
    queryKey: ['friends'],
    queryFn: api.getContacts,
    enabled: isLoaded && isSignedIn,
  });

  // Log contacts data when it changes
  useEffect(() => {
    if (contacts) {
      console.log('[Contacts] Received friends data:', contacts.length || 0, 'friends');
      if (contacts && contacts.length > 0) {
        console.log('[Contacts] Sample friend:', JSON.stringify(contacts[0], null, 2));
      }
    }
  }, [contacts]);

  // Query pending friends - poll every 30 seconds (for badge count only)
  const { data: pendingFriends = [] } = useQuery({
    queryKey: ['pending-friends'],
    queryFn: api.getPendingFriends,
    enabled: isLoaded && isSignedIn,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Status query removed - contacts tab no longer displays status information
  // const { data: statuses } = useQuery({
  //   queryKey: ['friends-statuses'],
  //   queryFn: api.getFriendsStatuses,
  //   enabled: isLoaded && isSignedIn,
  //   refetchInterval: 10000, // Poll every 10 seconds
  // });

  // Mutation for blocking a friend (used in search modal)
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

  // Search users function
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const results = await api.searchUsers(query.trim());
      setSearchResults(results || []);
    } catch (error: any) {
      console.error('Error searching users:', error);
      Alert.alert('Error', error.message || 'Failed to search users. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (!showSearchModal) {
      setUserSearchQuery('');
      setSearchResults([]);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      if (userSearchQuery.trim()) {
        handleSearch(userSearchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [userSearchQuery, showSearchModal]);

  // Calculate header padding
  const headerPaddingTop = insets.top + 16;
  
  // Show Plaza users in the contacts list (people you can actually interact with)
  // These are contacts that have been matched and added via the Contact table
  // Note: Status information is not displayed in the contacts tab
  const contactsWithStatus = contacts || [];


  // Helper function to close modal and remove query param
  const handleCloseModal = () => {
    setShowSyncModal(false);
    // Remove query param from URL when modal closes
    const openInvite = params.openInvite;
    const hasOpenInvite = openInvite === 'true' || (Array.isArray(openInvite) && openInvite.includes('true'));
    if (hasOpenInvite) {
      router.replace('/(tabs)/contacts');
    }
    // Reset the ref so "invite more" can work again if clicked
    hasHandledOpenInvite.current = false;
  };

  // Auto-open invite modal when openInvite query param is present (only once)
  useEffect(() => {
    const openInvite = params.openInvite;
    // Handle both string and array cases (expo-router can return arrays)
    const shouldOpen = openInvite === 'true' || (Array.isArray(openInvite) && openInvite.includes('true'));
    
    if (shouldOpen && !showSyncModal && !hasHandledOpenInvite.current) {
      setShowSyncModal(true);
      hasHandledOpenInvite.current = true; // Mark as handled so it doesn't reopen
    }
  }, [params.openInvite, showSyncModal]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <Text>Loading...</Text>
      </View>
    );
  }
  
  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <View style={[styles.headerContainer, { paddingTop: headerPaddingTop }]}>
        <HamburgerMenu />
        <Text style={styles.headerTitle}>Contacts</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {(pendingFriends as any[]).length > 0 && (
            <Pressable
              onPress={() => router.push('/requests')}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 8, gap: 6 }}
            >
              <Text style={{ color: '#007AFF', fontSize: 14, fontWeight: '500' }}>
                Requests
              </Text>
              <View
                style={{
                  backgroundColor: '#FF3B30',
                  borderRadius: 12,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  minWidth: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
                  {(pendingFriends as any[]).length}
                </Text>
              </View>
            </Pressable>
          )}
          <Pressable
            onPress={() => setShowSearchModal(true)}
            style={{ marginRight: 8, padding: 8 }}
          >
            <Ionicons name="search" size={24} color="#007AFF" />
          </Pressable>
          <Pressable 
            style={styles.addButton}
            onPress={() => setShowSyncModal(true)}
          >
            <Ionicons name="add-circle" size={32} color="#007AFF" />
          </Pressable>
        </View>
      </View>
      <FlatList
        data={contactsWithStatus}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          // Render normal contact with relationship type indicator
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff' }}>
              <ContactListItem contact={item} />
              {item.relationshipType && (
                <View style={{ paddingRight: 16 }}>
                  <Text style={{ fontSize: 18, color: '#666' }}>
                    {item.relationshipType === 'outgoing' ? '→' : 
                     item.relationshipType === 'incoming' ? '←' : '↔'}
                  </Text>
                </View>
              )}
            </View>
          );
        }}
        refreshControl={
          <RefreshControl 
            refreshing={isLoading} 
            onRefresh={() => {
              refetch();
              queryClient.invalidateQueries({ queryKey: ['friends', 'pending-friends'] });
            }} 
          />
        }
        ListEmptyComponent={
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ marginBottom: 20 }}>No contacts yet.</Text>
            <Pressable
              style={styles.syncButton}
              onPress={() => setShowSyncModal(true)}
            >
              <Text style={styles.syncButtonText}>Sync Contacts to Find Friends</Text>
            </Pressable>
          </View>
        }
      />
      
      <FindFriendsModal visible={showSyncModal} onClose={handleCloseModal} />

      {/* User Search Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 16 }]}>
            <Pressable onPress={() => setShowSearchModal(false)}>
              <Text style={styles.modalCloseButton}>Close</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Search Users</Text>
            <View style={{ width: 60 }} />
          </View>
          <View style={styles.modalContent}>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or email..."
                placeholderTextColor="#999"
                value={userSearchQuery}
                onChangeText={setUserSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              {isSearching && (
                <ActivityIndicator size="small" color="#007AFF" style={{ marginLeft: 8 }} />
              )}
            </View>
            
            {searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const fullName = getFullName(item);
                  return (
                    <Pressable
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 16,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: '#E5E5E5',
                      }}
                      onPress={() => {
                        // Navigate to user or show actions
                        Alert.alert(
                          fullName,
                          `Email: ${item.email || 'N/A'}`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Block',
                              style: 'destructive',
                              onPress: () => {
                                blockFriendMutation.mutate(item.id);
                                setShowSearchModal(false);
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#E5E5E5',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 12,
                      }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#666' }}>
                          {fullName.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '500' }}>
                          {fullName}
                        </Text>
                        {item.email && (
                          <Text style={{ fontSize: 14, color: '#666', marginTop: 2 }}>
                            {item.email}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                }}
              />
            ) : userSearchQuery.trim().length > 0 && !isSearching ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: '#666' }}>No users found</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function HomeScreen() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Ensure component only mounts after ClerkProvider is ready
    const timer = setTimeout(() => {
      setMounted(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading...</Text>
      </View>
    );
  }

  return <HomeScreenContent />;
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
    minHeight: 60,
    zIndex: 10,
    elevation: 5, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  addButton: {
    padding: 4,
  },
  syncButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCloseButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  devButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FF9500',
  },
  devButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  devButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  devButtonTextDisabled: {
    color: '#999',
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  doneButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  doneButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  doneButtonTextDisabled: {
    color: '#999',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedPillsSection: {
    marginBottom: 16,
  },
  selectedPillsScroll: {
    flexGrow: 0,
    height: 44,
  },
  selectedPillsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 24,
  },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 4,
    borderRadius: 20,
    gap: 6,
  },
  selectedPillText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    maxWidth: 140,
  },
  selectedPillX: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  checkboxInner: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  contactInfo: {
    flex: 1,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
  },
  plazaBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  plazaBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
  },
  sectionHeader: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  inviteLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  permissionWarningBox: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFC107',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  permissionWarningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  permissionWarningText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 12,
    lineHeight: 20,
  },
  settingsButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

