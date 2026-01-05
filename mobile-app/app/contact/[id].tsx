import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../lib/api';

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams();
  const api = useApi();

  const { data: contacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: api.getContacts,
  });

  const { data: statuses } = useQuery({
    queryKey: ['contacts-statuses'],
    queryFn: api.getContactsStatuses,
  });

  const contact = contacts?.find((c: any) => c.id === id);
  const status = statuses?.find((s: any) => s.user?.id === id || s.userId === id);

  if (!contact) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Contact not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        {contact.name || contact.email}
      </Text>

      {status ? (
        <View>
          <Text style={{ fontSize: 18, marginBottom: 10 }}>
            Status: {status.status}
          </Text>
          {status.message && (
            <Text style={{ fontSize: 16, color: '#666', marginBottom: 10 }}>
              {status.message}
            </Text>
          )}
          <Text style={{ fontSize: 14, color: '#999' }}>
            Available: {new Date(status.startTime).toLocaleTimeString()} -{' '}
            {new Date(status.endTime).toLocaleTimeString()}
          </Text>
        </View>
      ) : (
        <Text>No current status</Text>
      )}
    </ScrollView>
  );
}

