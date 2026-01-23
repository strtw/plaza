import { View, FlatList, Text, RefreshControl, ActivityIndicator, StyleSheet, Modal, TextInput, Pressable, ScrollView, Alert, Platform, Animated, LayoutAnimation, UIManager, PanResponder } from 'react-native';
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
const AnimatedContactListItem = ({ contact, previousStatus }: { contact: any; previousStatus?: any }) => {
  // Extract isNew and isUpdated from contact for passing to ContactListItem
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
      <ContactListItem 
        contact={contact}
        isNew={contact.isNew}
        isUpdated={contact.isUpdated}
        previousStatus={previousStatus || contact.previousStatus}
      />
    </Animated.View>
  );
};

// Swipeable wrapper component for contact items with mute action
const SwipeableContactListItem = ({ 
  contact, 
  previousStatus, 
  onMute,
  isNew = false,
  isUpdated = false,
  openRowId,
  setOpenRowId,
}: { 
  contact: any; 
  previousStatus?: any;
  onMute: (contactId: string) => void;
  isNew?: boolean;
  isUpdated?: boolean;
  openRowId: string | null;
  setOpenRowId: (id: string | null) => void;
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const currentTranslateX = useRef(0);
  const SWIPE_THRESHOLD = -60; // Swipe left threshold to reveal
  const ACTION_WIDTH = 80; // Width of the action button
  const isMuted = contact?.friendStatus === 'MUTED';
  const isOpen = openRowId === contact.id;

  // Track current translateX value
  useEffect(() => {
    const listener = translateX.addListener(({ value }) => {
      currentTranslateX.current = value;
    });
    return () => {
      translateX.removeListener(listener);
    };
  }, [translateX]);

  // Close this row if another row is opened
  useEffect(() => {
    if (openRowId && openRowId !== contact.id) {
      currentTranslateX.current = 0;
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    }
  }, [openRowId, contact.id, translateX]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes (more horizontal than vertical)
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderGrant: () => {
        // Stop any ongoing animations
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        // Allow swiping left to reveal or right to hide
        if (gestureState.dx < 0) {
          // Swiping left - reveal action
          const newValue = Math.max(gestureState.dx, -ACTION_WIDTH);
          translateX.setValue(newValue);
          currentTranslateX.current = newValue;
        } else if (gestureState.dx > 0) {
          // Swiping right - hide action (if already open)
          if (currentTranslateX.current < 0) {
            const newValue = Math.min(currentTranslateX.current + gestureState.dx, 0);
            translateX.setValue(newValue);
            currentTranslateX.current = newValue;
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentValue = currentTranslateX.current;
        
        if (gestureState.dx < SWIPE_THRESHOLD || (currentValue < SWIPE_THRESHOLD && gestureState.dx < 0)) {
          // Swipe left enough - reveal action
          setOpenRowId(contact.id);
          Animated.spring(translateX, {
            toValue: -ACTION_WIDTH,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }).start(() => {
            currentTranslateX.current = -ACTION_WIDTH;
          });
        } else {
          // Not enough swipe or swiping right - snap back
          setOpenRowId(null);
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }).start(() => {
            currentTranslateX.current = 0;
          });
        }
      },
    })
  ).current;

  const handleMute = () => {
    onMute(contact.id);
    setOpenRowId(null);
    // Close the swipe after muting
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start(() => {
      currentTranslateX.current = 0;
    });
  };

  return (
    <View style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background action button (always present, revealed by swipe) */}
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: ACTION_WIDTH,
          backgroundColor: isMuted ? '#666' : '#999',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 0,
        }}
      >
        <Pressable
          onPress={handleMute}
          style={{
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons 
            name={isMuted ? "notifications" : "notifications-off"} 
            size={24} 
            color="#fff" 
          />
        </Pressable>
      </View>
      
      {/* Swipeable content */}
      <Animated.View
        style={{
          transform: [{ translateX }],
          backgroundColor: '#fff',
          zIndex: 1,
        }}
        {...panResponder.panHandlers}
      >
        <ContactListItem 
          contact={contact}
          isNew={isNew}
          isUpdated={isUpdated}
          previousStatus={previousStatus}
        />
      </Animated.View>
    </View>
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

// Module-level storage to persist state across component remounts
// This ensures pills persist when navigating back from contact detail screen
const persistentState = {
  displayedStatuses: [] as Array<any>,
  previousDisplayedStatuses: [] as Array<any>,
  hasInitialized: false,
};


function ActivityScreenContent() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const api = createApi(getToken);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentStatus: storeStatus, setCurrentStatus } = useUserStore();
  
  // Track which row is currently swiped open (only one at a time)
  const [openRowId, setOpenRowId] = useState<string | null>(null);

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

  // Check if any friends are muted
  const hasMutedFriends = contacts?.some((c: any) => c.friendStatus === 'MUTED') || false;

  const [showMuted, setShowMuted] = useState(false);

  const { data: statuses, refetch: refetchStatuses } = useQuery({
    queryKey: ['friends-statuses', showMuted],
    queryFn: () => api.getFriendsStatuses(showMuted),
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

  // Mutation for muting a friend
  const muteFriendMutation = useMutation({
    mutationFn: api.muteFriend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', 'friends-statuses'] });
    },
    onError: (error: any) => {
      console.error('Error muting friend:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to mute friend. Please try again.',
        [{ text: 'OK' }]
      );
    },
  });

  // Mutation for unmuting a friend
  const unmuteFriendMutation = useMutation({
    mutationFn: api.unmuteFriend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', 'friends-statuses'] });
    },
    onError: (error: any) => {
      console.error('Error unmuting friend:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to unmute friend. Please try again.',
        [{ text: 'OK' }]
      );
    },
  });

  const handleMuteFriend = (contactId: string) => {
    const contact = contacts?.find((c: any) => c.id === contactId);
    if (contact?.friendStatus === 'MUTED') {
      unmuteFriendMutation.mutate(contactId);
    } else {
      muteFriendMutation.mutate(contactId);
    }
  };

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
  
  /**
   * REFRESH → CLEAR PILLS BEHAVIOR
   * 
   * The "new" and "updated" pills are designed to highlight changes since the last refresh.
   * Each refresh creates a fresh baseline - pills from the previous view disappear, and only
   * items that are NEW or UPDATED since the last refresh get pills.
   * 
   * Flow:
   * 1. Initial load: displayedStatuses is populated, previousDisplayedStatusesRef is empty
   *    → No pills shown (user hasn't seen anything yet to compare against)
   * 
   * 2. Status changes in background: statuses (from polling) updates, but displayedStatuses stays frozen
   *    → Banner shows "New updates! Pull down to refresh"
   * 
   * 3. User pulls to refresh:
   *    a. Refresh handler captures current displayedStatuses as the baseline
   *    b. Updates previousDisplayedStatusesRef with this baseline (what user was seeing)
   *    c. Updates displayedStatuses with fresh data from API
   *    d. contactsWithStatus memo compares new displayedStatuses against previousDisplayedStatusesRef
   *    → Pills appear for items that are NEW (didn't exist) or UPDATED (updatedAt changed)
   * 
   * 4. User pulls to refresh again:
   *    a. Refresh handler captures current displayedStatuses (which now includes items with pills)
   *    b. Updates previousDisplayedStatusesRef with this new baseline
   *    c. Updates displayedStatuses with fresh data
   *    d. contactsWithStatus memo compares new displayedStatuses against previousDisplayedStatusesRef
   *    → Previous pills disappear (those items are now the baseline)
   *    → Only items that are NEW or UPDATED since THIS refresh get pills
   * 
   * Key insight: Each refresh resets the baseline. Items that were already visible and unchanged
   * will NOT get pills because they exist in both the old and new state with the same updatedAt.
   */
  // Track displayed statuses (what user currently sees - frozen until refresh)
  // Initialize displayedStatuses from persistent storage if available (survives remounts)
  const [displayedStatuses, setDisplayedStatuses] = useState<Array<any>>(
    persistentState.hasInitialized ? persistentState.displayedStatuses : []
  );
  // Initialize banner opacity to 1 (always visible) to prevent layout shifts
  const bannerOpacity = useRef(new Animated.Value(1)).current;
  // Pulse animation for when updates are detected
  const bannerPulse = useRef(new Animated.Value(1)).current;
  // Ref to store previous displayedStatuses for comparison (to detect new/updated items)
  // This represents the baseline that the user saw BEFORE the last refresh
  // Updated in refresh handler BEFORE displayedStatuses changes
  const previousDisplayedStatusesRef = useRef<Array<any>>(persistentState.previousDisplayedStatuses);
  const newOrChangedContactIdsRef = useRef<Set<string>>(new Set());
  const newOnlyIdsRef = useRef<Set<string>>(new Set()); // Track only truly new items for pulse
  
  // Enable LayoutAnimation on Android
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  // Initialize displayedStatuses from persistent storage or from statuses
  // This ensures state persists across component remounts (navigation)
  // Also update when showMuted changes to reflect the filtered statuses
  useEffect(() => {
    if (statuses) {
      if (!persistentState.hasInitialized) {
        // First time initialization
        persistentState.displayedStatuses = statuses;
        setDisplayedStatuses(statuses);
        persistentState.hasInitialized = true;
        // Don't set previousDisplayedStatusesRef on initial load - keep it empty
        // This ensures no badges show on first load, only after refresh
      } else {
        // Restore from persistent storage if component remounted
        if (displayedStatuses.length === 0 && persistentState.displayedStatuses.length > 0) {
          setDisplayedStatuses([...persistentState.displayedStatuses]);
        }
        if (previousDisplayedStatusesRef.current.length === 0 && persistentState.previousDisplayedStatuses.length > 0) {
          previousDisplayedStatusesRef.current = [...persistentState.previousDisplayedStatuses];
        }
        // If displayedStatuses is empty but statuses has data, update it (first time statuses appear)
        // This handles the case where component mounted before statuses existed
        if (displayedStatuses.length === 0 && statuses.length > 0) {
          persistentState.displayedStatuses = statuses;
          setDisplayedStatuses(statuses);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses]);

  // Note: We don't update displayedStatuses when showMuted changes
  // Instead, we filter in the contactsWithStatus memo based on showMuted
  // This prevents false "new updates" detection when toggling the filter

  // Keep persistent storage in sync with state
  useEffect(() => {
    if (displayedStatuses.length > 0) {
      persistentState.displayedStatuses = displayedStatuses;
    }
    if (previousDisplayedStatusesRef.current.length > 0) {
      persistentState.previousDisplayedStatuses = previousDisplayedStatusesRef.current;
    }
  }, [displayedStatuses]);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Detect status changes to show "New updates" indicator
  // Compare current statuses (from polling) with displayedStatuses (what user sees)
  // Only trigger when there are actual new/updated statuses, not filter changes
  useEffect(() => {
    if (!statuses || displayedStatuses.length === 0) {
      // If no displayed statuses yet, don't show banner
      setHasNewUpdates(false);
      return;
    }

    // Filter statuses based on showMuted to compare apples-to-apples
    // This ensures we only detect real changes, not filter changes
    const filteredStatuses = showMuted 
      ? statuses 
      : statuses.filter((s: any) => {
          const contact = contacts?.find((c: any) => c.id === s.user?.id || c.id === s.userId);
          return contact?.friendStatus !== 'MUTED';
        });
    
    const filteredDisplayedStatuses = showMuted
      ? displayedStatuses
      : displayedStatuses.filter((s: any) => {
          const contact = contacts?.find((c: any) => c.id === s.user?.id || c.id === s.userId);
          return contact?.friendStatus !== 'MUTED';
        });

    // Compare filtered current statuses with filtered displayed statuses
    const currentStatusIds = new Set(filteredStatuses.map((s: any) => s.id));
    const displayedStatusIds = new Set(filteredDisplayedStatuses.map((s: any) => s.id));

    // Check for new or removed statuses
    const hasNewStatuses = filteredStatuses.some((s: any) => !displayedStatusIds.has(s.id));
    const hasRemovedStatuses = filteredDisplayedStatuses.some(
      (s: any) => !currentStatusIds.has(s.id)
    );

    // Check for updated statuses (same ID but different content)
    const hasUpdatedStatuses = filteredStatuses.some((current: any) => {
      const displayed = filteredDisplayedStatuses.find((d: any) => d.id === current.id);
      if (!displayed) return false;
      return (
        displayed.message !== current.message ||
        displayed.location !== current.location ||
        displayed.endTime !== current.endTime ||
        displayed.updatedAt !== current.updatedAt
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
    } else {
      // No actual changes detected, hide banner
      setHasNewUpdates(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses, displayedStatuses, showMuted, contacts]);

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
  
  // Restore previousDisplayedStatusesRef BEFORE calculating contactsWithStatus to ensure pills persist
  // This ensures the ref is restored synchronously before the memo runs (refs can be updated synchronously)
  // CRITICAL: Pills are ONLY cleared when user pulls to refresh (refresh handler updates previousDisplayedStatusesRef)
  // Use persistent storage that survives component remounts
  if (persistentState.hasInitialized) {
    if (previousDisplayedStatusesRef.current.length === 0 && persistentState.previousDisplayedStatuses.length > 0) {
      // Restore synchronously - refs can be updated during render
      previousDisplayedStatusesRef.current = [...persistentState.previousDisplayedStatuses];
    }
  }

  // Merge contacts with their statuses (use displayedStatuses to keep list frozen until refresh)
  // Memoize to prevent recomputation when statuses (polling) updates
  // Filter based on showMuted here instead of updating displayedStatuses
  const contactsWithStatus = useMemo(() => {
    // Filter displayedStatuses based on showMuted
    const filteredDisplayedStatuses = showMuted
      ? displayedStatuses
      : displayedStatuses.filter((s: any) => {
          const contact = contacts?.find((c: any) => c.id === s.user?.id || c.id === s.userId);
          return contact?.friendStatus !== 'MUTED';
        });
    
    // Check if we have previous state to compare against (not on initial load)
    // On initial load: previousDisplayedStatusesRef is empty → no pills shown (user hasn't seen anything yet)
    // After first refresh: previousDisplayedStatusesRef contains the baseline → comparison starts working
    // CRITICAL: Pills are ONLY cleared when user pulls to refresh (refresh handler updates previousDisplayedStatusesRef)
    const hasPreviousState = previousDisplayedStatusesRef.current.length > 0;
    
    // Map previous statuses by status.id (stable after backend UPDATE change)
    // This represents what the user saw BEFORE the last refresh
    // Use previousDisplayedStatusesRef which is updated in refresh handler BEFORE displayedStatuses changes
    const previousStatusMap = hasPreviousState
      ? new Map(previousDisplayedStatusesRef.current.map((s: any) => {
          if (!s.id) {
            console.warn('[Activity] Previous status missing id:', s);
          }
          return [s.id, s];
        }))
      : new Map();

    return contacts?.map((contact: any) => {
      const contactId = String(contact.id);
      // Use filtered displayedStatuses to respect showMuted toggle
      const status = filteredDisplayedStatuses?.find((s: any) => s.user?.id === contact.id || s.userId === contact.id);
      
      // Determine if new or updated (only if we have previous state to compare against)
      // This logic ensures pills only show for items that changed since the last refresh
      let isNew = false;
      let isUpdated = false;
      
      if (hasPreviousState && status) {
        // Debug: Log status structure
        if (!status.id) {
          console.warn('[Activity] Status missing id field:', status);
        }
        if (!status.updatedAt) {
          console.warn('[Activity] Status missing updatedAt field:', status);
        }
        
        // Compare current status against previous baseline
        const previousStatus = previousStatusMap.get(status.id);
        
        // isNew = true: Status ID doesn't exist in previous baseline (truly new status)
        // This means the user hasn't seen this status before the last refresh
        isNew = !previousStatus;
        
        // isUpdated = true: Status ID exists in previous baseline BUT updatedAt changed
        // This means the user saw this status before, but it was modified since the last refresh
        isUpdated = previousStatus !== undefined && 
          previousStatus.updatedAt !== status.updatedAt;
        
        // If both are false: Status exists in previous AND updatedAt is the same
        // This means the status is unchanged → NO PILL (user has already seen it)
      }
      
      // Keep existing flags for sorting/animations
      const isNewOrChanged = newOrChangedContactIdsRef.current.has(contactId);
      const isNewOnly = newOnlyIdsRef.current.has(contactId);
      
      // Get previous status for comparison (only if updated)
      const previousStatus = hasPreviousState && status && isUpdated
        ? previousStatusMap.get(status.id)
        : undefined;

      const result = {
        ...contact,
        status,
        isNewOrChanged,
        isNewOnly,
        isNew, // For pill display
        isUpdated, // For pill display
        previousStatus, // Previous status data for comparison display
      };
      
      return result;
    }) || [];
  }, [contacts, displayedStatuses, showMuted]);

  // Filter to only show contacts with active statuses and sort: NEW first, then UPDATED, then unchanged
  // Backend already filters statuses by time window (startTime <= now <= endTime)
  // Memoize to prevent recomputation when statuses (polling) updates
  const activeContacts = useMemo(() => {
    const filtered = contactsWithStatus.filter((contact: any) => contact.status !== undefined);
    // Sort: NEW items first, then UPDATED items, then unchanged, then by name
    return filtered.sort((a: any, b: any) => {
      // NEW items first
      if (a.isNew && !b.isNew) return -1;
      if (!a.isNew && b.isNew) return 1;
      
      // UPDATED items second (isUpdated but not isNew)
      if (a.isUpdated && !a.isNew && !b.isUpdated) return -1;
      if (!a.isUpdated && b.isUpdated && !b.isNew) return 1;
      
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
    
    // Get all friend IDs for sharedWith (for now, share with all friends)
    // TODO: Add UI for selecting specific recipients
    const friendIds = contacts?.map((c: any) => c.id).filter(Boolean) || [];
    
    console.log('[Activity] Creating status with:', {
      status: AvailabilityStatus.AVAILABLE,
      message: message.trim(),
      location: locationValue,
      startTime: new Date().toISOString(),
      endTime: endTime.toISOString(),
      sharedWith: friendIds,
    });
    
    createStatusMutation.mutate({
      status: AvailabilityStatus.AVAILABLE,
      message: message.trim(),
      location: locationValue,
      startTime: new Date().toISOString(), // Current time
      endTime: endTime.toISOString(),
      sharedWith: friendIds, // Share with all friends by default
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
        {hasMutedFriends && (
          <Pressable
            onPress={() => setShowMuted(!showMuted)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: showMuted ? '#007AFF' : '#E5E5E5',
            }}
          >
            <Text style={{ color: showMuted ? '#fff' : '#666', fontSize: 14, fontWeight: '500' }}>
              {showMuted ? 'Hide muted' : 'Show everyone'}
            </Text>
          </Pressable>
        )}
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
        renderItem={({ item }) => {
          // Wrap AnimatedContactListItem in SwipeableContactListItem for swipe functionality
          if (item.isNewOrChanged) {
            return (
              <SwipeableContactListItem 
                contact={item} 
                isNew={item.isNew}
                isUpdated={item.isUpdated}
                previousStatus={item.previousStatus || item.previousStatus}
                onMute={handleMuteFriend}
                openRowId={openRowId}
                setOpenRowId={setOpenRowId}
              />
            );
          }
          return (
            <SwipeableContactListItem 
              contact={item} 
              isNew={item.isNew}
              isUpdated={item.isUpdated}
              previousStatus={item.previousStatus}
              onMute={handleMuteFriend}
              openRowId={openRowId}
              setOpenRowId={setOpenRowId}
            />
          );
        }}
        ListHeaderComponent={renderUpdateBanner}
        refreshControl={
          <RefreshControl 
            refreshing={isLoading} 
            onRefresh={async () => {
              // CRITICAL: Capture the CURRENT displayedStatuses (what user is seeing) as the baseline
              // This represents the state BEFORE refresh - items the user has already seen
              // Do this BEFORE refetching to ensure we capture the correct baseline
              const currentDisplayed = displayedStatuses.length > 0 ? displayedStatuses : [];
              
              // Refetch both contacts and statuses
              const [contactsResult, statusesResult] = await Promise.all([
                refetch(),
                refetchStatuses(),
              ]);
              
              // Get the fresh statuses from the query result
              const freshStatuses = statusesResult.data || statuses || [];
              
              if (freshStatuses.length > 0 || currentDisplayed.length > 0) {
                // Map previous statuses by status.id (stable after backend UPDATE change)
                // This map is used to identify which items are new vs updated vs unchanged
                const previousStatusMap = new Map(
                  currentDisplayed.map((s: any) => [s.id, s])
                );
                
                // Find new statuses (status.id doesn't exist in previous) - these will pulse
                const newStatusIds = new Set<string>(
                  freshStatuses
                    .filter((s: any) => !previousStatusMap.has(s.id))
                    .map((s: any) => String(s.user?.id || s.userId))
                );
                
                // Find changed statuses (same status.id but updatedAt changed) - these will also pulse
                const changedStatusIds = new Set<string>(
                  freshStatuses
                    .filter((current: any) => {
                      const previous = previousStatusMap.get(current.id);
                      if (!previous) return false;
                      return previous.updatedAt !== current.updatedAt;
                    })
                    .map((s: any) => String(s.user?.id || s.userId))
                );
                
                // Store all (new + changed) for sorting to top and animations
                newOrChangedContactIdsRef.current = new Set<string>([
                  ...Array.from(newStatusIds),
                  ...Array.from(changedStatusIds),
                ]);
                
                // Store only new (not changed) for pulse animation
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
                
                // CRITICAL: Update previousDisplayedStatusesRef BEFORE updating displayedStatuses
                // This ensures the baseline is set correctly for the next comparison
                previousDisplayedStatusesRef.current = [...currentDisplayed];
                persistentState.previousDisplayedStatuses = [...currentDisplayed];
                
                // Now update displayedStatuses with fresh data from API
                // This becomes the new "frozen" state until next refresh
                setDisplayedStatuses(freshStatuses);
                persistentState.displayedStatuses = freshStatuses;
              }
              
              // Clear the "new updates" banner after refresh
              setHasNewUpdates(false);
            }} 
          />
        }
        ListEmptyComponent={
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 12 }}>
              No friends are sharing their current status, the more you invite the more activity you'll see! <Pressable
              onPress={() => {
                router.push('/(tabs)/contacts?openInvite=true');
              }}
            >
              <Text style={{ fontSize: 16, color: '#007AFF', fontWeight: '600' }}>
                Send Invites
              </Text>
            </Pressable> 
            </Text>
          <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 12 }}>Or share your current status</Text>
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
});
