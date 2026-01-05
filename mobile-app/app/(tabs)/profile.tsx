import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../lib/api';
import { StatusPicker } from '../../components/StatusPicker';
import { TimeWindowPicker } from '../../components/TimeWindowPicker';
import { SignOutButton } from '../../components/SignOutButton';
import { AvailabilityStatus } from '../../lib/types';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const api = useApi();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [status, setStatus] = useState<AvailabilityStatus>(
    AvailabilityStatus.AVAILABLE
  );
  const [message, setMessage] = useState('');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(() => {
    const end = new Date();
    end.setHours(end.getHours() + 2);
    return end;
  });

  const { data: currentStatus } = useQuery({
    queryKey: ['my-status'],
    queryFn: api.getMyStatus,
  });

  const createStatusMutation = useMutation({
    mutationFn: api.createStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-status'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-statuses'] });
    },
  });

  const generateInviteMutation = useMutation({
    mutationFn: api.generateInvite,
    onSuccess: (data) => {
      // TODO: Share the invite URL
      alert(`Invite link: ${data.url}`);
    },
  });

  const handleSaveStatus = () => {
    createStatusMutation.mutate({
      status,
      message,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    });
  };

  return (
    <ScrollView style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Set Your Status
      </Text>

      {currentStatus && (
        <View style={{ marginBottom: 20, padding: 10, backgroundColor: '#f0f0f0' }}>
          <Text>Current: {currentStatus.status}</Text>
          {currentStatus.message && <Text>{currentStatus.message}</Text>}
        </View>
      )}

      <StatusPicker value={status} onChange={setStatus} />

      <View style={{ marginVertical: 20 }}>
        <Text style={{ marginBottom: 5 }}>Status Message (Optional)</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="e.g., Free for coffee"
          style={{ borderWidth: 1, padding: 10 }}
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
        style={{
          backgroundColor: 'blue',
          padding: 15,
          marginTop: 20,
          borderRadius: 5,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontSize: 16 }}>
          Save Status
        </Text>
      </Pressable>

      <Pressable
        onPress={() => generateInviteMutation.mutate()}
        style={{
          backgroundColor: 'green',
          padding: 15,
          marginTop: 10,
          borderRadius: 5,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontSize: 16 }}>
          Invite Someone
        </Text>
      </Pressable>

      <SignOutButton />
    </ScrollView>
  );
}

