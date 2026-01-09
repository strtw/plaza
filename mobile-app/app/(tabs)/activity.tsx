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
    if (!message.trim() || !endTime) {
      return;
    }
    
    createStatusMutation.mutate({
      status: AvailabilityStatus.AVAILABLE,
      message: message.trim(),
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

  // Check if form is ready to save (message and endTime are set)
  const isFormReady = message.trim().length > 0 && endTime !== null;

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
          setEndTime(getDefaultEndTime());
          setShowStatusModal(true);
        }}
      >
        <TextInput
          style={styles.statusInput}
          placeholder="What's your status?"
          placeholderTextColor="#999"
          editable={false}
          pointerEvents="none"
          value={currentStatus ? `${currentStatus.status}${currentStatus.message ? `: ${currentStatus.message}` : ''}` : ''}
        />
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
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="What's your status?"
                style={styles.messageInput}
                multiline
                maxLength={140}
                autoFocus
              />
              <Text style={styles.characterCount}>
                {message.length}/140
              </Text>
            </View>

            <View style={styles.timePickerContainer}>
              <Text style={styles.clearAfterButtonText}>
                Clear after...
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
  statusInput: {
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
    marginBottom: 24,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  clearAfterButtonText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
});
