import { View, FlatList, Text, RefreshControl, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { createApi } from '../../lib/api';
import { ContactListItem } from '../../components/ContactListItem';
import { useAuth } from '@clerk/clerk-expo';
import { Redirect, useRouter } from 'expo-router';
import { lazy, Suspense, useEffect, useState } from 'react';

const HomeScreenContent = lazy(() => Promise.resolve({
  default: function HomeScreenContent() {
    const { isSignedIn, isLoaded, getToken } = useAuth();
    const api = createApi(getToken);
    const router = useRouter();

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
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push('/(tabs)/sync-contacts')}
          style={styles.syncButton}
        >
          <Text style={styles.syncButtonText}>Sync Contacts</Text>
        </Pressable>
      </View>
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
              onPress={() => router.push('/(tabs)/sync-contacts')}
              style={styles.syncButton}
            >
              <Text style={styles.syncButtonText}>Sync Contacts to Find Friends</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
  }
}));

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

  return (
    <Suspense fallback={
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading...</Text>
      </View>
    }>
      <HomeScreenContent />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  syncButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

