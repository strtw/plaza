import { Slot, useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';

export function TabsLayoutWrapper() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'activity' | 'contacts' | 'profile'>('activity');

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      
      {/* Custom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'activity' ? styles.activeTab : null]}
          onPress={() => {
            setActiveTab('activity');
            router.push('/(tabs)/activity');
          }}
        >
          <Text style={[styles.tabText, activeTab === 'activity' ? styles.activeTabText : null]}>
            Activity
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'contacts' ? styles.activeTab : null]}
          onPress={() => {
            setActiveTab('contacts');
            router.push('/(tabs)');
          }}
        >
          <Text style={[styles.tabText, activeTab === 'contacts' ? styles.activeTabText : null]}>
            Contacts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'profile' ? styles.activeTab : null]}
          onPress={() => {
            setActiveTab('profile');
            router.push('/(tabs)/profile');
          }}
        >
          <Text style={[styles.tabText, activeTab === 'profile' ? styles.activeTabText : null]}>
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
    // Blue bar removed - only text color indicates active state
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

