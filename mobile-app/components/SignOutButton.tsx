import { useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';

export const SignOutButton = () => {
  const { signOut } = useClerk();
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    try {
      await signOut();
      queryClient.removeQueries({ queryKey: ['current-user'] });
      router.replace('/(auth)/sign-in');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleSignOut}
      style={{ backgroundColor: '#007AFF', padding: 15, borderRadius: 8, minWidth: 200, marginBottom: 20 }}
    >
      <Text style={{ color: 'white', textAlign: 'center', fontSize: 16, fontWeight: '600' }}>Sign Out</Text>
    </TouchableOpacity>
  );
};

