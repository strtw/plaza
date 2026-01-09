import { View, FlatList, Text, RefreshControl, ActivityIndicator, StyleSheet, Modal, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createApi } from '../../lib/api';
import { ContactListItem } from '../../components/ContactListItem';
import { StatusPicker } from '../../components/StatusPicker';
import { TimeWindowPicker } from '../../components/TimeWindowPicker';
import { AvailabilityStatus } from '../../lib/types';
import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';

function ActivityScreenContent() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const api = createApi(getToken);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  // Modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [status, setStatus] = useState<AvailabilityStatus>(AvailabilityStatus.AVAILABLE);
  const [message, setMessage] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(() => {
    const end = new Date();
    end.setHours(end.getHours() + 2);
    return end;
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
    createStatusMutation.mutate({
      status,
      message,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    });
  };

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
        onPress={() => setShowStatusModal(true)}
      >
        <TextInput
          style={styles.statusInput}
          placeholder="What's your status?"
          placeholderTextColor="#999"
          editable={false}
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
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set your status</Text>
            <Pressable onPress={() => setShowStatusModal(false)}>
              <Text style={styles.modalCloseButton}>Close</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent}>
            {currentStatus && (
              <View style={styles.currentStatusContainer}>
                <Text style={styles.currentStatusLabel}>Current Status:</Text>
                <Text style={styles.currentStatusText}>{currentStatus.status}</Text>
                {currentStatus.message && (
                  <Text style={styles.currentStatusMessage}>{currentStatus.message}</Text>
                )}
              </View>
            )}

            <StatusPicker value={status} onChange={setStatus} />

            <View style={styles.messageContainer}>
              <Text style={styles.messageLabel}>Status Message (Optional)</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="e.g., Free for coffee"
                style={styles.messageInput}
              />
            </View>

            <TimeWindowPicker
              startTime={startTime}
              endTime={endTime}
              onStartTimeChange={setStartTime}
              onEndTimeChange={setEndTime}
            />

            <Pressable
              onPress={handleSaveStatus}
              style={[styles.saveButton, createStatusMutation.isPending && styles.saveButtonDisabled]}
              disabled={createStatusMutation.isPending}
            >
              <Text style={styles.saveButtonText}>
                {createStatusMutation.isPending ? 'Saving...' : 'Save Status'}
              </Text>
            </Pressable>
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
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  modalCloseButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  currentStatusContainer: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  currentStatusLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  currentStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  currentStatusMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  messageContainer: {
    marginVertical: 20,
  },
  messageLabel: {
    fontSize: 16,
    marginBottom: 8,
    color: '#000',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    marginTop: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
