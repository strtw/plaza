import { View, FlatList, Text, RefreshControl, ActivityIndicator, StyleSheet, Modal, TextInput, Pressable, ScrollView, Alert, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createApi } from '../../lib/api';
import { ContactListItem } from '../../components/ContactListItem';
import { AvailabilityStatus } from '../../lib/types';
import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

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

function ActivityScreenContent() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const api = createApi(getToken);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

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

  const { data: statuses } = useQuery({
    queryKey: ['contacts-statuses'],
    queryFn: api.getContactsStatuses,
    enabled: isLoaded && isSignedIn,
    refetchInterval: 10000, // Poll every 10 seconds
  });

  const { data: currentStatus } = useQuery({
    queryKey: ['my-status'],
    queryFn: api.getMyStatus,
    enabled: isLoaded && isSignedIn,
  });

  const createStatusMutation = useMutation({
    mutationFn: api.createStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-status'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-statuses'] });
      // Reset form state
      setMessage('');
      setLocation(null);
      setEndTime(getDefaultEndTime());
      setShowStatusModal(false);
      Alert.alert('Success', 'Your status has been set!');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to set status. Please try again.');
    },
  });

  // Calculate header padding
  const headerPaddingTop = insets.top + 16;
  
  // Merge contacts with their statuses
  const contactsWithStatus = contacts?.map((contact: any) => ({
    ...contact,
    status: statuses?.find((s: any) => s.user?.id === contact.id || s.userId === contact.id),
  })) || [];

  // Filter to only show contacts with active statuses
  // Backend already filters statuses by time window (startTime <= now <= endTime)
  const activeContacts = contactsWithStatus.filter((contact: any) => contact.status !== undefined);

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
    
    createStatusMutation.mutate({
      status: AvailabilityStatus.AVAILABLE,
      message: message.trim(),
      location: locationMap[location] as any,
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

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }
  
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.headerContainer, { paddingTop: headerPaddingTop }]}>
        <Text style={styles.headerTitle}>Activity</Text>
      </View>
      <Pressable 
        style={styles.statusInputContainer}
        onPress={() => {
          // Reset form state when opening modal
          setMessage('');
          setLocation(null);
          setEndTime(getDefaultEndTime());
          setShowStatusModal(true);
        }}
      >
        <View style={styles.statusInputWrapper}>
          <Ionicons name="create-outline" size={20} color="#666" style={styles.composeIcon} />
          <TextInput
            style={styles.statusInput}
            placeholder="What's your status?"
            placeholderTextColor="#333"
            editable={false}
            pointerEvents="none"
            value={currentStatus ? `${currentStatus.status}${currentStatus.message ? `: ${currentStatus.message}` : ''}` : ''}
          />
        </View>
      </Pressable>
      <FlatList
        data={activeContacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ContactListItem contact={item} />}
        refreshControl={
          <RefreshControl 
            refreshing={isLoading} 
            onRefresh={() => {
              refetch();
              queryClient.invalidateQueries({ queryKey: ['contacts-statuses'] });
            }} 
          />
        }
        ListEmptyComponent={
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#666', textAlign: 'center' }}>
              No contacts are currently active.
            </Text>
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
                placeholder="What's your status?"
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
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
  composeIcon: {
    marginRight: 12,
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
});
