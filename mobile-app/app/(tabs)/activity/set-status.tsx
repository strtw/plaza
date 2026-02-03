import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createApi } from '../../../lib/api';
import { AvailabilityStatus, StatusLocation, ContactStatus } from '../../../lib/types';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useUserStore } from '../../../stores/userStore';
import { FindFriendsModal } from '../../../components/FindFriendsModal';

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
  const { currentStatus: storeStatus, setCurrentStatus, lastAddFriendsCount, setLastAddFriendsCount } = useUserStore();

  const [message, setMessage] = useState('');
  const [showInviteesModal, setShowInviteesModal] = useState(false);
  const [selectedInviteeIds, setSelectedInviteeIds] = useState<string[]>([]);
  const [location, setLocation] = useState<'home' | 'greenspace' | 'third-place' | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(() => getDefaultEndTime());
  const [timeTouched, setTimeTouched] = useState(false);
  const hasPrefilledRef = useRef(false);
  const initialMessageRef = useRef('');
  const initialLocationRef = useRef<'home' | 'greenspace' | 'third-place' | null>(null);
  const initialEndTimeMsRef = useRef<number>(0);
  const initialInviteesCountRef = useRef(0);
  const initialInviteeIdsRef = useRef<string[]>([]);

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

  const hasAttendees = (currentStatus?.onMyWayUserIds?.length ?? 0) > 0;
  const minEndTime =
    hasAttendees && currentStatus?.endTime
      ? new Date(Math.max(Date.now(), new Date(currentStatus.endTime).getTime()))
      : null;

  const { data: contacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: api.getContacts,
    enabled: isLoaded && isSignedIn,
  });

  // Prefill form only when editing an existing status and form is still empty (never overwrite user input)
  useEffect(() => {
    const userHasEnteredData = message.trim().length > 0 || location != null || timeTouched;
    if (
      currentStatus &&
      currentStatus.endTime &&
      !hasPrefilledRef.current &&
      !userHasEnteredData
    ) {
      const prefilledMessage = currentStatus.message || '';
      const prefilledLocation = mapBackendToFrontendLocation(currentStatus.location);
      const prefilledEndTime = new Date(currentStatus.endTime);
      const inviteesCount = currentStatus.sharedWith?.length ?? 0;
      setMessage(prefilledMessage);
      setLocation(prefilledLocation);
      setEndTime(prefilledEndTime);
      setTimeTouched(true);
      setLastAddFriendsCount(inviteesCount);
      setSelectedInviteeIds(currentStatus.sharedWith ?? []);
      initialMessageRef.current = prefilledMessage;
      initialLocationRef.current = prefilledLocation;
      initialEndTimeMsRef.current = prefilledEndTime.getTime();
      initialInviteesCountRef.current = inviteesCount;
      initialInviteeIdsRef.current = currentStatus.sharedWith ?? [];
      hasPrefilledRef.current = true;
    }
  }, [currentStatus?.id, currentStatus?.endTime, message, location, timeTouched]);

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
    const payload = hasAttendees && currentStatus
      ? {
          status: AvailabilityStatus.AVAILABLE,
          message: message.trim(),
          location: currentStatus.location,
          startTime: currentStatus.startTime,
          endTime: endTime.toISOString(),
          sharedWith: selectedInviteeIds,
        }
      : {
          status: AvailabilityStatus.AVAILABLE,
          message: message.trim(),
          location: locationMap[location!],
          startTime: new Date().toISOString(),
          endTime: endTime.toISOString(),
          sharedWith: selectedInviteeIds,
        };
    createStatusMutation.mutate(payload);
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (!selectedDate) return;
    const rounded = roundToNearest15Minutes(selectedDate);
    const clamped =
      minEndTime && rounded.getTime() < minEndTime.getTime() ? minEndTime : rounded;
    if (Platform.OS === 'ios') {
      if (event.type === 'set') {
        setEndTime(clamped);
        setTimeTouched(true);
      }
    } else {
      setEndTime(clamped);
      setTimeTouched(true);
    }
  };

  const allFieldsFilled =
    message.trim().length > 0 &&
    location !== null &&
    endTime !== null &&
    timeTouched &&
    lastAddFriendsCount >= 2;

  const isEditing = hasPrefilledRef.current && !!currentStatus;
  const hasInviteesChanged =
    selectedInviteeIds.length !== initialInviteeIdsRef.current.length ||
    selectedInviteeIds.some((id) => !initialInviteeIdsRef.current.includes(id));
  const hasChanged =
    !isEditing ||
    message !== initialMessageRef.current ||
    location !== initialLocationRef.current ||
    (endTime?.getTime() ?? 0) !== initialEndTimeMsRef.current ||
    lastAddFriendsCount !== initialInviteesCountRef.current ||
    hasInviteesChanged;

  const isFormReady = allFieldsFilled && (!isEditing || hasChanged);

  if (!isLoaded || !isSignedIn) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#007AFF" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Edit your status' : 'Set your status'}
        </Text>
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
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
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
            {!hasAttendees && <Text style={styles.requiredIndicator}>Required</Text>}
          </View>
          {hasAttendees && location ? (
            <View>
              <View style={styles.locationReadOnly}>
                <Ionicons name="lock-closed" size={20} color="#666" />
                <Text style={styles.locationReadOnlyText}>
                  {location === 'home' ? 'Home' : location === 'greenspace' ? 'Greenspace' : 'Third Place'}
                </Text>
              </View>
              <Text style={[styles.helperText, { marginTop: 8 }]}>Can't change when people are attending</Text>
            </View>
          ) : (
            <>
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
                   My Place
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
                    Greenspace{' '}
                    <Text style={styles.locationOptionSubtext}>(park, trail, beach etc.)</Text>
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
                    Third Place{' '}
                    <Text style={styles.locationOptionSubtext}>(cafe, museum, town square etc. )</Text>
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.timeContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>I'm available until:</Text>
            <Text style={styles.requiredIndicator}>Required</Text>
          </View>
          {hasAttendees && (
            <Text style={[styles.helperText, { marginBottom: 8 }]}>
              You can only extend the end time when people are attending
            </Text>
          )}
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
       
        </View>

        <View style={styles.tellFriendsContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.requiredIndicator}>Required</Text>
          </View>
          <Pressable style={styles.tellFriendsButton} onPress={() => setShowInviteesModal(true)}>
            <Ionicons name="add" size={22} color="#007AFF" />
            <Ionicons name="people" size={22} color="#007AFF" />
            <Text style={styles.tellFriendsButtonText}>
              Add some friends{lastAddFriendsCount > 0 ? ` (${lastAddFriendsCount})` : ''}
            </Text>
          </Pressable>
        </View>
        </View>
      </ScrollView>
      <FindFriendsModal
        visible={showInviteesModal}
        onClose={(count, selectedUserIds) => {
          if (hasAttendees && selectedUserIds !== undefined && currentStatus?.sharedWith) {
            const merged = [...new Set([...currentStatus.sharedWith, ...selectedUserIds])];
            setSelectedInviteeIds(merged);
            setLastAddFriendsCount(merged.length);
          } else {
            if (count !== undefined) setLastAddFriendsCount(count);
            if (selectedUserIds !== undefined) setSelectedInviteeIds(selectedUserIds);
          }
          setShowInviteesModal(false);
        }}
        asFullScreen={false}
        initialSelectedUserIds={
          selectedInviteeIds.length > 0 ? selectedInviteeIds : (currentStatus?.sharedWith ?? [])
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    minHeight: 60,
    backgroundColor: '#fff',
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  closeButton: { padding: 4, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#000', flex: 1, textAlign: 'center' },
  doneButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonDisabled: { backgroundColor: '#e0e0e0' },
  doneButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  doneButtonTextDisabled: { color: '#999' },
  content: { flex: 1, backgroundColor: '#f5f5f5' },
  contentContainer: { paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  messageContainer: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#000' },
  requiredIndicator: { fontSize: 12, color: '#999', fontWeight: '400' },
  messageInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#f5f5f5',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputIncomplete: {},
  inputFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  helperText: { fontSize: 12, color: '#999', fontStyle: 'italic' },
  characterCount: { fontSize: 12, color: '#999' },
  locationContainer: { marginBottom: 20 },
  locationSelectorContainer: { gap: 12, marginBottom: 8 },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    gap: 8,
  },
  locationOptionIncomplete: {},
  locationOptionSelected: { borderColor: '#007AFF', backgroundColor: '#f0f8ff' },
  locationOptionText: { fontSize: 15, color: '#666', fontWeight: '500' },
  locationOptionTextSelected: { color: '#007AFF', fontWeight: '600' },
  locationOptionSubtext: { fontSize: 12, color: '#999', fontWeight: '400' },
  locationReadOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  locationReadOnlyText: { fontSize: 15, color: '#666', fontWeight: '600' },
  timeContainer: { marginBottom: 8 },
  timePickerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 16 },
  timePickerContainerIncomplete: {},
  tellFriendsContainer: { marginTop: 8, marginBottom: 40 },
  tellFriendsButton: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#007AFF',
    backgroundColor: 'transparent',
    gap: 8,
  },
  tellFriendsButtonText: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
});
