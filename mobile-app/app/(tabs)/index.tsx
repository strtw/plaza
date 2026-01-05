import { View, FlatList, Text, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../lib/api';
import { ContactListItem } from '../../components/ContactListItem';

export default function HomeScreen() {
  const api = useApi();

  const { data: contacts, isLoading, refetch } = useQuery({
    queryKey: ['contacts'],
    queryFn: api.getContacts,
  });

  const { data: statuses } = useQuery({
    queryKey: ['contacts-statuses'],
    queryFn: api.getContactsStatuses,
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
            <Text>No contacts yet. Invite someone!</Text>
          </View>
        }
      />
    </View>
  );
}

