import { Slot, useRouter, usePathname, useSegments } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { createApi } from '../lib/api';
import { HamburgerMenuProvider } from './HamburgerMenu';

export function TabsLayoutWrapper() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const api = createApi(getToken);
  
  // Determine initial active tab from pathname
  const getInitialTab = (): 'activity' | 'contacts' | 'profile' => {
    if (pathname?.includes('/activity')) return 'activity';
    if (pathname?.includes('/profile')) return 'profile';
    if (pathname?.includes('/contacts')) return 'contacts';
    return 'activity'; // Default to activity
  };
  
  const [activeTab, setActiveTab] = useState<'activity' | 'contacts' | 'profile'>(getInitialTab);
  
  // Query pending friends for badge count
  const { data: pendingFriends = [] } = useQuery({
    queryKey: ['pending-friends'],
    queryFn: api.getPendingFriends,
    enabled: isLoaded && isSignedIn,
    refetchInterval: 30000, // Poll every 30 seconds
  });
  
  const pendingCount = (pendingFriends as any[]).length;
  
  // Sync activeTab with pathname changes
  useEffect(() => {
    if (pathname?.includes('/activity')) {
      setActiveTab('activity');
    } else if (pathname?.includes('/profile')) {
      setActiveTab('profile');
    } else if (pathname?.includes('/contacts')) {
      setActiveTab('contacts');
    }
  }, [pathname, segments]);

  return (
    <View style={{ flex: 1 }}>
      <HamburgerMenuProvider>
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
            router.push('/(tabs)/contacts');
          }}
        >
          <View style={{ position: 'relative' }}>
            <Text style={[styles.tabText, activeTab === 'contacts' ? styles.activeTabText : null]}>
              Contacts
            </Text>
            {pendingCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {pendingCount > 99 ? '99+' : pendingCount}
                </Text>
              </View>
            )}
          </View>
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
  badge: {
    position: 'absolute',
    top: -8,
    right: -12,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});

