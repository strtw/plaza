import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useClerk } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const OVERLAY_CLOSE_MS = 150; // Gray overlay fades out in half the time (was ~300ms)

export function HamburgerMenu() {
  const [menuVisible, setMenuVisible] = useState(false);
  const router = useRouter();
  const { signOut } = useClerk();
  const insets = useSafeAreaInsets();
  const slideAnim = React.useRef(new Animated.Value(-300)).current;
  const overlayOpacity = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (menuVisible) {
      // Reset and animate in when menu becomes visible
      slideAnim.setValue(-300);
      overlayOpacity.setValue(1);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    }
  }, [menuVisible]);

  const openMenu = () => {
    setMenuVisible(true);
  };

  const closeMenu = () => {
    // Fade out gray overlay in half the time so background isn't gray as long
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: OVERLAY_CLOSE_MS,
      useNativeDriver: true,
    }).start();
    Animated.spring(slideAnim, {
      toValue: -300,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start(() => {
      setMenuVisible(false);
    });
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const handleMenuItem = (action: () => void) => {
    closeMenu();
    setTimeout(action, 300); // Wait for animation to close
  };

  return (
    <>
      <Pressable onPress={openMenu} style={styles.hamburgerButton} hitSlop={10}>
        <Ionicons name="menu" size={28} color="#000" />
      </Pressable>

      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={closeMenu}
      >
        <View style={styles.overlayContainer}>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} pointerEvents="box-none">
            <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
          </Animated.View>
          <Animated.View
            style={[
              styles.menuContainer,
              { paddingTop: insets.top + 16 },
              { transform: [{ translateX: slideAnim }] },
            ]}
            pointerEvents="box-none"
          >
            <View style={styles.menuContent} pointerEvents="auto">
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
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hamburgerButton: {
    padding: 8,
    marginRight: 8,
  },
  overlayContainer: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
  },
  menuContent: {
    flex: 1,
    padding: 20,
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
