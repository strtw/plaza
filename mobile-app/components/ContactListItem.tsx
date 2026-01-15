import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Contact, AvailabilityStatus, StatusLocation, getFullName } from '../lib/types';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';

interface Props {
  contact: Contact;
  isNew?: boolean; // Optional prop to indicate if this is a new/updated item
  isUpdated?: boolean; // Optional prop to indicate if this is an updated/changed item
}

export function ContactListItem({ contact, isNew = false, isUpdated = false }: Props) {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Debug: Log pill props
  useEffect(() => {
    if (isNew || isUpdated) {
      console.log('[ContactListItem] Pill props:', { 
        contactId: contact.id, 
        contactName: contact.firstName || contact.lastName || 'Unknown',
        isNew, 
        isUpdated 
      });
    }
  }, [isNew, isUpdated, contact.id]);

  // Update current time every minute to refresh time remaining
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Helper function to check if status is expired or expiring soon (< 1 minute)
  const isStatusExpiredOrExpiringSoon = (): boolean => {
    if (!contact.status?.endTime) return true;
    const end = new Date(contact.status.endTime);
    const diffMs = end.getTime() - currentTime.getTime();
    return diffMs <= 60000; // Less than 1 minute
  };

  // Get time remaining until status expires
  const getTimeRemaining = (): string => {
    if (!contact.status?.endTime) return '';
    const end = new Date(contact.status.endTime);
    const diffMs = end.getTime() - currentTime.getTime();

    // Guard clause: if expired, return empty string
    if (diffMs <= 0) {
      return '';
    }

    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;

    if (diffHours >= 1) {
      if (remainingMinutes > 0) {
        // Format: "1h 15m" or "2h 30m"
        return `${diffHours}h ${remainingMinutes}m`;
      }
      // Exactly X hours: "1h" or "2h"
      return `${diffHours}h`;
    }

    if (diffMinutes >= 1) {
      // Format: "18m"
      return `${diffMinutes}m`;
    }

    return '<1m';
  };

  const getStatusColor = () => {
    if (!contact.status) return '#999';
    
    // Check if time remaining is 15 minutes or less - use yellow
    if (contact.status.endTime) {
      const end = new Date(contact.status.endTime);
      const diffMs = end.getTime() - currentTime.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      
      if (diffMinutes > 0 && diffMinutes <= 15) {
        return '#FFC107'; // Yellow for 15 minutes or less
      }
    }
    
    // Otherwise use normal status color
    switch (contact.status.status) {
      case AvailabilityStatus.AVAILABLE:
        return '#25D366'; // WhatsApp green
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

  // Get location icon name based on status location (matching status modal icons)
  const getLocationIcon = (): keyof typeof Ionicons.glyphMap | null => {
    if (!contact.status?.location) return null;
    switch (contact.status.location) {
      case StatusLocation.HOME:
        return 'home-outline';
      case StatusLocation.GREENSPACE:
        return 'leaf';
      case StatusLocation.THIRD_PLACE:
        return 'business';
      default:
        return null;
    }
  };

  const locationIcon = getLocationIcon();

  return (
    <Pressable
      onPress={() => router.push(`/contact/${contact.id}`)}
      style={[styles.container, isNew && { backgroundColor: '#E8F5E9' }]}
    >
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, { backgroundColor: getAvatarColor() }]}>
          <Text style={styles.avatarText}>{getInitials()}</Text>
        </View>
        {/* Pill overlay on avatar bottom-right */}
        {isNew && (
          <View style={styles.pillOverlay}>
            <Text style={styles.pillText}>new</Text>
          </View>
        )}
        {isUpdated && !isNew && (
          <View style={styles.pillOverlay}>
            <Ionicons name="refresh" size={10} color="#1976D2" />
            <Text style={styles.pillText}>updated</Text>
          </View>
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <View style={styles.nameAndStatus}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            {contact.status?.message && (
              <Text style={styles.statusText} numberOfLines={1}>
                {contact.status.message}
              </Text>
            )}
          </View>
          <View style={styles.rightIcons}>
            {/* Time remaining bubble - positioned left of location icon */}
            {contact.status && !isStatusExpiredOrExpiringSoon() && (
              <View style={[styles.timeBubble, { backgroundColor: getStatusColor() }]}>
                <Text style={styles.timeBubbleText}>{getTimeRemaining()}</Text>
              </View>
            )}
            {locationIcon && (
              <Ionicons 
                name={locationIcon} 
                size={20} 
                color="#666" 
                style={styles.locationIcon}
              />
            )}
          </View>
        </View>
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
  pillOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#BBDEFB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  pillText: {
    fontSize: 10,
    color: '#1976D2',
    fontWeight: '600',
    textTransform: 'uppercase',
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
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameAndStatus: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  statusText: {
    fontSize: 14,
    color: '#667781',
    marginTop: 2,
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeBubble: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBubbleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  locationIcon: {
    // No margin needed, gap handles spacing
  },
  subtext: {
    fontSize: 14,
    color: '#667781',
    marginTop: 2,
  },
});

