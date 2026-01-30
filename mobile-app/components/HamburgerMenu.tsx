import React, { useState, useCallback, createContext, useContext } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  LayoutAnimation,
  UIManager,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useClerk } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LAYOUT_ANIMATION_DURATION_MS = 120;

const fastLayoutAnimation = {
  duration: LAYOUT_ANIMATION_DURATION_MS,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

type HamburgerContextValue = {
  menuVisible: boolean;
  openMenu: () => void;
  closeMenu: (onClosed?: () => void) => void;
};

const HamburgerContext = createContext<HamburgerContextValue | null>(null);

export function HamburgerMenuProvider({ children }: { children: React.ReactNode }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();
  const { signOut } = useClerk();
  const insets = useSafeAreaInsets();

  const openMenu = useCallback(() => {
    LayoutAnimation.configureNext(fastLayoutAnimation);
    setMenuVisible(true);
  }, []);

  const closeMenu = useCallback((onClosed?: () => void) => {
    LayoutAnimation.configureNext(fastLayoutAnimation);
    setMenuVisible(false);
    if (onClosed) {
      setTimeout(onClosed, LAYOUT_ANIMATION_DURATION_MS);
    }
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const handleMenuItem = useCallback(
    (action: () => void) => {
      closeMenu(() => action());
    },
    [closeMenu]
  );

  return (
    <HamburgerContext.Provider value={{ menuVisible, openMenu, closeMenu }}>
      {children}
      {/* Full-screen overlay: always mounted, width 0 when closed; LayoutAnimation handles open/close */}
      <View
        style={[
          styles.overlayRoot,
          {
            width: menuVisible ? screenWidth : 0,
            pointerEvents: menuVisible ? 'auto' : 'none',
          },
        ]}
        collapsable={false}
      >
        <View style={[styles.menuPanel, { paddingTop: insets.top + 16 }]}>
          <Pressable style={styles.closeButton} onPress={() => closeMenu()} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color="#000" />
          </Pressable>
          <Pressable
            style={styles.menuItem}
            onPress={() => handleMenuItem(() => router.push('/(tabs)/profile'))}
          >
            <Ionicons name="person-outline" size={24} color="#000" />
            <Text style={styles.menuItemText}>Account</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => handleMenuItem(() => router.push('/(tabs)/groups'))}
          >
            <Ionicons name="people-outline" size={24} color="#000" />
            <Text style={styles.menuItemText}>Groups</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => handleMenuItem(() => router.push('/(tabs)/contacts'))}
          >
            <Ionicons name="contacts-outline" size={24} color="#000" />
            <Text style={styles.menuItemText}>Manage Users</Text>
          </Pressable>

          <View style={styles.menuDivider} />

          <Pressable style={styles.signOutButton} onPress={() => handleMenuItem(handleSignOut)}>
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
      </View>
    </HamburgerContext.Provider>
  );
}

export function HamburgerMenu() {
  const ctx = useContext(HamburgerContext);
  if (!ctx) return null;
  return (
    <Pressable onPress={ctx.openMenu} style={styles.hamburgerButton} hitSlop={10}>
      <Ionicons name="menu" size={28} color="#000" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hamburgerButton: {
    padding: 8,
    marginRight: 8,
  },
  overlayRoot: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 1000,
    overflow: 'hidden',
  },
  menuPanel: {
    flex: 1,
    width: '100%',
    backgroundColor: '#fff',
    padding: 20,
  },
  closeButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  menuItemText: {
    fontSize: 18,
    color: '#000',
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
    marginTop: 'auto',
  },
  signOutText: {
    fontSize: 18,
    color: '#FF3B30',
    fontWeight: '600',
  },
});
