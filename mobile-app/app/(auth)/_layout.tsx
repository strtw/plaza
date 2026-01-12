import { Redirect, Slot, useSegments } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { View, Text } from 'react-native';

export default function AuthRoutesLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  // Don't redirect if user is on sign-up screen - let it complete account creation first
  const isOnSignUpScreen = segments.includes('sign-up');
  
  if (isSignedIn && !isOnSignUpScreen) {
    return <Redirect href="/(tabs)/activity" />;
  }

  return <Slot />;
}

