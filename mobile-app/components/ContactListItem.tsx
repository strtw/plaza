import { View, Text, Pressable } from 'react-native';
import { Contact, AvailabilityStatus } from '../lib/types';
import { useRouter } from 'expo-router';

interface Props {
  contact: Contact;
}

export function ContactListItem({ contact }: Props) {
  const router = useRouter();

  const getStatusColor = () => {
    if (!contact.status) return 'gray';
    switch (contact.status.status) {
      case AvailabilityStatus.AVAILABLE:
        return 'green';
      case AvailabilityStatus.QUESTIONABLE:
        return 'yellow';
      case AvailabilityStatus.UNAVAILABLE:
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <Pressable
      onPress={() => router.push(`/contact/${contact.id}`)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: getStatusColor(),
          marginRight: 15,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600' }}>
          {contact.name || contact.email}
        </Text>
        {contact.status?.message && (
          <Text style={{ fontSize: 14, color: '#666' }}>
            {contact.status.message}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

