import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams();
  const api = useApi();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Get initials for avatar (reused from ContactListItem pattern)
  const getInitials = (contact: any) => {
    const name = contact?.name || contact?.email || '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get avatar background color based on name (reused from ContactListItem pattern)
  const getAvatarColor = (contact: any) => {
    const name = contact?.name || contact?.email || '';
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

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

  const displayName = contact.name || contact.email || 'Unknown';

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.headerContainer, { paddingTop: insets.top + 16 }]}>
        <Pressable 
          style={styles.backButton}
          onPress={() => router.push('/(tabs)')}
        >
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </Pressable>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: getAvatarColor(contact) }]}>
            <Text style={styles.avatarText}>{getInitials(contact)}</Text>
          </View>
        </View>
        <View style={styles.nameContainer}>
          <Text style={styles.nameText} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1, padding: 20 }}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
    minHeight: 60,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  nameContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  nameText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
});

