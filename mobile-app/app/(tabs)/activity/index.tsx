import { View, FlatList, Text, RefreshControl, ActivityIndicator, StyleSheet, Modal, TextInput, Pressable, ScrollView, Alert, Platform, Animated, Easing, LayoutAnimation, UIManager, PanResponder, Switch } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createApi } from '../../../lib/api';
import { ContactListItem } from '../../../components/ContactListItem';
import { AvailabilityStatus, StatusLocation, ContactStatus, getFullName } from '../../../lib/types';
import { useAuth } from '@clerk/clerk-expo';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState, useRef, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '../../../stores/userStore';
import { HamburgerMenu } from '../../../components/HamburgerMenu';

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
  locallyMutedContacts,
}: { 
  contact: any; 
  previousStatus?: any;
  onMute: (contactId: string) => void;
  isNew?: boolean;
  isUpdated?: boolean;
  openRowId: string | null;
  setOpenRowId: (id: string | null) => void;
  locallyMutedContacts: Set<string>;
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const currentTranslateX = useRef(0);
  const SWIPE_THRESHOLD = -60; // Swipe left threshold to reveal
  const ACTION_WIDTH = 80; // Width of the action button
  // Check both friendStatus and locallyMutedContacts for immediate UI updates
  const isMuted = contact?.friendStatus === 'MUTED' || locallyMutedContacts.has(contact.id);
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
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
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
              name={isMuted ? "eye-off" : "eye"} 
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
          statusState={contact.statusState}
          textFadeAnim={contact.textFadeAnim}
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
  
  // Track status state: 'active' | 'expired' | 'cleared' | null
  // 'expired': Status expired naturally (endTime passed)
  // 'cleared': User manually cleared the status
  // 'active': Status is active and valid
  // null: No status
  const [statusState, setStatusState] = useState<'active' | 'expired' | 'cleared' | null>(null);
  
  // Fade-to-gray animation for when status expires/clears (opacity transition)
  const statusGrayAnim = useRef(new Animated.Value(1)).current;
  
  // Track which row is currently swiped open (only one at a time)
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  // Track locally muted contacts for immediate UI updates (before query refetch)
  const [locallyMutedContacts, setLocallyMutedContacts] = useState<Set<string>>(new Set());

  // Set-status is now a route; no modal state here

  // All hooks must be called before any conditional returns
  const { data: contacts, isLoading, refetch } = useQuery({
    queryKey: ['contacts'],
    queryFn: api.getContacts,
    enabled: isLoaded && isSignedIn,
  });

  // Check if any friends are muted
  const hasMutedFriends = contacts?.some((c: any) => c.friendStatus === 'MUTED') || false;

  const [showMuted, setShowMuted] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [tempShowMuted, setTempShowMuted] = useState(false);
  
  // Location filter: Set of selected locations (empty = all locations)
  // Default to all locations selected
  const [selectedLocations, setSelectedLocations] = useState<Set<StatusLocation>>(
    new Set([StatusLocation.HOME, StatusLocation.GREENSPACE, StatusLocation.THIRD_PLACE])
  );
  const [tempSelectedLocations, setTempSelectedLocations] = useState<Set<StatusLocation>>(
    new Set([StatusLocation.HOME, StatusLocation.GREENSPACE, StatusLocation.THIRD_PLACE])
  );
  
  // Duration filter: minimum minutes remaining (0 = no filter)
  const [minDurationMinutes, setMinDurationMinutes] = useState<number>(0);
  const [tempMinDurationMinutes, setTempMinDurationMinutes] = useState<number>(0);

  // Persisted filter preferences (loaded from backend on mount)
  const { data: preferences } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: api.getPreferences,
    enabled: isLoaded && isSignedIn,
  });
  const hasInitializedFromPreferences = useRef(false);
  useEffect(() => {
    if (!preferences || hasInitializedFromPreferences.current) return;
    const validLocations = [StatusLocation.HOME, StatusLocation.GREENSPACE, StatusLocation.THIRD_PLACE];
    const locations = (preferences.selectedLocations || []).filter((l: string) =>
      validLocations.includes(l as StatusLocation)
    );
    setShowMuted(preferences.showMuted ?? false);
    setSelectedLocations(locations.length > 0 ? new Set(locations as StatusLocation[]) : new Set(validLocations));
    setMinDurationMinutes(Math.max(0, preferences.minDurationMinutes ?? 0));
    hasInitializedFromPreferences.current = true;
  }, [preferences]);

  const updatePreferencesMutation = useMutation({
    mutationFn: (data: { showMuted: boolean; selectedLocations: string[]; minDurationMinutes: number }) =>
      api.updatePreferences(data),
    onSuccess: (data) => {
      setShowMuted(data.showMuted);
      setSelectedLocations(new Set((data.selectedLocations || []) as StatusLocation[]));
      setMinDurationMinutes(data.minDurationMinutes ?? 0);
      queryClient.setQueryData(['user-preferences'], data);
      setShowFiltersModal(false);
    },
  });

  // Always fetch all statuses (accepted + muted) - filtering is frontend-only
  const { data: statuses, refetch: refetchStatuses } = useQuery({
    queryKey: ['friends-statuses'], // Remove showMuted from query key to prevent refetches on filter toggle
    queryFn: () => api.getFriendsStatuses(), // Backend always returns all accepted and muted users
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
      setStatusState('active'); // Status is active
    } else if (currentStatus && isStatusExpiredOrExpiringSoon(currentStatus)) {
      // Status exists but is expired - keep it for display but mark as expired
      // Only update if we don't already have an expired/cleared state (preserve user's cleared state)
      if (statusState !== 'cleared') {
        setCurrentStatus(currentStatus);
        setStatusState('expired');
      }
    } else {
      // No status from API - if status was cleared, reset state to allow setting new status
      // If status was expired, keep it for display until refresh
      if (statusState === 'cleared') {
        // After successful clear, API confirms no status exists - reset to allow new status
        setCurrentStatus(null);
        setStatusState(null);
      } else if (statusState === null || statusState === 'active') {
        setCurrentStatus(null);
        setStatusState(null);
      }
      // If statusState is 'expired', keep the storeStatus for display
    }
  }, [currentStatus, setCurrentStatus, statusState]);

  // Timer effect to detect expired status (checks every 10 seconds)
  // When expired, set statusState to 'expired' but keep status data for display
  // Also trigger fade-to-gray animation
  useEffect(() => {
    if (!storeStatus || !storeStatus.endTime) return;
    
    const checkExpiration = () => {
      const now = new Date();
      const end = new Date(storeStatus.endTime);
      if (end.getTime() <= now.getTime() && statusState === 'active') {
        // Status just expired - mark as expired but keep data for display
        setStatusState('expired');
        // Also update query cache to null so API doesn't return expired status
        queryClient.setQueryData(['my-status'], null);
        // Trigger fade-to-gray animation with smooth easing
        Animated.timing(statusGrayAnim, {
          toValue: 0.6,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      }
    };
    
    // Check immediately
    checkExpiration();
    
    // Then check every 10 seconds
    const interval = setInterval(checkExpiration, 10000);
    return () => clearInterval(interval);
  }, [storeStatus, statusState, queryClient, statusGrayAnim]);

  // createStatusMutation and deleteStatusMutation live in set-status screen

  // Mutation for muting a friend
  const muteFriendMutation = useMutation({
    mutationFn: api.muteFriend,
    onSuccess: (_, contactId) => {
      // Configure layout animation for smooth row removal
      LayoutAnimation.configureNext({
        duration: 300,
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
        },
        delete: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
      });
      
      // Immediately update local state to hide the contact
      setLocallyMutedContacts(prev => new Set(prev).add(contactId));
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
    onSuccess: (_, contactId) => {
      // Configure layout animation for smooth row insertion
      LayoutAnimation.configureNext({
        duration: 300,
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
        },
        delete: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
      });
      
      // Immediately update local state to show the contact
      setLocallyMutedContacts(prev => {
        const next = new Set(prev);
        next.delete(contactId);
        return next;
      });
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
    // Check both the contact's friendStatus and local state
    const isMuted = contact?.friendStatus === 'MUTED' || locallyMutedContacts.has(contactId);
    
    if (isMuted) {
      unmuteFriendMutation.mutate(contactId);
    } else {
      muteFriendMutation.mutate(contactId);
    }
  };
  
  // Sync locallyMutedContacts with contacts data when it updates
  useEffect(() => {
    if (contacts) {
      // Update local state to match contacts data (in case of external changes)
      const mutedContactIds = contacts
        .filter((c: any) => c.friendStatus === 'MUTED')
        .map((c: any) => c.id);
      setLocallyMutedContacts(new Set(mutedContactIds));
    }
  }, [contacts]);

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
  // Track which status IDs are expired or cleared (for grayed-out display)
  // Map: statusId -> 'expired' | 'cleared' | null
  const [expiredOrClearedStatuses, setExpiredOrClearedStatuses] = useState<Map<string, 'expired' | 'cleared'>>(new Map());
  // Initialize banner opacity to 1 (always visible) to prevent layout shifts
  const bannerOpacity = useRef(new Animated.Value(1)).current;
  // Pulse animation for when updates are detected
  const bannerPulse = useRef(new Animated.Value(1)).current;
  // Fade-out animation for expired/cleared status
  const statusFadeAnim = useRef(new Animated.Value(1)).current;
  // Fade-out animations for individual expired/cleared friend statuses
  const friendStatusFadeAnims = useRef<Map<string, Animated.Value>>(new Map()).current;
  // Fade-to-gray animations for friend statuses (opacity transition when expired/cleared)
  const friendStatusGrayAnims = useRef<Map<string, Animated.Value>>(new Map()).current;
  // Animation refs for text fade when statuses are cleared (original text fades out, cleared message fades in)
  const friendStatusTextFadeAnims = useRef<Map<string, Animated.Value>>(new Map()).current;
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

  // Update current time every minute (for time remaining display)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Simple expiration detection: check every 30 seconds for expired statuses
  // Statuses can show as normal for up to 1 minute after expiration, then update to "expired"
  // This is much simpler and scales efficiently to 100+ statuses
  useEffect(() => {
    if (!displayedStatuses.length) return;

    const checkExpiration = () => {
      const now = new Date();
      const updatedExpiredOrCleared = new Map(expiredOrClearedStatuses);
      let hasChanges = false;

      displayedStatuses.forEach((displayedStatus: any) => {
        if (!displayedStatus.id || !displayedStatus.endTime) return;
        
        // Skip if already expired/cleared
        if (expiredOrClearedStatuses.has(displayedStatus.id)) {
          return;
        }

        const end = new Date(displayedStatus.endTime);
        // Check if status has expired (endTime has passed)
        if (end.getTime() <= now.getTime()) {
          // Status expired - mark it as expired
          updatedExpiredOrCleared.set(displayedStatus.id, 'expired');
          hasChanges = true;
        }
      });

      if (hasChanges) {
        // Update state and trigger animations for newly expired statuses
        const newlyExpired = new Set<string>();
        updatedExpiredOrCleared.forEach((state, id) => {
          if (!expiredOrClearedStatuses.has(id) && state === 'expired') {
            newlyExpired.add(id);
          }
        });

        newlyExpired.forEach((statusId) => {
          let grayAnim = friendStatusGrayAnims.get(statusId);
          if (!grayAnim) {
            grayAnim = new Animated.Value(1);
            friendStatusGrayAnims.set(statusId, grayAnim);
          }
          Animated.timing(grayAnim, {
            toValue: 0.6,
            duration: 300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }).start();
        });

        setExpiredOrClearedStatuses(updatedExpiredOrCleared);
      }
    };

    // Check immediately, then every 30 seconds
    // This ensures expired statuses are detected within 1 minute of expiration
    checkExpiration();
    const interval = setInterval(checkExpiration, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [displayedStatuses, expiredOrClearedStatuses]);

  // Detect when friend statuses are cleared (via polling)
  // Expiration is handled by per-status timers above
  useEffect(() => {
    if (!statuses || !displayedStatuses.length) return;

    const updatedExpiredOrCleared = new Map(expiredOrClearedStatuses);

    // Check each displayed status for clearance
    displayedStatuses.forEach((displayedStatus: any) => {
      if (!displayedStatus.id) return;

      // Check if status was cleared (no longer exists in fresh statuses)
      // Only check if not already expired (expired takes precedence)
      if (!updatedExpiredOrCleared.has(displayedStatus.id) || updatedExpiredOrCleared.get(displayedStatus.id) !== 'expired') {
        const stillExists = statuses.some((s: any) => s.id === displayedStatus.id);
        if (!stillExists && displayedStatus.endTime) {
          // Status was cleared - mark as cleared if not already marked
          if (!updatedExpiredOrCleared.has(displayedStatus.id)) {
            updatedExpiredOrCleared.set(displayedStatus.id, 'cleared');
          }
        }
      }
    });

    // Update state if anything changed and trigger fade-to-gray animations
    const newlyCleared = new Set<string>();
    updatedExpiredOrCleared.forEach((state, id) => {
      if (!expiredOrClearedStatuses.has(id) && state === 'cleared') {
        newlyCleared.add(id);
      }
    });

    // Trigger fade-to-gray animation for newly cleared statuses
    newlyCleared.forEach((statusId) => {
      let grayAnim = friendStatusGrayAnims.get(statusId);
      if (!grayAnim) {
        grayAnim = new Animated.Value(1);
        friendStatusGrayAnims.set(statusId, grayAnim);
      }
      // Fade to gray (opacity 1 → 0.6) over 300ms with smooth easing
      Animated.timing(grayAnim, {
        toValue: 0.6,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        // After gray animation completes, fade text transition
        let textFadeAnim = friendStatusTextFadeAnims.get(statusId);
        if (!textFadeAnim) {
          textFadeAnim = new Animated.Value(1); // Start at 1 (original text visible)
          friendStatusTextFadeAnims.set(statusId, textFadeAnim);
        }
        // Fade out original text (1 → 0) over 200ms, then cleared message will fade in
        Animated.timing(textFadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    });

    // Update state if anything changed
    if (updatedExpiredOrCleared.size !== expiredOrClearedStatuses.size ||
        Array.from(updatedExpiredOrCleared.entries()).some(([id, state]) => 
          expiredOrClearedStatuses.get(id) !== state
        )) {
      setExpiredOrClearedStatuses(updatedExpiredOrCleared);
    }
  }, [statuses, displayedStatuses, expiredOrClearedStatuses]);

  // Detect status changes to show "New updates" indicator
  // Requirements:
  // - If showMuted is false: only ACCEPTED friends' updates trigger banner
  // - If showMuted is true: ANY friend's (MUTED or ACCEPTED) updates trigger banner
  // - Expired statuses should NOT trigger banner
  useEffect(() => {
    // Don't run comparison on first load - wait until displayedStatuses is initialized
    if (!persistentState.hasInitialized) {
      setHasNewUpdates(false);
      return;
    }

    if (!statuses || displayedStatuses.length === 0) {
      setHasNewUpdates(false);
      return;
    }

    // Helper to check if status is expired
    const isExpired = (s: any): boolean => {
      if (!s || !s.endTime) return true;
      const end = new Date(s.endTime);
      const now = new Date();
      return end.getTime() <= now.getTime();
    };

    // Filter out expired statuses from both current and displayed
    const activeStatuses = statuses.filter((s: any) => !isExpired(s));
    const activeDisplayedStatuses = displayedStatuses.filter((s: any) => !isExpired(s));

    // Filter based on showMuted and friendStatus
    // When showMuted is false: only check ACCEPTED friends (not MUTED)
    // When showMuted is true: check ALL friends (MUTED and ACCEPTED)
    const visibleStatuses = activeStatuses.filter((s: any) => {
      const contact = contacts?.find((c: any) => c.id === s.user?.id || c.id === s.userId);
      if (!contact) return false;
      // If showMuted is false, only include ACCEPTED friends (exclude MUTED)
      if (!showMuted && contact.friendStatus === 'MUTED') return false;
      // If showMuted is true, include all friends (MUTED and ACCEPTED)
      return true;
    });
    
    const visibleDisplayedStatuses = activeDisplayedStatuses.filter((s: any) => {
      const contact = contacts?.find((c: any) => c.id === s.user?.id || c.id === s.userId);
      if (!contact) return false;
      // If showMuted is false, only include ACCEPTED friends (exclude MUTED)
      if (!showMuted && contact.friendStatus === 'MUTED') return false;
      // If showMuted is true, include all friends (MUTED and ACCEPTED)
      return true;
    });

    // Compare filtered statuses to detect actual changes
    const currentStatusIds = new Set(visibleStatuses.map((s: any) => s.id));
    const displayedStatusIds = new Set(visibleDisplayedStatuses.map((s: any) => s.id));

    // Check for new or removed statuses (using filtered lists)
    const hasNewStatuses = visibleStatuses.some((s: any) => !displayedStatusIds.has(s.id));
    const hasRemovedStatuses = visibleDisplayedStatuses.some(
      (s: any) => !currentStatusIds.has(s.id)
    );

    // Check for updated statuses (same ID but different content) - using filtered lists
    const hasUpdatedStatuses = visibleStatuses.some((current: any) => {
      const displayed = visibleDisplayedStatuses.find((d: any) => d.id === current.id);
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
    // Always use ALL displayedStatuses - don't filter here based on showMuted
    // Filtering based on showMuted happens later in activeContacts
    // This ensures muted contacts always get their statuses assigned
    const allDisplayedStatuses = displayedStatuses;
    
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

    const result = contacts?.map((contact: any) => {
      const contactId = String(contact.id);
      // Always use all displayedStatuses to find status (don't filter here)
      const status = allDisplayedStatuses?.find((s: any) => s.user?.id === contact.id || s.userId === contact.id);
      
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

      // Check if this status is expired or cleared
      const statusState = status ? expiredOrClearedStatuses.get(status.id) : null;

      const result = {
        ...contact,
        status,
        statusState, // 'expired' | 'cleared' | null
        isNewOrChanged,
        isNewOnly,
        isNew, // For pill display
        isUpdated, // For pill display
        previousStatus, // Previous status data for comparison display
      };
      
      return result;
    }) || [];
    return result;
  }, [contacts, displayedStatuses, Array.from(expiredOrClearedStatuses.entries())]); // Include expiredOrClearedStatuses so statusState updates trigger re-render

  // Filter to only show contacts with active statuses and sort: NEW first, then UPDATED, then unchanged
  // Backend already filters statuses by time window (startTime <= now <= endTime)
  // Memoize to prevent recomputation when statuses (polling) updates
  const activeContacts = useMemo(() => {
    const filtered = contactsWithStatus.filter((contact: any) => {
      // Must have a status
      if (!contact.status) {
        return false;
      }
      
      // Check if contact is muted (either from friendStatus or local state)
      // Note: Backend returns friendStatus as 'MUTED', 'ACCEPTED', 'PENDING', or 'BLOCKED'
      const isMuted = contact.friendStatus === 'MUTED' || locallyMutedContacts.has(contact.id);
      
      // When showMuted is false, we're in "Hide muted" mode - filter out muted users
      // When showMuted is true, we're in "Show everyone" mode - show all users including muted
      if (isMuted && !showMuted) {
        return false;
      }
      
      // Location filter: if locations are selected, only show statuses with those locations
      // If all locations are selected (size === 3), show all (no filter)
      // If some locations are selected (0 < size < 3), filter by those
      // If no locations are selected (size === 0), show all (no filter)
      if (selectedLocations.size > 0 && selectedLocations.size < 3) {
        if (!selectedLocations.has(contact.status.location)) {
          return false;
        }
      }
      
      // Duration filter: only show statuses with at least minDurationMinutes remaining
      if (minDurationMinutes > 0 && contact.status.endTime) {
        const now = new Date();
        const end = new Date(contact.status.endTime);
        const diffMs = end.getTime() - now.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);
        
        if (diffMinutes < minDurationMinutes) {
          return false;
        }
      }
      
      return true;
    });
    
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
  }, [contactsWithStatus, locallyMutedContacts, showMuted, selectedLocations, minDurationMinutes]);

  // Check if there are statuses that exist but are being filtered out
  const hasFilteredStatuses = useMemo(() => {
    // Check if there are any contacts with statuses
    const hasAnyStatuses = contactsWithStatus.some((contact: any) => contact.status);
    // If there are statuses but no active contacts, they're being filtered out
    return hasAnyStatuses && activeContacts.length === 0;
  }, [contactsWithStatus, activeContacts]);

  // Render update banner component - hide when filters are hiding all users
  const renderUpdateBanner = () => {
    // Hide banner when all users are filtered out
    if (hasFilteredStatuses) {
      return null;
    }
    
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
            : "Listening for updates"}
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
        <HamburgerMenu />
        <Text style={styles.headerTitle}>Activity</Text>
        <Pressable
          onPress={() => {
            setTempShowMuted(showMuted);
            setTempSelectedLocations(new Set(selectedLocations));
            setTempMinDurationMinutes(minDurationMinutes);
            setShowFiltersModal(true);
          }}
          style={styles.filterButton}
        >
          <Ionicons name="filter" size={24} color="#007AFF" />
        </Pressable>
      </View>
      <Animated.View style={{ opacity: Animated.multiply(statusFadeAnim, statusGrayAnim) }}>
        <Pressable
          style={[
            styles.myStatusRowContainer,
            (statusState === 'expired' || statusState === 'cleared') && styles.myStatusRowContainerDisabled
          ]}
          onPress={() => router.push('/(tabs)/activity/set-status')}
        >
          <View style={styles.myStatusRowAvatarContainer}>
            <View style={[
              styles.myStatusRowAvatar,
              (statusState === 'expired' || statusState === 'cleared')
                ? styles.avatarDisabled
                : { backgroundColor: '#E5E5E5' }
            ]}>
              <Text style={[
                styles.avatarText,
                (statusState === 'expired' || statusState === 'cleared') && styles.avatarTextDisabled
              ]}>{getInitials()}</Text>
            </View>
          </View>
          <View style={styles.myStatusRowContent}>
            <View style={styles.myStatusRowNameRow}>
              <View style={styles.myStatusRowNameAndStatus}>
                <Text style={[
                  styles.myStatusRowName,
                  (statusState === 'expired' || statusState === 'cleared') && styles.myStatusRowNameDisabled
                ]} numberOfLines={1}>You</Text>
                <View style={styles.myStatusRowMessageRow}>
                  <Text style={[
                    styles.myStatusRowMessage,
                    (statusState === 'expired' || statusState === 'cleared') && styles.myStatusRowMessageDisabled
                  ]} numberOfLines={1}>
                    {statusState === 'cleared'
                      ? 'Status cleared by user'
                      : statusState === 'expired'
                        ? 'Status expired'
                        : storeStatus && currentStatus && !isStatusExpiredOrExpiringSoon(currentStatus)
                          ? storeStatus.message
                          : 'What are you up to?'}
                  </Text>
                </View>
              </View>
              <View style={styles.myStatusRowRightIcons}>
                {statusState === 'expired' && storeStatus?.endTime ? (
                  <View style={[styles.myStatusRowTimeBubble, styles.myStatusRowExpiredBubble]}>
                    <Text style={styles.myStatusRowTimeBubbleText}>expired</Text>
                  </View>
                ) : statusState === 'cleared' && storeStatus?.endTime ? (
                  <View style={[styles.myStatusRowTimeBubble, styles.myStatusRowClearedBubble]}>
                    <Text style={styles.myStatusRowTimeBubbleText}>cleared</Text>
                  </View>
                ) : storeStatus?.endTime && currentStatus && !isStatusExpiredOrExpiringSoon(currentStatus) && getTimeRemaining(storeStatus.endTime) ? (
                  <View style={[styles.myStatusRowTimeBubble, { backgroundColor: '#25D366' }]}>
                    <Text style={styles.myStatusRowTimeBubbleText}>{getTimeRemaining(storeStatus.endTime)}</Text>
                  </View>
                ) : null}
                {!statusState && !storeStatus && !currentStatus && (
                  <View style={styles.myStatusRowAddStatusPill}>
                    <Text style={styles.myStatusRowAddStatusPillText}>+ Add status</Text>
                  </View>
                )}
                {storeStatus?.location && (statusState !== 'expired' && statusState !== 'cleared') && (
                  <Ionicons
                    name={
                      storeStatus.location === StatusLocation.HOME ? 'home-outline' :
                      storeStatus.location === StatusLocation.GREENSPACE ? 'leaf' :
                      storeStatus.location === StatusLocation.THIRD_PLACE ? 'business' : 'location'
                    }
                    size={20}
                    color="#666"
                  />
                )}
              </View>
            </View>
          </View>
        </Pressable>
      </Animated.View>
      <FlatList
        data={activeContacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          // Get fade animations for this item if it's expired/cleared
          const statusId = item.status?.id;
          const isExpiredOrCleared = statusId && expiredOrClearedStatuses.has(statusId);
          
          // Get fade-to-gray animation (for automatic graying when expired/cleared)
          const grayAnim = isExpiredOrCleared
            ? (() => {
                let anim = friendStatusGrayAnims.get(statusId);
                if (!anim) {
                  anim = new Animated.Value(1);
                  friendStatusGrayAnims.set(statusId, anim);
                }
                return anim;
              })()
            : null;
          
          // Get fade-out animation (for fade-out on refresh)
          const fadeAnim = isExpiredOrCleared
            ? (() => {
                let anim = friendStatusFadeAnims.get(statusId);
                if (!anim) {
                  anim = new Animated.Value(1);
                  friendStatusFadeAnims.set(statusId, anim);
                }
                return anim;
              })()
            : null;

          // Get text fade animation (for cleared statuses - original text fades out, cleared message fades in)
          const textFadeAnim = (item.statusState === 'cleared' && statusId)
            ? (() => {
                let anim = friendStatusTextFadeAnims.get(statusId);
                if (!anim) {
                  anim = new Animated.Value(1); // Start at 1 (original text visible)
                  friendStatusTextFadeAnims.set(statusId, anim);
                }
                return anim;
              })()
            : null;

          // Wrap in Animated.View if expired/cleared for fade-out
          const contactWithStatusState = {
            ...item,
            statusState: item.statusState, // Pass statusState to ContactListItem
            textFadeAnim, // Pass text fade animation for cleared statuses
          };
          
          const content = item.isNewOrChanged ? (
            <SwipeableContactListItem 
              contact={contactWithStatusState} 
              isNew={item.isNew}
              isUpdated={item.isUpdated}
              previousStatus={item.previousStatus || item.previousStatus}
              onMute={handleMuteFriend}
              openRowId={openRowId}
              setOpenRowId={setOpenRowId}
              locallyMutedContacts={locallyMutedContacts}
            />
          ) : (
            <SwipeableContactListItem 
              contact={contactWithStatusState} 
              isNew={item.isNew}
              isUpdated={item.isUpdated}
              previousStatus={item.previousStatus}
              onMute={handleMuteFriend}
              openRowId={openRowId}
              setOpenRowId={setOpenRowId}
              locallyMutedContacts={locallyMutedContacts}
            />
          );

          // Combine gray and fade animations if expired/cleared
          if (grayAnim || fadeAnim) {
            const opacityAnim = grayAnim && fadeAnim
              ? Animated.multiply(grayAnim, fadeAnim) // Both: gray first, then fade out
              : grayAnim || fadeAnim; // One or the other
            return (
              <Animated.View style={{ opacity: opacityAnim }}>
                {content}
              </Animated.View>
            );
          }

          return content;
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
              
              // Fade out expired/cleared friend statuses before removing them
              const statusesToFadeOut = Array.from(expiredOrClearedStatuses.keys());
              if (statusesToFadeOut.length > 0) {
                // Create fade animations for each expired/cleared status
                const fadePromises = statusesToFadeOut.map((statusId) => {
                  let fadeAnim = friendStatusFadeAnims.get(statusId);
                  if (!fadeAnim) {
                    fadeAnim = new Animated.Value(1);
                    friendStatusFadeAnims.set(statusId, fadeAnim);
                  }
                  
                  return new Promise<void>((resolve) => {
                    Animated.timing(fadeAnim!, {
                      toValue: 0,
                      duration: 600, // 2x slower: 600ms instead of 300ms
                      useNativeDriver: true,
                    }).start(() => {
                      resolve();
                    });
                  });
                });

                // Wait for all fade animations to complete
                await Promise.all(fadePromises);
                
                // Clear expired/cleared statuses after fade-out
                setExpiredOrClearedStatuses(new Map());
                // Clean up fade animations
                statusesToFadeOut.forEach((statusId) => {
                  friendStatusFadeAnims.delete(statusId);
                  friendStatusGrayAnims.delete(statusId);
                  friendStatusTextFadeAnims.delete(statusId);
                });
              }
              
              // If user's own status is expired or cleared, fade it out when user refreshes
              if ((statusState === 'expired' || statusState === 'cleared') && storeStatus) {
                // Trigger fade-out animation (2x slower: 600ms instead of 300ms)
                Animated.timing(statusFadeAnim, {
                  toValue: 0,
                  duration: 600,
                  useNativeDriver: true,
                }).start(() => {
                  // After animation completes, clear the status state
                  setCurrentStatus(null);
                  setStatusState(null);
                  // Reset fade animations for next time
                  statusFadeAnim.setValue(1);
                  statusGrayAnim.setValue(1);
                });
              }
              
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
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, minHeight: 400 }}>
            {hasFilteredStatuses ? (
              <>
                <Text style={{ fontSize: 20, color: '#666', textAlign: 'center', lineHeight: 28 }}>
                  Friends are sharing updates,
                </Text>
                <Pressable
                  onPress={() => {
                    setTempShowMuted(showMuted);
                    setTempSelectedLocations(new Set(selectedLocations));
                    setTempMinDurationMinutes(minDurationMinutes);
                    setShowFiltersModal(true);
                  }}
                >
                  <Text style={{ fontSize: 20, color: '#007AFF', fontWeight: '600', textAlign: 'center', lineHeight: 28 }}>
                    adjust your filters
                  </Text>
                </Pressable>
                <Text style={{ fontSize: 20, color: '#666', textAlign: 'center', lineHeight: 28 }}>
                  to see their activity!
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 20, color: '#666', textAlign: 'center', lineHeight: 28 }}>
                  No friends are currently sharing their status
                </Text>
                <Text style={{ fontSize: 20, color: '#666', textAlign: 'center', lineHeight: 28, marginTop: 12 }}>
                  Maybe it's the perfect time to{' '}
                  <Pressable
                    onPress={() => router.push('/(tabs)/activity/set-status')}
                  >
                    <Text style={{ fontSize: 20, color: '#007AFF', fontWeight: '600' }}>
                      share yours?
                    </Text>
                  </Pressable>
                </Text>
                <Text style={{ fontSize: 20, color: '#666', textAlign: 'center', lineHeight: 28, marginTop: 12 }}>
                  OR
                </Text>
                <Text style={{ fontSize: 20, color: '#666', textAlign: 'center', lineHeight: 28, marginTop: 12 }}>
                  <Pressable
                    onPress={() => {
                      router.push('/(tabs)/contacts?openInvite=true');
                    }}
                  >
                    <Text style={{ fontSize: 20, color: '#007AFF', fontWeight: '600' }}>
                      Invite your friends to plaza!
                    </Text>
                  </Pressable>
                </Text>
              </>
            )}
          </View>
        }
      />

      {/* Filters Modal */}
      <Modal
        visible={showFiltersModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFiltersModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 16 }]}>
            <Pressable onPress={() => setShowFiltersModal(false)} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#000" />
            </Pressable>
            <Text style={styles.modalTitle}>Filters</Text>
            <View style={styles.checkmarkButton} />
          </View>
          <ScrollView style={styles.modalContent}>
            {/* Location Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Location</Text>
              <View style={styles.checkboxContainer}>
                <Pressable
                  style={styles.checkboxRow}
                  onPress={() => {
                    const newSet = new Set(tempSelectedLocations);
                    if (newSet.has(StatusLocation.HOME)) {
                      // Only allow unselecting if at least one other location is selected
                      if (newSet.size > 1) {
                        newSet.delete(StatusLocation.HOME);
                      }
                    } else {
                      newSet.add(StatusLocation.HOME);
                    }
                    setTempSelectedLocations(newSet);
                  }}
                >
                  <View style={[
                    styles.checkbox,
                    tempSelectedLocations.has(StatusLocation.HOME) && styles.checkboxChecked,
                    tempSelectedLocations.has(StatusLocation.HOME) && tempSelectedLocations.size === 1 && styles.checkboxDisabled
                  ]}>
                    {tempSelectedLocations.has(StatusLocation.HOME) && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                  <Text style={[
                    styles.checkboxLabel,
                    tempSelectedLocations.has(StatusLocation.HOME) && tempSelectedLocations.size === 1 && styles.checkboxLabelDisabled
                  ]}>Home</Text>
                </Pressable>
                <Pressable
                  style={styles.checkboxRow}
                  onPress={() => {
                    const newSet = new Set(tempSelectedLocations);
                    if (newSet.has(StatusLocation.GREENSPACE)) {
                      // Only allow unselecting if at least one other location is selected
                      if (newSet.size > 1) {
                        newSet.delete(StatusLocation.GREENSPACE);
                      }
                    } else {
                      newSet.add(StatusLocation.GREENSPACE);
                    }
                    setTempSelectedLocations(newSet);
                  }}
                >
                  <View style={[
                    styles.checkbox,
                    tempSelectedLocations.has(StatusLocation.GREENSPACE) && styles.checkboxChecked,
                    tempSelectedLocations.has(StatusLocation.GREENSPACE) && tempSelectedLocations.size === 1 && styles.checkboxDisabled
                  ]}>
                    {tempSelectedLocations.has(StatusLocation.GREENSPACE) && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                  <Text style={[
                    styles.checkboxLabel,
                    tempSelectedLocations.has(StatusLocation.GREENSPACE) && tempSelectedLocations.size === 1 && styles.checkboxLabelDisabled
                  ]}>Greenspace</Text>
                </Pressable>
                <Pressable
                  style={styles.checkboxRow}
                  onPress={() => {
                    const newSet = new Set(tempSelectedLocations);
                    if (newSet.has(StatusLocation.THIRD_PLACE)) {
                      // Only allow unselecting if at least one other location is selected
                      if (newSet.size > 1) {
                        newSet.delete(StatusLocation.THIRD_PLACE);
                      }
                    } else {
                      newSet.add(StatusLocation.THIRD_PLACE);
                    }
                    setTempSelectedLocations(newSet);
                  }}
                >
                  <View style={[
                    styles.checkbox,
                    tempSelectedLocations.has(StatusLocation.THIRD_PLACE) && styles.checkboxChecked,
                    tempSelectedLocations.has(StatusLocation.THIRD_PLACE) && tempSelectedLocations.size === 1 && styles.checkboxDisabled
                  ]}>
                    {tempSelectedLocations.has(StatusLocation.THIRD_PLACE) && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                  <Text style={[
                    styles.checkboxLabel,
                    tempSelectedLocations.has(StatusLocation.THIRD_PLACE) && tempSelectedLocations.size === 1 && styles.checkboxLabelDisabled
                  ]}>Third Place</Text>
                </Pressable>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.filterDivider} />

            {/* Duration Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Duration remaining</Text>
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>
                  {tempMinDurationMinutes === 0 
                    ? 'Any duration' 
                    : `More than ${tempMinDurationMinutes} minutes remaining`}
                </Text>
                <View style={styles.sliderTrack}>
                  {[0, 15, 30, 45, 60, 90, 120].map((minutes) => {
                    // Show step as active if it's <= the selected threshold
                    // This creates a visual "up to this point" indicator
                    const isActive = tempMinDurationMinutes === 0 ? minutes === 0 : minutes <= tempMinDurationMinutes && minutes > 0;
                    return (
                      <Pressable
                        key={minutes}
                        style={styles.sliderStepContainer}
                        hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                        onPress={() => {
                          // Set to the clicked value (direct selection)
                          setTempMinDurationMinutes(minutes);
                        }}
                      >
                        <View style={[
                          styles.sliderStep,
                          isActive && styles.sliderStepActive
                        ]} />
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabelText}>Any</Text>
                  <Text style={styles.sliderLabelText}>15m</Text>
                  <Text style={styles.sliderLabelText}>30m</Text>
                  <Text style={styles.sliderLabelText}>45m</Text>
                  <Text style={styles.sliderLabelText}>1h</Text>
                  <Text style={styles.sliderLabelText}>1.5h</Text>
                  <Text style={styles.sliderLabelText}>2h+</Text>
                </View>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.filterDivider} />

            {/* Muted Friends Toggle: ON = hide muted (default), OFF = show muted */}
            <View style={styles.filterSection}>
              <View style={[styles.filterRow, styles.filterRowNoBorder]}>
                <View style={styles.filterLabelBlock}>
                  <Text style={styles.filterLabel}>
                    Hide updates from muted friends
                  </Text>
                  <Text style={styles.filterSubtext}>
                    {tempShowMuted
                      ? "You are seeing updates from friends you've muted"
                      : "You won't see updates from friends you've muted"}
                  </Text>
                </View>
                <Switch
                  value={!tempShowMuted}
                  onValueChange={(hideMuted) => setTempShowMuted(!hideMuted)}
                  trackColor={{ false: '#E5E5E5', true: '#007AFF' }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </ScrollView>
          <View style={styles.modalFooter}>
            <Pressable
              onPress={() => {
                // Clear all filters (reset to defaults: all locations, any duration, hide muted)
                setTempShowMuted(false);
                setTempSelectedLocations(new Set([StatusLocation.HOME, StatusLocation.GREENSPACE, StatusLocation.THIRD_PLACE]));
                setTempMinDurationMinutes(0);
              }}
              style={styles.clearFiltersButton}
            >
              <Text style={styles.clearFiltersButtonText}>Reset Filters</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                updatePreferencesMutation.mutate({
                  showMuted: tempShowMuted,
                  selectedLocations: Array.from(tempSelectedLocations),
                  minDurationMinutes: tempMinDurationMinutes,
                });
              }}
              style={styles.applyButton}
              disabled={updatePreferencesMutation.isPending}
            >
              <Text style={styles.applyButtonText}>
                {updatePreferencesMutation.isPending ? 'Saving…' : 'Apply'}
              </Text>
            </Pressable>
          </View>
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
    flex: 1,
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
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
  statusInputContainerDisabled: {
    backgroundColor: '#E5E5E5',
    opacity: 0.6,
  },
  statusInputDisabled: {
    backgroundColor: '#E5E5E5',
    color: '#999',
    borderColor: '#CCCCCC',
  },
  avatarContainerDisabled: {
    borderColor: '#CCCCCC',
    opacity: 0.6,
  },
  avatarDisabled: {
    backgroundColor: '#E5E5E5',
  },
  avatarTextDisabled: {
    color: '#999',
  },
  myStatusRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f0f8ff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  myStatusRowContainerDisabled: {
    backgroundColor: '#E8E8E8',
    opacity: 0.85,
  },
  myStatusRowAvatarContainer: {
    position: 'relative',
    marginRight: 12,
    overflow: 'visible',
    minWidth: 70,
    alignItems: 'center',
  },
  myStatusRowAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
  },
  myStatusRowContent: {
    flex: 1,
    justifyContent: 'center',
  },
  myStatusRowNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  myStatusRowNameAndStatus: {
    flex: 1,
    marginRight: 8,
  },
  myStatusRowName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  myStatusRowNameDisabled: {
    color: '#999',
  },
  myStatusRowMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  myStatusRowMessage: {
    fontSize: 14,
    color: '#667781',
    marginTop: 2,
  },
  myStatusRowMessageDisabled: {
    color: '#999',
  },
  myStatusRowRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  myStatusRowAddStatusPill: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  myStatusRowAddStatusPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  myStatusRowTimeBubble: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myStatusRowTimeBubbleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  myStatusRowExpiredBubble: {
    backgroundColor: '#F44336',
  },
  myStatusRowClearedBubble: {
    backgroundColor: '#999',
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
  timePickerContainerIncomplete: {
    borderWidth: 1.5,
    borderColor: '#ff9500',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fffbf5',
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
  tellFriendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 20,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#007AFF',
    backgroundColor: 'transparent',
    alignSelf: 'flex-start',
  },
  tellFriendsButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#BBDEFB',
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
    gap: 8,
  },
  updateBannerText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  filterButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterSection: {
    marginTop: 20,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterRowNoBorder: {
    borderBottomWidth: 0,
  },
  filterDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 20,
  },
  filterLabelBlock: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    marginRight: 12,
  },
  filterLabel: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  filterSubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
    flexDirection: 'row',
    gap: 12,
  },
  clearFiltersButton: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
  },
  clearFiltersButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  checkboxContainer: {
    gap: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#000',
    fontWeight: '400',
  },
  checkboxDisabled: {
    opacity: 0.5,
  },
  checkboxLabelDisabled: {
    color: '#999',
  },
  sliderContainer: {
    marginTop: 8,
  },
  sliderLabel: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
    marginBottom: 16,
  },
  sliderTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    marginBottom: 8,
  },
  sliderStepContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    marginHorizontal: 2,
  },
  sliderStep: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E5E5',
    borderRadius: 4,
  },
  sliderStepActive: {
    backgroundColor: '#007AFF',
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  sliderLabelText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
    textAlign: 'center',
  },
});
