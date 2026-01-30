import { Slot, useRouter, usePathname, useSegments } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { HamburgerMenuProvider } from './HamburgerMenu';

export function TabsLayoutWrapper() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  
  // Only Activity is a tab; Profile and Contacts only via hamburger menu
  const [activeTab, setActiveTab] = useState<'activity'>('activity');

  useEffect(() => {
    if (pathname?.includes('/activity')) {
      setActiveTab('activity');
    }
  }, [pathname, segments]);

  return (
    <View style={{ flex: 1 }}>
      <HamburgerMenuProvider>
        <Slot />
      
      {/* Custom Tab Bar (Profile and User Management only via hamburger menu) */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'activity' ? styles.activeTab : null]}
          onPress={() => {
            setActiveTab('activity');
            router.push('/(tabs)/activity');
          }}
        >
          <Ionicons
            name={activeTab === 'activity' ? 'home' : 'home-outline'}
            size={24}
            color={activeTab === 'activity' ? '#007AFF' : '#666'}
          />
        </TouchableOpacity>
      </View>
      </HamburgerMenuProvider>
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

