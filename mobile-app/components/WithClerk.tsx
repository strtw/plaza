import { ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { View, Text, ActivityIndicator } from 'react-native';

interface WithClerkProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function WithClerk({ children, fallback }: WithClerkProps) {
  try {
    const { isLoaded } = useAuth();
    
    if (!isLoaded) {
      return fallback || (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text>Loading...</Text>
        </View>
      );
    }
    
    return <>{children}</>;
  } catch (error) {
    // Clerk not ready yet - return fallback
    return fallback || (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Initializing...</Text>
      </View>
    );
  }
}

