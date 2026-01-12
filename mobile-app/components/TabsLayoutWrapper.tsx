import { Slot, useRouter, usePathname, useSegments, Redirect } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';

export function TabsLayoutWrapper() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  
  // Determine initial active tab from pathname
  const getInitialTab = (): 'activity' | 'contacts' | 'profile' => {
    if (pathname?.includes('/activity')) return 'activity';
    if (pathname?.includes('/profile')) return 'profile';
    if (pathname?.includes('/contacts')) return 'contacts';
    return 'activity'; // Default to activity
  };
  
  const [activeTab, setActiveTab] = useState<'activity' | 'contacts' | 'profile'>(getInitialTab);
  
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/0ab0fdbc-4e5d-4073-85b3-ce9f503293bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TabsLayoutWrapper.tsx:25',message:'Component mounted',data:{pathname:pathname,segments:segments,initialTab:getInitialTab(),activeTab:activeTab},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  }, []);
  // #endregion
  
  // No redirect needed - index.tsx now redirects to activity, contacts.tsx handles Contacts tab
  
  // Sync activeTab with pathname changes
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0ab0fdbc-4e5d-4073-85b3-ce9f503293bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TabsLayoutWrapper.tsx:32',message:'Pathname changed',data:{pathname:pathname,segments:segments,currentActiveTab:activeTab},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (pathname?.includes('/activity')) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0ab0fdbc-4e5d-4073-85b3-ce9f503293bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TabsLayoutWrapper.tsx:35',message:'Setting activeTab to activity',data:{pathname:pathname},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      setActiveTab('activity');
    } else if (pathname?.includes('/profile')) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0ab0fdbc-4e5d-4073-85b3-ce9f503293bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TabsLayoutWrapper.tsx:40',message:'Setting activeTab to profile',data:{pathname:pathname},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      setActiveTab('profile');
    } else if (pathname?.includes('/contacts')) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0ab0fdbc-4e5d-4073-85b3-ce9f503293bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TabsLayoutWrapper.tsx:45',message:'Setting activeTab to contacts',data:{pathname:pathname,segments:segments},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      setActiveTab('contacts');
    }
  }, [pathname, segments]);

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
            router.push('/(tabs)/contacts');
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

