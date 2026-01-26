import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Contact, AvailabilityStatus, StatusLocation, getFullName } from '../lib/types';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';

interface Props {
  contact: Contact;
  isNew?: boolean; // Optional prop to indicate if this is a new/updated item
  isUpdated?: boolean; // Optional prop to indicate if this is an updated/changed item
  previousStatus?: any; // Previous status data for comparison (only when isUpdated is true)
  statusState?: 'expired' | 'cleared' | null; // Status state for grayed-out display
  textFadeAnim?: Animated.Value | null; // Animation for text fade when status is cleared
}

export function ContactListItem({ contact, isNew = false, isUpdated = false, previousStatus, statusState = null, textFadeAnim = null }: Props) {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(new Date());

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
  // For cleared statuses, show time even if expired (will be strike-through)
  const getTimeRemaining = (showForCleared: boolean = false): string => {
    if (!contact.status?.endTime) return '';
    const end = new Date(contact.status.endTime);
    const diffMs = end.getTime() - currentTime.getTime();

    // For cleared statuses, show time even if expired (will be strike-through)
    // For other statuses, return empty string if expired
    if (diffMs <= 0 && !showForCleared) {
      return '';
    }

    const diffMinutes = Math.floor(Math.abs(diffMs) / 60000);
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

  const handlePress = () => {
    const params: any = {};
    if (isUpdated && previousStatus) {
      // Pass previous status data as query params for comparison display
      params.isUpdated = 'true';
      params.previousStatus = JSON.stringify(previousStatus);
    }
    const queryString = Object.keys(params).length > 0 
      ? '?' + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&')
      : '';
    router.push(`/contact/${contact.id}${queryString}`);
  };

  const isExpiredOrCleared = statusState === 'expired' || statusState === 'cleared';

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.container,
        isExpiredOrCleared && styles.containerDisabled
      ]}
      disabled={isExpiredOrCleared}
    >
      <View style={styles.avatarContainer}>
        <View style={[
          styles.avatar, 
          { backgroundColor: isExpiredOrCleared ? '#E5E5E5' : getAvatarColor() }
        ]}>
          <Text style={[
            styles.avatarText,
            isExpiredOrCleared && styles.avatarTextDisabled
          ]}>{getInitials()}</Text>
        </View>
        {/* Pill below avatar */}
        {(isNew || isUpdated) && !isExpiredOrCleared && (
          <View style={styles.pillOverlay}>
            <Text style={styles.pillText}>{isNew ? 'new' : 'updated'}</Text>
          </View>
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <View style={styles.nameAndStatus}>
            <Text style={[
              styles.name,
              isExpiredOrCleared && styles.nameDisabled
            ]} numberOfLines={1}>
              {displayName}
            </Text>
            {/* Show status message - fade transition for cleared/expired statuses */}
            {statusState === 'cleared' ? (
              <View style={styles.statusTextContainer}>
                {/* Original text fading out */}
                {contact.status?.message && textFadeAnim && (
                  <Animated.Text 
                    style={[
                      styles.statusText,
                      isExpiredOrCleared && styles.statusTextDisabled,
                      styles.statusTextAbsolute,
                      { opacity: textFadeAnim }
                    ]} 
                    numberOfLines={1}
                  >
                    {contact.status.message}
                  </Animated.Text>
                )}
                {/* Cleared message fading in */}
                <Animated.Text 
                  style={[
                    styles.statusText,
                    styles.statusTextCleared,
                    styles.statusTextItalic,
                    styles.statusTextAbsolute,
                    textFadeAnim ? { opacity: Animated.subtract(1, textFadeAnim) } : { opacity: 1 }
                  ]} 
                  numberOfLines={1}
                >
                  Status cleared by user
                </Animated.Text>
              </View>
            ) : statusState === 'expired' ? (
              <Text style={[
                styles.statusText,
                styles.statusTextCleared,
                isExpiredOrCleared && styles.statusTextDisabled
              ]} numberOfLines={1}>
                Status expired
              </Text>
            ) : contact.status?.message ? (
              <Text style={[
                styles.statusText,
                isExpiredOrCleared && styles.statusTextDisabled
              ]} numberOfLines={1}>
                {contact.status.message}
              </Text>
            ) : null}
          </View>
          <View style={styles.rightIcons}>
            {/* Mute bell icon for muted users - positioned left of time remaining */}
            {contact.friendStatus === 'MUTED' && !isExpiredOrCleared && (
              <Ionicons 
                name="notifications-off" 
                size={16} 
                color="#999" 
                style={styles.muteIcon}
              />
            )}
            {/* Time remaining bubble, expired pill, or cleared pill - positioned left of location icon */}
            {contact.status && (
              <>
                {statusState === 'expired' ? (
                  // Show red "expired" pill when expired
                  <View style={[styles.timeBubble, styles.expiredBubble]}>
                    <Text style={styles.timeBubbleText}>expired</Text>
                  </View>
                ) : statusState === 'cleared' ? (
                  // Show gray "cleared" pill when cleared
                  <View style={[styles.timeBubble, styles.clearedBubble]}>
                    <Text style={styles.timeBubbleText}>cleared</Text>
                  </View>
                ) : !isStatusExpiredOrExpiringSoon() ? (
                  // Normal time bubble when active
                  <View style={[styles.timeBubble, { backgroundColor: getStatusColor() }]}>
                    <Text style={styles.timeBubbleText}>{getTimeRemaining()}</Text>
                  </View>
                ) : null}
              </>
            )}
            {locationIcon && !isExpiredOrCleared && (
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
  containerDisabled: {
    backgroundColor: '#E5E5E5',
    opacity: 0.6,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
    overflow: 'visible',
    minWidth: 70,
    alignItems: 'center',
  },
  pillOverlay: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BBDEFB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  pillText: {
    fontSize: 10,
    color: '#1976D2',
    fontWeight: '600',
    textTransform: 'uppercase',
    flexShrink: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
    width: undefined,
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
  nameDisabled: {
    color: '#999',
  },
  statusTextContainer: {
    position: 'relative',
    height: 20, // Fixed height to prevent layout shift
    marginTop: 2,
  },
  statusText: {
    fontSize: 14,
    color: '#667781',
    marginTop: 2,
  },
  statusTextAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    marginTop: 0,
  },
  statusTextDisabled: {
    color: '#999',
  },
  statusTextCleared: {
    color: '#999',
  },
  statusTextItalic: {
    fontStyle: 'italic',
  },
  avatarTextDisabled: {
    color: '#999',
  },
  expiredBubble: {
    backgroundColor: '#F44336', // Red for expired
  },
  clearedBubble: {
    backgroundColor: '#999', // Gray for cleared
  },
  timeBubbleStrikethrough: {
    textDecorationLine: 'line-through',
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
  muteIcon: {
    // No margin needed, gap handles spacing
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

