import { Slot, useRouter, usePathname } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export function TabsLayoutWrapper() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      
      {/* Custom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, pathname === '/(tabs)/activity' ? styles.activeTab : null]}
          onPress={() => router.push('/(tabs)/activity')}
        >
          <Text style={[styles.tabText, pathname === '/(tabs)/activity' ? styles.activeTabText : null]}>
            Activity
          </Text>
        </TouchableOpacity>
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

