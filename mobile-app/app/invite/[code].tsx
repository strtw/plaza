import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../lib/api';
import { getFullName } from '../../lib/types';

export default function InviteScreen() {
  const { code } = useLocalSearchParams();
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: invite, isLoading } = useQuery({
    queryKey: ['invite', code],
    queryFn: () => api.getInvite(code as string),
  });

  const useInviteMutation = useMutation({
    mutationFn: () => api.useInvite(code as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      router.replace('/(tabs)');
    },
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading invite...</Text>
      </View>
    );
  }

  if (!invite) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Invite not found or expired</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Text style={{ fontSize: 24, textAlign: 'center', marginBottom: 20 }}>
        {getFullName(invite.inviter)} invited you!
      </Text>

      <Pressable
        onPress={() => useInviteMutation.mutate()}
        style={{
          backgroundColor: 'blue',
          padding: 15,
          borderRadius: 5,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontSize: 16 }}>
          Accept Invite
        </Text>
      </Pressable>
    </View>
  );
}

