import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createApi } from '../../lib/api';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import * as Contacts from 'expo-contacts';
import { User } from '../../lib/types';
import { Share } from 'react-native';

const SyncContactsScreenContent = () => {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const api = createApi(getToken);
  const queryClient = useQueryClient();
  const router = useRouter();

  const [contactsPermission, setContactsPermission] = useState<Contacts.PermissionResponse | null>(null);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState<Array<{ name: string; phone: string }>>([]);
  const [syncResult, setSyncResult] = useState<{
    existingUsers: User[];
    notUsers: string[];
  } | null>(null);

  // Request contacts permission
  useEffect(() => {
    const requestPermission = async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      setContactsPermission({ status } as Contacts.PermissionResponse);
    };
    requestPermission();
  }, []);

  // Load contacts from device
  const loadContacts = async () => {
    if (contactsPermission?.status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant contacts permission to sync your contacts.');
      return;
    }

    setIsLoadingContacts(true);
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      // Extract phone numbers (normalize to digits only)
      const phoneNumbers = data
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

      setDeviceContacts(phoneNumbers);
      console.log(`Loaded ${phoneNumbers.length} contacts with phone numbers`);
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts. Please try again.');
    } finally {
      setIsLoadingContacts(false);
    }
  };

  // Sync contacts with backend
  const syncContactsMutation = useMutation({
    mutationFn: (phoneNumbers: string[]) => api.syncContacts(phoneNumbers),
    onSuccess: (data) => {
      console.log('Sync result:', data);
      setSyncResult(data);
    },
    onError: (error: any) => {
      console.error('Error syncing contacts:', error);
      Alert.alert('Error', error?.message || 'Failed to sync contacts. Please try again.');
    },
  });

  const handleSync = async () => {
    if (deviceContacts.length === 0) {
      Alert.alert('No Contacts', 'Please load your contacts first.');
      return;
    }

    const phoneNumbers = deviceContacts.map(c => c.phone);
    syncContactsMutation.mutate(phoneNumbers);
  };

  const handleInvite = async (phoneNumber: string) => {
    const contact = deviceContacts.find(c => c.phone === phoneNumber);
    const contactName = contact?.name || 'them';
    
    // Generate dummy invite code for now
    const chars = '0123456789abcdef';
    let code = '';
    for (let i = 0; i < 32; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    const appStoreUrl = 'https://apps.apple.com/app/id/YOUR_APP_ID';
    const shareMessage = `Hey ${contactName}! Join me on Plaza. Download here: ${appStoreUrl}\n\nInvite code: ${code}`;

    try {
      await Share.share({
        message: shareMessage,
        title: 'Invite to Plaza',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Sync Your Contacts</Text>
      <Text style={styles.subtitle}>
        Find friends who are already on Plaza, or invite them to join!
      </Text>

      {contactsPermission?.status !== 'granted' && (
        <View style={styles.permissionBox}>
          <Text style={styles.permissionText}>
            Contacts permission is required to find your friends on Plaza.
          </Text>
          <Text style={styles.permissionNote}>
            We only use phone numbers to find matches. We don't store your contact list.
          </Text>
        </View>
      )}

      <Pressable
        onPress={loadContacts}
        disabled={contactsPermission?.status !== 'granted' || isLoadingContacts}
        style={[
          styles.button,
          styles.primaryButton,
          (contactsPermission?.status !== 'granted' || isLoadingContacts) && styles.buttonDisabled,
        ]}
      >
        {isLoadingContacts ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {deviceContacts.length > 0
              ? `Reload Contacts (${deviceContacts.length} found)`
              : 'Load Contacts'}
          </Text>
        )}
      </Pressable>

      {deviceContacts.length > 0 && (
        <Pressable
          onPress={handleSync}
          disabled={syncContactsMutation.isPending}
          style={[
            styles.button,
            styles.secondaryButton,
            syncContactsMutation.isPending && styles.buttonDisabled,
          ]}
        >
          {syncContactsMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sync with Plaza</Text>
          )}
        </Pressable>
      )}

      {syncResult && (
        <View style={styles.resultsContainer}>
          {syncResult.existingUsers.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Friends on Plaza ({syncResult.existingUsers.length})
              </Text>
              {syncResult.existingUsers.map((user) => (
                <View key={user.id} style={styles.userCard}>
                  <Text style={styles.userName}>{user.name || user.phone}</Text>
                  <Text style={styles.userPhone}>{user.phone}</Text>
                  {user.isAlreadyContact ? (
                    <Text style={styles.alreadyContact}>Already a contact</Text>
                  ) : (
                    <Pressable
                      style={styles.addButton}
                      onPress={() => {
                        // TODO: Add contact functionality
                        Alert.alert('Coming Soon', 'Add contact feature will be implemented');
                      }}
                    >
                      <Text style={styles.addButtonText}>Add Contact</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}

          {syncResult.notUsers.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Invite Friends ({syncResult.notUsers.length})
              </Text>
              {syncResult.notUsers.slice(0, 10).map((phone) => {
                const contact = deviceContacts.find(c => c.phone === phone);
                return (
                  <View key={phone} style={styles.userCard}>
                    <Text style={styles.userName}>{contact?.name || phone}</Text>
                    <Text style={styles.userPhone}>{phone}</Text>
                    <Pressable
                      style={styles.inviteButton}
                      onPress={() => handleInvite(phone)}
                    >
                      <Text style={styles.inviteButtonText}>Invite</Text>
                    </Pressable>
                  </View>
                );
              })}
              {syncResult.notUsers.length > 10 && (
                <Text style={styles.moreText}>
                  + {syncResult.notUsers.length - 10} more contacts
                </Text>
              )}
            </View>
          )}

          {syncResult.existingUsers.length === 0 && syncResult.notUsers.length === 0 && (
            <Text style={styles.noResults}>No matches found in your contacts.</Text>
          )}
        </View>
      )}

      <Pressable onPress={handleSkip} style={[styles.button, styles.skipButton]}>
        <Text style={styles.skipButtonText}>Skip for Now</Text>
      </Pressable>
    </ScrollView>
  );
};

export default function SyncContactsScreen() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
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

  return <SyncContactsScreenContent />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  permissionBox: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  permissionText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  permissionNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#34C759',
  },
  skipButton: {
    backgroundColor: '#f0f0f0',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    marginTop: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  userCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  alreadyContact: {
    fontSize: 12,
    color: '#34C759',
    fontStyle: 'italic',
  },
  addButton: {
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  inviteButton: {
    backgroundColor: '#34C759',
    padding: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  moreText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  noResults: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
});

