import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Contact, AvailabilityStatus, getFullName } from '../lib/types';
import { useRouter } from 'expo-router';

interface Props {
  contact: Contact;
}

export function ContactListItem({ contact }: Props) {
  const router = useRouter();

  const getStatusColor = () => {
    if (!contact.status) return '#999';
    switch (contact.status.status) {
      case AvailabilityStatus.AVAILABLE:
        return '#25D366'; // WhatsApp green
      case AvailabilityStatus.QUESTIONABLE:
        return '#FFB800'; // Yellow/Orange
      case AvailabilityStatus.UNAVAILABLE:
        return '#F44336'; // Red
      default:
        return '#999';
    }
  };

  // Get initials for avatar
  const getInitials = () => {
    const fullName = getFullName(contact);
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  // Get avatar background color based on name
  const getAvatarColor = () => {
    const fullName = getFullName(contact);
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80'
    ];
    const index = fullName.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const displayName = getFullName(contact);
  const displaySubtext = contact.status?.message || contact.phone || 'No status';

  return (
    <Pressable
      onPress={() => router.push(`/contact/${contact.id}`)}
      style={styles.container}
    >
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, { backgroundColor: getAvatarColor() }]}>
          <Text style={styles.avatarText}>{getInitials()}</Text>
        </View>
        {/* Status indicator dot */}
        {contact.status && (
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
        <Text style={styles.subtext} numberOfLines={1}>
          {displaySubtext}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  avatarContainer: {
    position: 'relative',
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
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  subtext: {
    fontSize: 14,
    color: '#667781',
    marginTop: 2,
  },
});

