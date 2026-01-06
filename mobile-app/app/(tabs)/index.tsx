import { View, FlatList, Text, RefreshControl, ActivityIndicator, StyleSheet, Modal, Pressable, Alert, Linking, AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { createApi } from '../../lib/api';
import { ContactListItem } from '../../components/ContactListItem';
import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import * as Contacts from 'expo-contacts';

function HomeScreenContent() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const api = createApi(getToken);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState<Array<{ name: string; phone: string }>>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [needsFullAccess, setNeedsFullAccess] = useState(false);
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
    } catch (error) {
      console.error('Error loading contacts:', error);
      setDeviceContacts([]);
    } finally {
      setIsLoadingContacts(false);
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

  const { data: statuses } = useQuery({
    queryKey: ['contacts-statuses'],
    queryFn: api.getContactsStatuses,
    enabled: isLoaded && isSignedIn,
    refetchInterval: 10000, // Poll every 10 seconds
  });

  // Merge contacts with their statuses
  const contactsWithStatus = contacts?.map((contact: any) => ({
    ...contact,
    status: statuses?.find((s: any) => s.user?.id === contact.id || s.userId === contact.id),
  }));

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
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
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
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sync Contacts</Text>
            <Text style={styles.modalSubtitle}>Find friends who are already on Plaza</Text>
            
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
            ) : (
              <FlatList
                data={deviceContacts}
                keyExtractor={(item, index) => `${item.phone}-${index}`}
                renderItem={({ item }) => (
                  <View style={styles.contactItem}>
                    <View style={styles.checkbox}>
                      <View style={styles.checkboxInner} />
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>{item.name}</Text>
                      <Text style={styles.contactPhone}>{item.phone}</Text>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No contacts found</Text>
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
            )}
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
  checkboxInner: {
    width: 14,
    height: 14,
    borderRadius: 2,
    backgroundColor: '#007AFF',
    opacity: 0,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
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

