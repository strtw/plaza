import { Slot, Redirect, useRouter, usePathname } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function TabsLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      
      {/* Custom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, pathname === '/(tabs)' || pathname === '/(tabs)/' ? styles.activeTab : null]}
          onPress={() => router.push('/(tabs)')}
        >
          <Text style={[styles.tabText, pathname === '/(tabs)' || pathname === '/(tabs)/' ? styles.activeTabText : null]}>
            Contacts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, pathname === '/(tabs)/profile' ? styles.activeTab : null]}
          onPress={() => router.push('/(tabs)/profile')}
        >
          <Text style={[styles.tabText, pathname === '/(tabs)/profile' ? styles.activeTabText : null]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingBottom: 10,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  activeTab: {
    borderTopWidth: 2,
    borderTopColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
});

