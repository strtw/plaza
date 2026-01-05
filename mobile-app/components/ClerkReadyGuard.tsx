import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

export function ClerkReadyGuard({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  
  useEffect(() => {
    // Longer delay to ensure ClerkProvider is fully mounted and initialized
    // Expo Router evaluates routes during static analysis, so we need extra time
    const timer = setTimeout(() => {
      setReady(true);
    }, 800);
    
    return () => clearTimeout(timer);
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading...</Text>
      </View>
    );
  }

  return <>{children}</>;
}

