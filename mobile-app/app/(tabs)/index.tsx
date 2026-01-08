import { View, FlatList, Text, RefreshControl, ActivityIndicator, StyleSheet, Modal, Pressable, Alert, Linking, AppState, TextInput } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createApi } from '../../lib/api';
import { ContactListItem } from '../../components/ContactListItem';
import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import * as Contacts from 'expo-contacts';
import * as Clipboard from 'expo-clipboard';
import { hashPhones } from '../../lib/phone-hash.util';

function HomeScreenContent() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const api = createApi(getToken);
  const queryClient = useQueryClient();
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState<Array<{ name: string; phone: string }>>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [needsFullAccess, setNeedsFullAccess] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [savedContacts, setSavedContacts] = useState<Array<{ name: string; phone: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [contactsInPlaza, setContactsInPlaza] = useState<Set<string>>(new Set()); // Track which phone numbers are Plaza users
  const appState = useRef(AppState.currentState);

  // Function to load contacts
  const loadContacts = async () => {
    setIsLoadingContacts(true);
    try {
      // Check current permission status first
      const currentPermission = await Contacts.getPermissionsAsync();
      console.log(`[Contacts] Current permission status:`, currentPermission);
      
      // Request permission - this will show iOS permission dialog
      const { status, canAskAgain } = await Contacts.requestPermissionsAsync();
      console.log(`[Contacts] Permission request result:`, { status, canAskAgain });
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Contacts permission is required to sync your contacts. Please grant access to all contacts in Settings.',
          [{ text: 'OK' }]
        );
        setIsLoadingContacts(false);
        return;
      }

      // Permission granted, load contacts
      // Clear any previous data first
      setDeviceContacts([]);
      
      // Get ALL contacts - explicitly request all fields and no limit
      const result = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
        // Don't set pageSize to get all contacts
      });

      console.log(`[Contacts] Loaded ${result.data.length} raw contacts from device`);
      console.log(`[Contacts] Has next page: ${result.hasNextPage}`);
      console.log(`[Contacts] Sample contact names:`, result.data.slice(0, 5).map(c => c.name));

      const contacts = result.data
        .filter(contact => contact.phoneNumbers && contact.phoneNumbers.length > 0)
        .map(contact => {
          const phone = contact.phoneNumbers?.[0]?.number || '';
          const normalized = phone.replace(/\D/g, ''); // Remove non-digits
          return {
            name: contact.name || 'Unknown',
            phone: normalized,
          };
        })
        .filter(item => item.phone.length >= 10); // Valid phone numbers

      console.log(`[Contacts] Processed ${contacts.length} contacts with valid phone numbers`);
      
      // Check if access might be limited (if we got very few contacts, user might have "Selected Contacts" permission)
      // This is a heuristic - if they have less than 5 contacts, they likely have limited access
      // We'll show the settings button if contacts are suspiciously low
      const hasLimitedAccess = contacts.length < 5 && result.data.length < 5;
      setNeedsFullAccess(hasLimitedAccess);
      
      // Set fresh contacts (no caching)
      setDeviceContacts(contacts);
      
      // Check which contacts are Plaza users
      if (contacts.length > 0) {
        checkContactsInPlaza(contacts);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      setDeviceContacts([]);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  // Function to handle inviting a contact
  const handleInviteContact = async (contact: { name: string; phone: string }) => {
    try {
      // Generate invite code using the API
      let inviteCode: string;
      try {
        const inviteResult = await api.generateInvite();
        inviteCode = inviteResult.code;
      } catch (apiError: any) {
        console.error('Error generating invite from API:', apiError);
        // Fallback: generate a temporary code (user can still share)
        const chars = '0123456789abcdef';
        inviteCode = '';
        for (let i = 0; i < 32; i++) {
          inviteCode += chars[Math.floor(Math.random() * chars.length)];
        }
      }
      
      // Normalize phone number for SMS (ensure it starts with +)
      const normalizedPhone = contact.phone.startsWith('+') 
        ? contact.phone 
        : contact.phone.length === 10 
          ? `+1${contact.phone}` 
          : `+${contact.phone}`;
      
      // Create invite message
      const appStoreUrl = 'https://apps.apple.com/app/id/YOUR_APP_ID'; // Replace with real URL
      const message = `Join me on Plaza! Download here: ${appStoreUrl}\n\nInvite code: ${inviteCode}`;
      
      // Encode the message for URL
      const encodedMessage = encodeURIComponent(message);
      
      // Open native SMS app with pre-filled recipient and message
      const smsUrl = `sms:${normalizedPhone}?body=${encodedMessage}`;
      
      const canOpen = await Linking.canOpenURL(smsUrl);
      if (canOpen) {
        await Linking.openURL(smsUrl);
      } else {
        // Fallback: try without body (some devices may not support body parameter)
        await Linking.openURL(`sms:${normalizedPhone}`);
        // Copy message to clipboard as fallback
        await Clipboard.setStringAsync(message);
        Alert.alert(
          'SMS Opened',
          `Message copied to clipboard. Paste it in the SMS to ${contact.name}.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Error inviting contact:', error);
      Alert.alert(
        'Error',
        `Unable to open SMS. Please send an invite manually to ${contact.name} at ${contact.phone}.`,
        [{ text: 'OK' }]
      );
    }
  };

  // Function to check which device contacts are Plaza users
  const checkContactsInPlaza = async (contacts: Array<{ name: string; phone: string }>) => {
    try {
      if (contacts.length === 0) return;
      
      // Hash all phone numbers
      const phoneNumbers = contacts.map(c => c.phone);
      const phoneHashes = await hashPhones(phoneNumbers, api.hashPhones);
      
      // Check which are Plaza users
      const checkResult = await api.checkContacts(phoneHashes);
      
      // Create a Set of phone numbers that are Plaza users
      // We need to map back from hashes to phone numbers
      const plazaUserPhones = new Set<string>();
      const hashToPhone = new Map<string, string>();
      
      // Create mapping of hash to phone
      for (let i = 0; i < phoneNumbers.length; i++) {
        hashToPhone.set(phoneHashes[i], phoneNumbers[i]);
      }
      
      // Mark phone numbers that are Plaza users
      checkResult.existingUsers.forEach(user => {
        const phone = hashToPhone.get(user.phoneHash);
        if (phone) {
          plazaUserPhones.add(phone);
        }
      });
      
      setContactsInPlaza(plazaUserPhones);
    } catch (error) {
      console.error('Error checking contacts in Plaza:', error);
      // Don't block UI if this fails
    }
  };

  // Automatically request permission and load contacts when modal opens
  useEffect(() => {
    if (showSyncModal) {
      loadContacts();
    } else {
      // Reset when modal closes
      setDeviceContacts([]);
      setIsLoadingContacts(false);
      setNeedsFullAccess(false);
      setSelectedContacts(new Set());
      setSearchQuery('');
    }
  }, [showSyncModal]);

  // Reload contacts when app comes back from Settings
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        showSyncModal
      ) {
        // App has come to the foreground and modal is open, reload contacts
        console.log('[Contacts] App returned from background, reloading contacts...');
        loadContacts();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [showSyncModal]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

    const { data: contacts, isLoading, refetch } = useQuery({
      queryKey: ['contacts'],
      queryFn: api.getContacts,
      enabled: isLoaded && isSignedIn,
    });

    // Note: Selected contacts are saved but not displayed in the main contacts list
    // They will only appear once they join Plaza and become actual contacts
    // This is for future invite tracking features (pending invites, resend options)

    const { data: statuses } = useQuery({
      queryKey: ['contacts-statuses'],
      queryFn: api.getContactsStatuses,
      enabled: isLoaded && isSignedIn,
      refetchInterval: 10000, // Poll every 10 seconds
    });

  // Mutation for checking which contacts are users
  const checkContactsMutation = useMutation({
    mutationFn: api.checkContacts,
  });

  // Mutation for matching contacts (now uses phone hashes)
  const matchContactsMutation = useMutation({
    mutationFn: api.matchContacts,
    onSuccess: (data) => {
      // Refresh contacts list
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-statuses'] });
      
      if (data.matched > 0) {
        Alert.alert(
          'Contacts Matched!',
          `Found ${data.matched} friend${data.matched !== 1 ? 's' : ''} on Plaza. They've been added to your contacts.`,
          [{ text: 'OK', onPress: () => setShowSyncModal(false) }]
        );
      }
    },
    onError: (error: any) => {
      console.error('Error matching contacts:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to match contacts. Please try again.',
        [{ text: 'OK' }]
      );
    },
  });

  // Only show Plaza users in the contacts list (people you can actually interact with)
  // Selected contacts are saved but only appear once they join Plaza
  const contactsWithStatus = contacts?.map((contact: any) => ({
    ...contact,
    status: statuses?.find((s: any) => s.user?.id === contact.id || s.userId === contact.id),
  })) || [];

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={contactsWithStatus}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ContactListItem contact={item} />}
        refreshControl={
          <RefreshControl 
            refreshing={isLoading} 
            onRefresh={() => {
              refetch();
              queryClient.invalidateQueries({ queryKey: ['app-contacts'] });
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
      
      <Modal
        visible={showSyncModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowSyncModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowSyncModal(false)}>
              <Text style={styles.modalCloseButton}>Close</Text>
            </Pressable>
            <View style={styles.headerButtons}>
              {/* Dev button - only show if API URL contains 'dev' or localhost */}
              {((process.env.EXPO_PUBLIC_API_URL?.includes('dev') || 
                 process.env.EXPO_PUBLIC_API_URL?.includes('localhost')) || 
                 __DEV__) && (
                <Pressable
                  style={[styles.devButton, selectedContacts.size === 0 && styles.devButtonDisabled]}
                  onPress={async () => {
                    const selected = deviceContacts.filter(contact => 
                      selectedContacts.has(contact.phone)
                    );
                    
                    if (selected.length === 0) {
                      Alert.alert('No Contacts Selected', 'Please select contacts first.');
                      return;
                    }

                    try {
                      // Send contacts with phone and name
                      const contacts = selected.map(c => ({ phone: c.phone, name: c.name }));
                      const result = await api.createMockUsers(contacts);
                      
                      // Refresh the Plaza users list after creating mock users
                      await checkContactsInPlaza(deviceContacts);
                      
                      Alert.alert(
                        'Mock Users Created',
                        `Created ${result.created} test user${result.created !== 1 ? 's' : ''}.\n\nThey will appear as existing Plaza users.`,
                        [{ text: 'OK' }]
                      );
                    } catch (error: any) {
                      console.error('Error creating mock users:', error);
                      Alert.alert(
                        'Error',
                        error.message || 'Failed to create mock users. Make sure you\'re connected to the dev environment.',
                        [{ text: 'OK' }]
                      );
                    }
                  }}
                  disabled={selectedContacts.size === 0}
                >
                  <Text style={[styles.devButtonText, selectedContacts.size === 0 && styles.devButtonTextDisabled]}>
                    Create Mock Users
                  </Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.doneButton, (selectedContacts.size === 0 || matchContactsMutation.isPending || checkContactsMutation.isPending) && styles.doneButtonDisabled]}
                onPress={async () => {
                  const selected = deviceContacts.filter(contact => 
                    selectedContacts.has(contact.phone)
                  );
                  
                  if (selected.length === 0) {
                    return;
                  }

                  try {
                    // Step 1: Save selected contacts (only Plaza users can be selected)
                    console.log('[Contact Sync] Step 1: Saving selected contacts...');
                    await api.saveAppContacts(selected);
                    console.log('[Contact Sync] Step 1: Saved', selected.length, 'selected contacts');
                    
                    // Step 2: Hash the phone numbers
                    console.log('[Contact Sync] Step 2: Hashing phone numbers...');
                    const phoneNumbers = selected.map(c => c.phone);
                    const phoneHashes = await hashPhones(phoneNumbers, api.hashPhones);
                    console.log('[Contact Sync] Step 2: Hashed', phoneHashes.length, 'phone numbers');
                    
                    // Step 3: Match contacts (all selected contacts are Plaza users)
                    console.log('[Contact Sync] Step 3: Matching contacts...');
                    await matchContactsMutation.mutateAsync(phoneHashes);
                    console.log('[Contact Sync] Step 3: Contacts matched successfully');
                    
                    // Step 4: Show results
                    const count = selected.length;
                    const message = `Added ${count} friend${count !== 1 ? 's' : ''} on Plaza!`;
                    
                    Alert.alert(
                      'Contacts Saved',
                      message,
                      [{ text: 'OK', onPress: () => setShowSyncModal(false) }]
                    );
                    
                    // Refresh contacts list
                    queryClient.invalidateQueries({ queryKey: ['contacts'] });
                    queryClient.invalidateQueries({ queryKey: ['app-contacts'] });
                    queryClient.invalidateQueries({ queryKey: ['contacts-statuses'] });
                  } catch (error: any) {
                    console.error('Error syncing contacts:', error);
                    Alert.alert(
                      'Error',
                      error.message || 'Failed to sync contacts. Please try again.',
                      [{ text: 'OK' }]
                    );
                  }
                }}
                disabled={selectedContacts.size === 0 || matchContactsMutation.isPending || checkContactsMutation.isPending}
              >
                {(matchContactsMutation.isPending || checkContactsMutation.isPending) ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.doneButtonText, selectedContacts.size === 0 && styles.doneButtonTextDisabled]}>
                    Add {selectedContacts.size > 0 && `(${selectedContacts.size})`}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Find friends</Text>
            <Text style={styles.modalSubtitle}>See which contacts are already on Plaza</Text>
            
            {/* Search Bar */}
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
            
            {needsFullAccess && (
              <View style={styles.permissionWarningBox}>
                <Text style={styles.permissionWarningTitle}>Limited Contact Access</Text>
                <Text style={styles.permissionWarningText}>
                  It looks like you've only granted access to selected contacts. To find all your friends, please grant access to all contacts.
                </Text>
                <Pressable
                  style={styles.settingsButton}
                  onPress={async () => {
                    try {
                      await Linking.openSettings();
                    } catch (error) {
                      console.error('Error opening settings:', error);
                      Alert.alert(
                        'Unable to Open Settings',
                        'Please go to Settings > Privacy & Security > Contacts and grant full access to this app.'
                      );
                    }
                  }}
                >
                  <Text style={styles.settingsButtonText}>Open Settings</Text>
                </Pressable>
              </View>
            )}
            
            {isLoadingContacts ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading contacts...</Text>
              </View>
            ) : (() => {
              // Filter and partition contacts
              const filteredContacts = deviceContacts.filter(contact => {
                if (!searchQuery.trim()) return true;
                const query = searchQuery.toLowerCase();
                return (
                  contact.name.toLowerCase().includes(query) ||
                  contact.phone.includes(query)
                );
              });

              const plazaUsers = filteredContacts.filter(contact => contactsInPlaza.has(contact.phone));
              const nonPlazaUsers = filteredContacts.filter(contact => !contactsInPlaza.has(contact.phone));

              const renderContactItem = (item: { name: string; phone: string }, isInPlaza: boolean) => {
                const isSelected = selectedContacts.has(item.phone);
                
                // Only Plaza users can be selected
                if (!isInPlaza) {
                  return (
                    <View style={styles.contactItem}>
                      <View style={styles.contactInfo}>
                        <View style={styles.contactNameRow}>
                          <Text style={styles.contactName}>{item.name}</Text>
                          <Pressable
                            onPress={() => handleInviteContact(item)}
                          >
                            <Text style={styles.inviteLink}>Invite</Text>
                          </Pressable>
                        </View>
                        <Text style={styles.contactPhone}>{item.phone}</Text>
                      </View>
                    </View>
                  );
                }
                
                // Plaza users can be selected
                return (
                  <Pressable
                    style={styles.contactItem}
                    onPress={() => {
                      const newSelected = new Set(selectedContacts);
                      if (isSelected) {
                        newSelected.delete(item.phone);
                      } else {
                        newSelected.add(item.phone);
                      }
                      setSelectedContacts(newSelected);
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

              type ListItem = 
                | { type: 'header'; title: string; key: string }
                | { type: 'contact'; contact: { name: string; phone: string }; isPlaza: boolean };

              const listData: ListItem[] = [
                ...(plazaUsers.length > 0 ? [{ type: 'header' as const, title: 'On Plaza', key: 'plaza-header' }] : []),
                ...plazaUsers.map(c => ({ type: 'contact' as const, contact: c, isPlaza: true })),
                ...(nonPlazaUsers.length > 0 ? [{ type: 'header' as const, title: 'Not on Plaza', key: 'non-plaza-header' }] : []),
                ...nonPlazaUsers.map(c => ({ type: 'contact' as const, contact: c, isPlaza: false })),
              ];

              return (
                <FlatList
                  data={listData}
                  keyExtractor={(item, index) => {
                    if (item.type === 'header') return item.key;
                    return `${item.contact.phone}-${index}`;
                  }}
                  renderItem={({ item }) => {
                    if (item.type === 'header') {
                      return (
                        <View style={styles.sectionHeader}>
                          <Text style={styles.sectionHeaderText}>{item.title}</Text>
                        </View>
                      );
                    }
                    return renderContactItem(item.contact, item.isPlaza);
                  }}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>
                        {searchQuery.trim() 
                          ? `No contacts found matching "${searchQuery}"` 
                          : 'No contacts found'}
                      </Text>
                      {needsFullAccess && (
                        <Pressable
                          style={styles.settingsButton}
                          onPress={async () => {
                            try {
                              await Linking.openSettings();
                            } catch (error) {
                              console.error('Error opening settings:', error);
                              Alert.alert(
                                'Unable to Open Settings',
                                'Please go to Settings > Privacy & Security > Contacts and grant full access to this app.'
                              );
                            }
                          }}
                        >
                          <Text style={styles.settingsButtonText}>Open Settings to Grant Full Access</Text>
                        </Pressable>
                      )}
                    </View>
                  }
                />
              );
            })()}
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading...</Text>
      </View>
    );
  }

  return <HomeScreenContent />;
}

const styles = StyleSheet.create({
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

