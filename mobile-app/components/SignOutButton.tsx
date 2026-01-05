import { useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Text, TouchableOpacity } from 'react-native';

export const SignOutButton = () => {
  const { signOut } = useClerk();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      // After signing out, redirect to sign-in page
      router.replace('/(auth)/sign-in');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleSignOut}
      style={{ backgroundColor: 'red', padding: 15, borderRadius: 5, margin: 10 }}
    >
      <Text style={{ color: 'white', textAlign: 'center' }}>Sign Out</Text>
    </TouchableOpacity>
  );
};

