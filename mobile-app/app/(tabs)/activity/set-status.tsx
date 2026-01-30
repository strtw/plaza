import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createApi } from '../../../lib/api';
import { AvailabilityStatus, StatusLocation, ContactStatus } from '../../../lib/types';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useUserStore } from '../../../stores/userStore';

const roundToNearest15Minutes = (date: Date): Date => {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  rounded.setMinutes(roundedMinutes, 0, 0);
  return rounded;
};

const getDefaultEndTime = (): Date => {
  const now = new Date();
  const minutes = now.getMinutes();
  const roundedUpMinutes = Math.ceil(minutes / 15) * 15;
  const roundedUp = new Date(now);
  roundedUp.setMinutes(roundedUpMinutes, 0, 0);
  roundedUp.setMinutes(roundedUp.getMinutes() + 15);
  return roundedUp;
};

const mapBackendToFrontendLocation = (location: StatusLocation): 'home' | 'greenspace' | 'third-place' | null => {
  const map: Record<StatusLocation, 'home' | 'greenspace' | 'third-place'> = {
    'HOME': 'home',
    'GREENSPACE': 'greenspace',
    'THIRD_PLACE': 'third-place',
  };
  return map[location] || null;
};

export default function SetStatusScreen() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const api = createApi(getToken);
  const queryClient = useQueryClient();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentStatus: storeStatus, setCurrentStatus, lastAddFriendsCount } = useUserStore();

  const [message, setMessage] = useState('');
  const [location, setLocation] = useState<'home' | 'greenspace' | 'third-place' | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(() => getDefaultEndTime());
  const [timeTouched, setTimeTouched] = useState(false);

  const { data: currentStatus } = useQuery({
    queryKey: ['my-status'],
    queryFn: async () => {
      const result = await api.getMyStatus();
      if (!result || !result.endTime) return null;
      const end = new Date(result.endTime);
      const now = new Date();
      if (end.getTime() - now.getTime() <= 60000) return null;
      return result;
    },
    enabled: isLoaded && isSignedIn,
  });

  const { data: contacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: api.getContacts,
    enabled: isLoaded && isSignedIn,
  });

  // Prefill form when we have an active status
  useEffect(() => {
    if (currentStatus && currentStatus.endTime) {
      setMessage(currentStatus.message || '');
      setLocation(mapBackendToFrontendLocation(currentStatus.location));
      setEndTime(new Date(currentStatus.endTime));
    }
  }, [currentStatus?.id]);

  const createStatusMutation = useMutation({
    mutationFn: api.createStatus,
    onSuccess: (data) => {
      queryClient.setQueryData(['my-status'], data);
      setCurrentStatus(data as ContactStatus);
      queryClient.invalidateQueries({ queryKey: ['my-status'] });
      queryClient.invalidateQueries({ queryKey: ['friends-statuses'] });
      router.back();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to set status. Please try again.');
    },
  });

  const handleSaveStatus = () => {
    if (!message.trim() || !location || !endTime) return;
    const locationMap: Record<'home' | 'greenspace' | 'third-place', string> = {
      'home': 'HOME',
      'greenspace': 'GREENSPACE',
      'third-place': 'THIRD_PLACE',
    };
    const friendIds = contacts?.map((c: any) => c.id).filter(Boolean) || [];
    createStatusMutation.mutate({
      status: AvailabilityStatus.AVAILABLE,
      message: message.trim(),
      location: locationMap[location],
      startTime: new Date().toISOString(),
      endTime: endTime.toISOString(),
      sharedWith: friendIds,
    });
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'ios') {
      if (event.type === 'set' && selectedDate) {
        setEndTime(roundToNearest15Minutes(selectedDate));
        setTimeTouched(true);
      }
    } else if (selectedDate) {
      setEndTime(roundToNearest15Minutes(selectedDate));
      setTimeTouched(true);
    }
  };

  const isFormReady =
    message.trim().length > 0 &&
    location !== null &&
    endTime !== null &&
    timeTouched &&
    lastAddFriendsCount >= 2;
  if (!isLoaded || !isSignedIn) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Set your status</Text>
        <Pressable
          onPress={handleSaveStatus}
          style={[
            styles.doneButton,
            (!isFormReady || createStatusMutation.isPending) && styles.doneButtonDisabled,
          ]}
          disabled={!isFormReady || createStatusMutation.isPending}
        >
          <Text
            style={[
              styles.doneButtonText,
              (!isFormReady || createStatusMutation.isPending) && styles.doneButtonTextDisabled,
            ]}
          >
            Done
          </Text>
        </Pressable>
      </View>
      <ScrollView style={styles.content}>
        <View style={styles.messageContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Message</Text>
            <Text style={styles.requiredIndicator}>Required</Text>
          </View>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholderTextColor="#333"
            style={[styles.messageInput, !message.trim() && styles.inputIncomplete]}
            multiline
            maxLength={140}
            autoFocus
          />
          <View style={styles.inputFooter}>
            <Text style={styles.helperText}>
              {!message.trim() ? 'Tell your friends where to meet you and what to expect' : ''}
            </Text>
            <Text style={styles.characterCount}>{message.length}/140</Text>
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
                !location && styles.locationOptionIncomplete,
              ]}
              onPress={() => setLocation('home')}
            >
              <Ionicons name="home-outline" size={24} color={location === 'home' ? '#007AFF' : '#666'} />
              <Text style={[styles.locationOptionText, location === 'home' && styles.locationOptionTextSelected]}>
                Home
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.locationOption,
                location === 'greenspace' && styles.locationOptionSelected,
                !location && styles.locationOptionIncomplete,
              ]}
              onPress={() => setLocation('greenspace')}
            >
              <Ionicons name="leaf" size={24} color={location === 'greenspace' ? '#007AFF' : '#666'} />
              <Text style={[styles.locationOptionText, location === 'greenspace' && styles.locationOptionTextSelected]}>
                Greenspace
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.locationOption,
                location === 'third-place' && styles.locationOptionSelected,
                !location && styles.locationOptionIncomplete,
              ]}
              onPress={() => setLocation('third-place')}
            >
              <Ionicons name="business" size={24} color={location === 'third-place' ? '#007AFF' : '#666'} />
              <Text style={[styles.locationOptionText, location === 'third-place' && styles.locationOptionTextSelected]}>
                Third Place
              </Text>
            </Pressable>
          </View>
          {!location && <Text style={styles.helperText}>Select where you'll be</Text>}
        </View>

        <View style={styles.timeContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>I'm available until:</Text>
            <Text style={styles.requiredIndicator}>Required</Text>
          </View>
          <Pressable
            style={[styles.timePickerContainer, !timeTouched && styles.timePickerContainerIncomplete]}
            onPress={() => setTimeTouched(true)}
          >
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={endTime || getDefaultEndTime()}
                mode="time"
                display="default"
                minuteInterval={15}
                onChange={handleTimeChange}
              />
            ) : (
              <DateTimePicker
                value={endTime || getDefaultEndTime()}
                mode="time"
                minuteInterval={15}
                onChange={handleTimeChange}
              />
            )}
          </Pressable>
          {!timeTouched && (
            <Text style={styles.helperText}>Tap the time selector to continue</Text>
          )}
        </View>

        <View style={styles.tellFriendsContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Tell some friends</Text>
            <Text style={styles.requiredIndicator}>Required</Text>
          </View>
          <Pressable style={styles.tellFriendsButton} onPress={() => router.push('/(tabs)/activity/add-friends')}>
            <Ionicons name="add" size={28} color="#007AFF" />
            <Ionicons name="people" size={28} color="#007AFF" />
            {lastAddFriendsCount > 0 && (
              <Text style={styles.tellFriendsCount}>({lastAddFriendsCount})</Text>
            )}
          </Pressable>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    minHeight: 60,
  },
  closeButton: { padding: 4, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#000', flex: 1, textAlign: 'center' },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonDisabled: { backgroundColor: '#e0e0e0' },
  doneButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  doneButtonTextDisabled: { color: '#999' },
  content: { flex: 1, padding: 20 },
  messageContainer: { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#000' },
  requiredIndicator: { fontSize: 12, color: '#999', fontWeight: '400' },
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
  inputIncomplete: { borderColor: '#ff9500', backgroundColor: '#fffbf5' },
  inputFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  helperText: { fontSize: 12, color: '#999', fontStyle: 'italic' },
  characterCount: { fontSize: 12, color: '#999' },
  locationContainer: { marginBottom: 28 },
  locationSelectorContainer: { flexDirection: 'row', gap: 12, marginBottom: 6 },
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
  locationOptionIncomplete: { borderColor: '#ff9500', backgroundColor: '#fffbf5' },
  locationOptionSelected: { borderColor: '#007AFF', backgroundColor: '#f0f8ff' },
  locationOptionText: { fontSize: 15, color: '#666', fontWeight: '500' },
  locationOptionTextSelected: { color: '#007AFF', fontWeight: '600' },
  timeContainer: { marginBottom: 20 },
  timePickerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 16 },
  timePickerContainerIncomplete: {
    borderWidth: 1.5,
    borderColor: '#ff9500',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fffbf5',
  },
  tellFriendsContainer: { marginTop: 20, marginBottom: 20 },
  tellFriendsButton: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#007AFF',
    backgroundColor: 'transparent',
    gap: 6,
  },
  tellFriendsCount: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
});
