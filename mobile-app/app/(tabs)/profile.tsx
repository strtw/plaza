import { View, Text, TextInput, Pressable, ScrollView, Alert, ActivityIndicator, Share } from 'react-native';
import { useState, useEffect, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createApi } from '../../lib/api';
import { StatusPicker } from '../../components/StatusPicker';
import { TimeWindowPicker } from '../../components/TimeWindowPicker';
import { SignOutButton } from '../../components/SignOutButton';
import { AvailabilityStatus } from '../../lib/types';
import { useRouter, Redirect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@clerk/clerk-expo';

const ProfileScreenContent = lazy(() => Promise.resolve({
  default: function ProfileScreenContent() {
    const { isSignedIn, isLoaded, getToken } = useAuth();
    const api = createApi(getToken);
    const queryClient = useQueryClient();
    const router = useRouter();

    // All hooks must be called before any conditional returns
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
      enabled: isLoaded && isSignedIn,
    });

    const createStatusMutation = useMutation({
      mutationFn: api.createStatus,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['my-status'] });
        queryClient.invalidateQueries({ queryKey: ['contacts-statuses'] });
      },
    });

    // Now we can do conditional returns after all hooks
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

  // Generate a dummy invite code for now (32 character hex string)
  const generateDummyInviteCode = () => {
    const chars = '0123456789abcdef';
    let code = '';
    for (let i = 0; i < 32; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const handleInvite = async () => {
    try {
      // Generate dummy invite code for now
      const inviteCode = generateDummyInviteCode();
      console.log('Generated invite code:', inviteCode);
      
      // Copy invite code to clipboard
      await Clipboard.setStringAsync(inviteCode);
      console.log('Copied to clipboard:', inviteCode);
      
      // Create share message with App Store link and invite code
      // TODO: Replace with your actual App Store URL once published
      const appStoreUrl = 'https://apps.apple.com/app/id/YOUR_APP_ID'; // Replace with real URL
      const shareMessage = `Join me on Plaza! Download here: ${appStoreUrl}\n\nInvite code: ${inviteCode}`;
      
      // Use React Native's built-in Share API to open iOS share sheet
      const result = await Share.share({
        message: shareMessage,
        title: 'Invite someone to Plaza',
      });
      
      console.log('Share result:', result);
      
      // Show success message
      if (result.action === Share.sharedAction) {
        Alert.alert('Success', 'Invite shared!');
      }
    } catch (error: any) {
      console.error('Error sharing:', error);
      
      // If Share.share fails, show alert with the message
      const inviteCode = generateDummyInviteCode();
      await Clipboard.setStringAsync(inviteCode);
      const appStoreUrl = 'https://apps.apple.com/app/id/YOUR_APP_ID';
      const shareMessage = `Join me on Plaza! Download here: ${appStoreUrl}\n\nInvite code: ${inviteCode}`;
      
      Alert.alert(
        'Invite Code Generated',
        `Share this message:\n\n${shareMessage}\n\n(Invite code copied to clipboard)`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleSaveStatus = () => {
    createStatusMutation.mutate({
      status,
      message,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    });
  };

  return (
    <ScrollView style={{ flex: 1, padding: 20, backgroundColor: '#f5f5f5' }}>
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
        onPress={handleInvite}
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
}));

export default function ProfileScreen() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Ensure component only mounts after ClerkProvider is ready
    const timer = setTimeout(() => {
      setMounted(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <Suspense fallback={
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading...</Text>
      </View>
    }>
      <ProfileScreenContent />
    </Suspense>
  );
}

