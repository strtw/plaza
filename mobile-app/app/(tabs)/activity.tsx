import { View, FlatList, Text, RefreshControl, ActivityIndicator, StyleSheet, Modal, TextInput, Pressable, ScrollView, Alert, Platform, Animated, LayoutAnimation, UIManager } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createApi } from '../../lib/api';
import { ContactListItem } from '../../components/ContactListItem';
import { AvailabilityStatus, StatusLocation, ContactStatus, getFullName } from '../../lib/types';
import { useAuth } from '@clerk/clerk-expo';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState, useRef, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useUserStore } from '../../stores/userStore';

// Animated wrapper component for new contact items (fade in with opacity pulse)
const AnimatedContactListItem = ({ contact }: { contact: any }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade in first
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      // After fade in, do opacity pulse (fade in/out)
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  return (
    <Animated.View 
      style={{ 
        opacity: Animated.multiply(fadeAnim, pulseAnim), // Combine fade and pulse
      }}
    >
      <ContactListItem contact={contact} isNew={true} />
    </Animated.View>
  );
};

// Helper function to round time to nearest 15 minutes
const roundToNearest15Minutes = (date: Date): Date => {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  rounded.setMinutes(roundedMinutes, 0, 0);
  return rounded;
};

// Helper function to round UP to next 15-minute interval, then add 15 minutes
const getDefaultEndTime = (): Date => {
  const now = new Date();
  const minutes = now.getMinutes();
  // Round UP to next 15-minute interval
  const roundedUpMinutes = Math.ceil(minutes / 15) * 15;
  const roundedUp = new Date(now);
  roundedUp.setMinutes(roundedUpMinutes, 0, 0);
  // Add 15 minutes
  roundedUp.setMinutes(roundedUp.getMinutes() + 15);
  return roundedUp;
};

// Helper to map backend location enum to frontend format
const mapBackendToFrontendLocation = (location: StatusLocation): 'home' | 'greenspace' | 'third-place' | null => {
  const map: Record<StatusLocation, 'home' | 'greenspace' | 'third-place'> = {
    'HOME': 'home',
    'GREENSPACE': 'greenspace',
    'THIRD_PLACE': 'third-place',
  };
  return map[location] || null;
};

function ActivityScreenContent() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const api = createApi(getToken);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentStatus: storeStatus, setCurrentStatus } = useUserStore();

  // Modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState<'home' | 'greenspace' | 'third-place' | null>(null);
  
  const [endTime, setEndTime] = useState<Date | null>(() => {
    return getDefaultEndTime();
  });

  // All hooks must be called before any conditional returns
  const { data: contacts, isLoading, refetch } = useQuery({
    queryKey: ['contacts'],
    queryFn: api.getContacts,
    enabled: isLoaded && isSignedIn,
  });

  const { data: statuses, refetch: refetchStatuses } = useQuery({
    queryKey: ['friends-statuses'],
    queryFn: api.getFriendsStatuses,
    enabled: isLoaded && isSignedIn,
    refetchInterval: 10000, // Poll every 10 seconds
  });

  const { data: currentStatus } = useQuery({
    queryKey: ['my-status'],
    queryFn: async () => {
      const result = await api.getMyStatus();
      // Filter out expired or expiring soon statuses to prevent showing "Expired"
      if (isStatusExpiredOrExpiringSoon(result)) {
        return null; // Don't update FE with expiring/expired status
      }
      return result;
    },
    enabled: isLoaded && isSignedIn,
    refetchInterval: 10000, // Poll every 10 seconds
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: api.getOrCreateMe,
    enabled: isLoaded && isSignedIn,
  });

  // Sync API response to store
  useEffect(() => {
    if (currentStatus && !isStatusExpiredOrExpiringSoon(currentStatus)) {
      setCurrentStatus(currentStatus);
    } else {
      setCurrentStatus(null); // Clear if expired or expiring soon
    }
  }, [currentStatus, setCurrentStatus]);

  // Timer effect to clear expired status immediately (checks every 10 seconds)
  useEffect(() => {
    if (!storeStatus || !storeStatus.endTime) return;
    
    const checkExpiration = () => {
      const now = new Date(); // Use new Date() directly, not currentTime state
      const end = new Date(storeStatus.endTime);
      if (end.getTime() <= now.getTime()) {
        // Clear from both store and query cache
        setCurrentStatus(null);
        queryClient.setQueryData(['my-status'], null);
      }
    };
    
    // Check immediately
    checkExpiration();
    
    // Then check every 10 seconds (more frequent than currentTime updates)
    const interval = setInterval(checkExpiration, 10000);
    return () => clearInterval(interval);
  }, [storeStatus, setCurrentStatus, queryClient]);

  const createStatusMutation = useMutation({
    mutationFn: api.createStatus,
    onMutate: async (newStatus) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['my-status'] });
      
      // Snapshot previous value
      const previousStatus = queryClient.getQueryData(['my-status']);
      
      // Create optimistic status object (matches ContactStatus interface)
      const optimisticStatus = {
        id: `temp-${Date.now()}`, // Temporary ID
        status: newStatus.status,
        message: newStatus.message,
        location: newStatus.location,
        startTime: newStatus.startTime,
        endTime: newStatus.endTime,
      } as ContactStatus;
      
      // Optimistically update cache and store immediately
      queryClient.setQueryData(['my-status'], optimisticStatus);
      setCurrentStatus(optimisticStatus);
      
      return { previousStatus };
    },
    onSuccess: (data) => {
      // Update with real data from server (includes real ID and all fields)
      queryClient.setQueryData(['my-status'], data);
      setCurrentStatus(data as ContactStatus);
      
      // Invalidate to ensure everything is in sync
      queryClient.invalidateQueries({ queryKey: ['my-status'] });
      queryClient.invalidateQueries({ queryKey: ['friends-statuses'] });
      
      // Reset form state
      setMessage('');
      setLocation(null);
      setEndTime(getDefaultEndTime());
      setShowStatusModal(false);
      Alert.alert('Success', 'Your status has been set!');
    },
    onError: (error: any, variables, context) => {
      // Rollback optimistic update
      if (context?.previousStatus) {
        queryClient.setQueryData(['my-status'], context.previousStatus);
        setCurrentStatus(context.previousStatus as ContactStatus | null);
      }
      Alert.alert('Error', error.message || 'Failed to set status. Please try again.');
    },
  });

  const deleteStatusMutation = useMutation({
    mutationFn: api.deleteMyStatus,
    onMutate: async () => {
      // Optimistic update: immediately remove from store
      setCurrentStatus(null);
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['my-status'] });
      // Snapshot previous value
      const previousStatus = queryClient.getQueryData(['my-status']);
      // Optimistically set to null
      queryClient.setQueryData(['my-status'], null);
      return { previousStatus };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-status'] });
      queryClient.invalidateQueries({ queryKey: ['friends-statuses'] });
      setShowStatusModal(false);
      Alert.alert('Success', 'Your status has been cleared!');
    },
    onError: (error: any, variables, context) => {
      // Rollback optimistic update
      if (context?.previousStatus) {
        queryClient.setQueryData(['my-status'], context.previousStatus);
        setCurrentStatus(context.previousStatus as any);
      }
      Alert.alert('Error', error.message || 'Failed to clear status. Please try again.');
    },
  });

  // Calculate header padding
  const headerPaddingTop = insets.top + 16;
  
  // Avatar helper functions
  const getInitials = () => {
    if (!currentUser) return '?';
    const fullName = getFullName(currentUser);
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = () => {
    if (!currentUser) return '#E5E5E5';
    const fullName = getFullName(currentUser);
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80'
    ];
    const index = fullName.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Time remaining calculation and update
  const [currentTime, setCurrentTime] = useState(new Date());

  // Track status updates for "New updates" indicator
  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  const previousStatusesRef = useRef<Array<any>>([]);
  
  // Track displayed statuses (what user currently sees - frozen until refresh)
  const [displayedStatuses, setDisplayedStatuses] = useState<Array<any>>([]);
  // Initialize banner opacity to 1 (always visible) to prevent layout shifts
  const bannerOpacity = useRef(new Animated.Value(1)).current;
  // Pulse animation for when updates are detected
  const bannerPulse = useRef(new Animated.Value(1)).current;
  const previousDisplayedStatusesRef = useRef<Array<any>>([]);
  const newOrChangedContactIdsRef = useRef<Set<string>>(new Set());
  const newOnlyIdsRef = useRef<Set<string>>(new Set()); // Track only truly new items for pulse
  
  // Enable LayoutAnimation on Android
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  // Initialize displayedStatuses when statuses first load
  useEffect(() => {
    if (statuses && displayedStatuses.length === 0) {
      setDisplayedStatuses(statuses);
      previousDisplayedStatusesRef.current = [...statuses];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses]);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Detect status changes to show "New updates" indicator
  // Compare current statuses (from polling) with displayedStatuses (what user sees)
  useEffect(() => {
    if (!statuses || displayedStatuses.length === 0) {
      return;
    }

    // Compare current statuses with displayed statuses
    const currentStatusIds = new Set(statuses.map((s: any) => s.id));
    const displayedStatusIds = new Set(displayedStatuses.map((s: any) => s.id));

    // Check for new or removed statuses
    const hasNewStatuses = statuses.some((s: any) => !displayedStatusIds.has(s.id));
    const hasRemovedStatuses = displayedStatuses.some(
      (s: any) => !currentStatusIds.has(s.id)
    );

    // Check for updated statuses (same ID but different content)
    const hasUpdatedStatuses = statuses.some((current: any) => {
      const displayed = displayedStatuses.find((d: any) => d.id === current.id);
      if (!displayed) return false;
      return (
        displayed.message !== current.message ||
        displayed.location !== current.location ||
        displayed.endTime !== current.endTime
      );
    });

    if (hasNewStatuses || hasRemovedStatuses || hasUpdatedStatuses) {
      setHasNewUpdates(true);
      // Trigger subtle pulse animation when updates are detected
      Animated.sequence([
        Animated.timing(bannerPulse, {
          toValue: 1.05,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(bannerPulse, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses, displayedStatuses]);

  // Helper function to check if status is expired or expiring soon (< 1 minute)
  const isStatusExpiredOrExpiringSoon = (status: ContactStatus | null): boolean => {
    if (!status || !status.endTime) return true;
    const end = new Date(status.endTime);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    return diffMs <= 60000; // Less than 1 minute
  };

  const getTimeRemaining = (endTime: string): string => {
    const end = new Date(endTime);
    const now = new Date(); // Use new Date() directly for accuracy
    const diffMs = end.getTime() - now.getTime();

    // Guard clause: if expired, return empty string (defense-in-depth)
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
      // Exactly X hours: "1 more hour" or "2 more hours"
      if (diffHours === 1) {
        return '1 more hour';
      }
      return `${diffHours} more hours`;
    }

    if (diffMinutes >= 1) {
      // Format: "18 more min"
      return `${diffMinutes} more min`;
    }

    return '<1m';
  };
  
  // Merge contacts with their statuses (use displayedStatuses to keep list frozen until refresh)
  // Memoize to prevent recomputation when statuses (polling) updates
  const contactsWithStatus = useMemo(() => {
    return contacts?.map((contact: any) => {
      const contactId = String(contact.id);
      const isNewOrChanged = newOrChangedContactIdsRef.current.has(contactId);
      const isNewOnly = newOnlyIdsRef.current.has(contactId); // Only truly new items pulse
      return {
        ...contact,
        status: displayedStatuses?.find((s: any) => s.user?.id === contact.id || s.userId === contact.id),
        isNewOrChanged: isNewOrChanged,
        isNewOnly: isNewOnly, // Only truly new items (not just changed)
      };
    }) || [];
  }, [contacts, displayedStatuses]);

  // Filter to only show contacts with active statuses and sort: new/changed first
  // Backend already filters statuses by time window (startTime <= now <= endTime)
  // Memoize to prevent recomputation when statuses (polling) updates
  const activeContacts = useMemo(() => {
    const filtered = contactsWithStatus.filter((contact: any) => contact.status !== undefined);
    // Sort: new/changed items first, then by name
    return filtered.sort((a: any, b: any) => {
      if (a.isNewOrChanged && !b.isNewOrChanged) return -1;
      if (!a.isNewOrChanged && b.isNewOrChanged) return 1;
      // Both same type, sort by name
      const nameA = getFullName(a).toLowerCase();
      const nameB = getFullName(b).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [contactsWithStatus]);

  const handleSaveStatus = () => {
    if (!message.trim() || !location || !endTime) {
      return;
    }
    
    // Map frontend location format to backend enum
    const locationMap: Record<'home' | 'greenspace' | 'third-place', string> = {
      'home': 'HOME',
      'greenspace': 'GREENSPACE',
      'third-place': 'THIRD_PLACE',
    };
    
    const locationValue = locationMap[location];
    console.log('[Activity] Creating status with:', {
      status: AvailabilityStatus.AVAILABLE,
      message: message.trim(),
      location: locationValue,
      startTime: new Date().toISOString(),
      endTime: endTime.toISOString(),
    });
    
    createStatusMutation.mutate({
      status: AvailabilityStatus.AVAILABLE,
      message: message.trim(),
      location: locationValue,
      startTime: new Date().toISOString(), // Current time
      endTime: endTime.toISOString(),
    });
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    // On iOS, only update when user confirms selection (event.type === 'set')
    if (Platform.OS === 'ios') {
      if (event.type === 'set' && selectedDate) {
        setEndTime(roundToNearest15Minutes(selectedDate));
      }
    } else {
      // Android
      if (selectedDate) {
        setEndTime(roundToNearest15Minutes(selectedDate));
      }
    }
  };

  // Check if form is ready to save (message, location, and endTime are set)
  const isFormReady = message.trim().length > 0 && location !== null && endTime !== null;

  // Render separator component between new and existing items
  const renderSeparator = () => {
    return (
      <View style={styles.separatorContainer}>
        <View style={styles.separatorLine} />
        <View style={styles.separatorContent}>
          <Ionicons name="arrow-up" size={14} color="#999" />
          <Text style={styles.separatorText}>new</Text>
        </View>
        <View style={styles.separatorLine} />
      </View>
    );
  };

  // Render update banner component - always visible, text changes based on hasNewUpdates
  const renderUpdateBanner = () => {
    // Always show banner to prevent layout shifts
    return (
      <Animated.View 
        style={[
          styles.updateBanner, 
          { 
            opacity: bannerOpacity,
            transform: [{ scale: bannerPulse }],
          }
        ]}
      >
        <Ionicons name={hasNewUpdates ? "arrow-down" : "radio"} size={16} color="#007AFF" />
        <Text style={styles.updateBannerText}>
          {hasNewUpdates 
            ? "New updates! Pull down to refresh" 
            : "Listening for status updates"}
        </Text>
      </Animated.View>
    );
  };

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <Text>Loading...</Text>
      </View>
    );
  }
  
  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <View style={[styles.headerContainer, { paddingTop: headerPaddingTop }]}>
        <Text style={styles.headerTitle}>Activity</Text>
      </View>
      <Pressable 
        style={styles.statusInputContainer}
        onPress={() => {
          // Populate form with current status if it exists, otherwise reset
          if (storeStatus) {
            setMessage(storeStatus.message);
            setLocation(mapBackendToFrontendLocation(storeStatus.location));
            setEndTime(new Date(storeStatus.endTime));
          } else {
            setMessage('');
            setLocation(null);
            setEndTime(getDefaultEndTime());
          }
          setShowStatusModal(true);
        }}
      >
        <View style={styles.statusInputWrapper}>
          {/* Avatar placeholder with status-aware styling */}
          <View style={[
            styles.avatarContainer,
            (!storeStatus || !currentStatus) 
              ? styles.avatarContainerInactive 
              : (storeStatus.status === AvailabilityStatus.AVAILABLE 
                  ? styles.avatarContainerActive 
                  : styles.avatarContainerInactive)
          ]}>
            <View style={[
              styles.avatar,
              (!storeStatus || !currentStatus) 
                ? { backgroundColor: '#E5E5E5' }
                : { backgroundColor: getAvatarColor() }
            ]}>
              <Text style={styles.avatarText}>{getInitials()}</Text>
            </View>
          </View>
          <TextInput
            style={styles.statusInput}
            placeholder="Whatcha up to?"
            placeholderTextColor="#333"
            editable={false}
            pointerEvents="none"
            value={
              currentStatus && !isStatusExpiredOrExpiringSoon(currentStatus)
                ? `${currentStatus.message}...for ${getTimeRemaining(currentStatus.endTime)}`
                : ''
            }
            numberOfLines={1}
          />
        </View>
      </Pressable>
      <FlatList
        data={activeContacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          // Check if we need to show separator (current item is existing, previous was new/changed)
          const prevItem = activeContacts[index - 1];
          const showSeparator = 
            !item.isNewOrChanged && 
            prevItem?.isNewOrChanged;
          
          return (
            <>
              {showSeparator && renderSeparator()}
              {item.isNewOrChanged ? (
                <AnimatedContactListItem contact={item} />
              ) : (
                <ContactListItem contact={item} />
              )}
            </>
          );
        }}
        ListHeaderComponent={renderUpdateBanner}
        refreshControl={
          <RefreshControl 
            refreshing={isLoading} 
            onRefresh={async () => {
              // Refetch both contacts and statuses
              await Promise.all([
                refetch(),
                refetchStatuses(),
              ]);
              // Wait a moment for React Query to update the statuses variable
              // Then sync displayedStatuses with the updated statuses
              // This is the ONLY place where displayedStatuses should be updated after initial load
              setTimeout(() => {
                if (statuses) {
                  // Detect new or changed statuses before updating
                  const currentStatusIds = new Set(statuses.map((s: any) => s.user?.id || s.userId));
                  const previousStatusIds = new Set(previousDisplayedStatusesRef.current.map((s: any) => s.user?.id || s.userId));
                  
                  // Find new statuses (not in previous) - these will pulse
                  const newStatusIds = new Set<string>(
                    statuses
                      .filter((s: any) => {
                        const statusId = s.user?.id || s.userId;
                        return !previousDisplayedStatusesRef.current.some((prev: any) => {
                          const prevId = prev.user?.id || prev.userId;
                          return prevId === statusId;
                        });
                      })
                      .map((s: any) => String(s.user?.id || s.userId))
                  );
                  
                  // Find changed statuses (same ID but different content) - these won't pulse
                  const changedStatusIds = new Set<string>(
                    statuses
                      .filter((current: any) => {
                        const currentId = current.user?.id || current.userId;
                        const previous = previousDisplayedStatusesRef.current.find((p: any) => {
                          const prevId = p.user?.id || p.userId;
                          return prevId === currentId;
                        });
                        if (!previous) return false;
                        return (
                          previous.message !== current.message ||
                          previous.location !== current.location ||
                          previous.endTime !== current.endTime
                        );
                      })
                      .map((s: any) => String(s.user?.id || s.userId))
                  );
                  
                  // Store all (new + changed) for sorting to top
                  newOrChangedContactIdsRef.current = new Set<string>([
                    ...Array.from(newStatusIds),
                    ...Array.from(changedStatusIds),
                  ]);
                  
                  // Store only new IDs for pulse detection (only truly new items pulse)
                  newOnlyIdsRef.current = newStatusIds;
                  
                  // Configure layout animation for smooth list reordering
                  LayoutAnimation.configureNext({
                    duration: 300,
                    create: {
                      type: LayoutAnimation.Types.easeInEaseOut,
                      property: LayoutAnimation.Properties.opacity,
                    },
                    update: {
                      type: LayoutAnimation.Types.easeInEaseOut,
                    },
                  });
                  
                  // Update displayed statuses
                  setDisplayedStatuses([...statuses]);
                  
                  // Clear the new/changed flags after animation completes
                  setTimeout(() => {
                    newOrChangedContactIdsRef.current.clear();
                    newOnlyIdsRef.current.clear();
                  }, 500);
                  
                  // Update previous ref for next comparison
                  previousDisplayedStatusesRef.current = [...statuses];
                }
                setHasNewUpdates(false);
                // Banner stays visible, just text changes back to "listening"
              }, 50);
            }} 
          />
        }
        ListEmptyComponent={
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 12 }}>
              No contacts are sharing their status, for a better chance of seeing your friends here ,  <Pressable
              onPress={() => {
                router.push('/(tabs)/contacts?openInvite=true');
              }}
            >
              <Text style={{ fontSize: 16, color: '#007AFF', fontWeight: '600' }}>
                invite more
              </Text>
            </Pressable> 
            </Text>
          <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 12 }}>Or lead the way and set yours now</Text>
          </View>
        }
      />
      
      <Modal
        visible={showStatusModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 16 }]}>
            <Pressable onPress={() => setShowStatusModal(false)} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#000" />
            </Pressable>
            <Text style={styles.modalTitle}>Set your status</Text>
            {isFormReady && (
              <Pressable 
                onPress={handleSaveStatus}
                style={styles.checkmarkButton}
                disabled={createStatusMutation.isPending}
              >
                <Ionicons 
                  name="checkmark" 
                  size={28} 
                  color={createStatusMutation.isPending ? "#999" : "#007AFF"} 
                />
              </Pressable>
            )}
            {!isFormReady && <View style={styles.checkmarkButton} />}
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.messageContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Status Message</Text>
                <Text style={styles.requiredIndicator}>Required</Text>
              </View>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Whatcha up to?"
                placeholderTextColor="#333"
                style={[
                  styles.messageInput,
                  !message.trim() && styles.inputIncomplete
                ]}
                multiline
                maxLength={140}
                autoFocus
              />
              <View style={styles.inputFooter}>
                <Text style={styles.helperText}>
                  {!message.trim() ? 'Enter a message to share your status' : ''}
                </Text>
                <Text style={styles.characterCount}>
                  {message.length}/140
                </Text>
              </View>
            </View>

            <View style={styles.locationContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Location</Text>
                <Text style={styles.requiredIndicator}>Required</Text>
              </View>
              <View style={styles.locationSelectorContainer}>
                <Pressable
                  style={[
                    styles.locationOption, 
                    location === 'home' && styles.locationOptionSelected,
                    !location && styles.locationOptionIncomplete
                  ]}
                  onPress={() => setLocation('home')}
                >
                  <Ionicons 
                    name="home-outline" 
                    size={24} 
                    color={location === 'home' ? '#007AFF' : '#666'} 
                  />
                  <Text style={[styles.locationOptionText, location === 'home' && styles.locationOptionTextSelected]}>
                    Home
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.locationOption, 
                    location === 'greenspace' && styles.locationOptionSelected,
                    !location && styles.locationOptionIncomplete
                  ]}
                  onPress={() => setLocation('greenspace')}
                >
                  <Ionicons 
                    name="leaf" 
                    size={24} 
                    color={location === 'greenspace' ? '#007AFF' : '#666'} 
                  />
                  <Text style={[styles.locationOptionText, location === 'greenspace' && styles.locationOptionTextSelected]}>
                    Greenspace
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.locationOption, 
                    location === 'third-place' && styles.locationOptionSelected,
                    !location && styles.locationOptionIncomplete
                  ]}
                  onPress={() => setLocation('third-place')}
                >
                  <Ionicons 
                    name="business" 
                    size={24} 
                    color={location === 'third-place' ? '#007AFF' : '#666'} 
                  />
                  <Text style={[styles.locationOptionText, location === 'third-place' && styles.locationOptionTextSelected]}>
                    Third Place
                  </Text>
                </Pressable>
              </View>
              {!location && (
                <Text style={styles.helperText}>Select where you'll be</Text>
              )}
            </View>

            <View style={styles.timeContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Clear After</Text>
                <Text style={styles.requiredIndicator}>Required</Text>
              </View>
              <View style={styles.timePickerContainer}>
                <Text style={styles.clearAfterButtonText}>
                  Time
                </Text>
                {Platform.OS === 'ios' ? (
                  <DateTimePicker
                    value={endTime || new Date()}
                    mode="time"
                    display="default"
                    minuteInterval={15}
                    onChange={handleTimeChange}
                  />
                ) : (
                  <DateTimePicker
                    value={endTime || new Date()}
                    mode="time"
                    minuteInterval={15}
                    onChange={handleTimeChange}
                  />
                )}
              </View>
              <Text style={styles.helperText}>When should your status automatically clear?</Text>
            </View>

            {/* Clear Status Button */}
            {storeStatus && (
              <View style={styles.clearStatusContainer}>
                <Pressable
                  style={styles.clearStatusButton}
                  onPress={() => {
                    Alert.alert(
                      'Clear Status',
                      'Are you sure you want to clear your current status?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Clear',
                          style: 'destructive',
                          onPress: () => deleteStatusMutation.mutate(),
                        },
                      ]
                    );
                  }}
                  disabled={deleteStatusMutation.isPending}
                >
                  <Text style={styles.clearStatusText}>Clear Status</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
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
  statusInputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statusInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 12,
    borderRadius: 22,
    borderWidth: 2.5,
    padding: 2,
  },
  avatarContainerInactive: {
    borderColor: '#CCCCCC',
  },
  avatarContainerActive: {
    borderColor: '#25D366', // WhatsApp green
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  statusInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    minHeight: 60,
  },
  closeButton: {
    padding: 4,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  checkmarkButton: {
    padding: 4,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  messageContainer: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  requiredIndicator: {
    fontSize: 12,
    color: '#999',
    fontWeight: '400',
  },
  messageInput: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputIncomplete: {
    borderColor: '#ff9500',
    backgroundColor: '#fffbf5',
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
  },
  locationContainer: {
    marginBottom: 28,
  },
  locationSelectorContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  locationOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    gap: 8,
  },
  locationOptionIncomplete: {
    borderColor: '#ff9500',
    backgroundColor: '#fffbf5',
  },
  locationOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  locationOptionText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  locationOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  timeContainer: {
    marginBottom: 20,
  },
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 16,
  },
  clearAfterButtonText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
  clearStatusContainer: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'flex-end',
  },
  clearStatusButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FF3B30',
    backgroundColor: 'transparent',
  },
  clearStatusText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
    gap: 8,
  },
  updateBannerText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  separatorContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  separatorLine: {
    height: 1,
    backgroundColor: '#e0e0e0',
    flex: 1,
  },
  separatorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  separatorText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
});
