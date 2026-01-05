import { View, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { TabsLayoutWrapper } from '../../components/TabsLayoutWrapper';

export default function TabsLayout() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Delay rendering until after mount to ensure ClerkProvider is ready
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return <TabsLayoutWrapper />;
}

