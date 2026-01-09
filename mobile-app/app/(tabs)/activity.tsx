import { View, FlatList, Text, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createApi } from '../../lib/api';
import { ContactListItem } from '../../components/ContactListItem';
import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';

function ActivityScreenContent() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const api = createApi(getToken);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  // All hooks must be called before any conditional returns
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

  // Calculate header padding
  const headerPaddingTop = insets.top + 16;
  
  // Merge contacts with their statuses
  const contactsWithStatus = contacts?.map((contact: any) => ({
    ...contact,
    status: statuses?.find((s: any) => s.user?.id === contact.id || s.userId === contact.id),
  })) || [];

  // Filter to only show contacts with active statuses
  // Backend already filters statuses by time window (startTime <= now <= endTime)
  const activeContacts = contactsWithStatus.filter((contact: any) => contact.status !== undefined);

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

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }
  
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.headerContainer, { paddingTop: headerPaddingTop }]}>
        <Text style={styles.headerTitle}>Activity</Text>
      </View>
      <FlatList
        data={activeContacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ContactListItem contact={item} />}
        refreshControl={
          <RefreshControl 
            refreshing={isLoading} 
            onRefresh={() => {
              refetch();
              queryClient.invalidateQueries({ queryKey: ['contacts-statuses'] });
            }} 
          />
        }
        ListEmptyComponent={
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#666', textAlign: 'center' }}>
              No contacts are currently active.
            </Text>
          </View>
        }
      />
    </View>
  );
}

export default function ActivityScreen() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Delay rendering until after mount to ensure ClerkProvider is ready
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading...</Text>
      </View>
    );
  }

  return <ActivityScreenContent />;
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
});
