import { View, Text, Pressable, StyleSheet, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { createApi } from '../../lib/api';
import { SignOutButton } from '../../components/SignOutButton';
import { getFullName } from '../../lib/types';
import { Redirect, useRouter } from 'expo-router';
import { useAuth, useClerk } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HamburgerMenu } from '../../components/HamburgerMenu';

function ProfileScreenContent() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { signOut } = useClerk();
  const router = useRouter();
  const api = createApi(getToken);
  const insets = useSafeAreaInsets();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Fetch current user data
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: api.getOrCreateMe,
    enabled: isLoaded && isSignedIn,
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: async () => {
      // Close modal
      setShowDeleteModal(false);
      setDeleteConfirmText('');
      
      // Sign out from Clerk (account is already deleted, but we need to clear the session)
      try {
        await signOut();
        router.replace('/(auth)/sign-in');
      } catch (error) {
        // Even if signOut fails, redirect to sign-in
        router.replace('/(auth)/sign-in');
      }
    },
    onError: (error: any) => {
      Alert.alert(
        'Error',
        error.message || 'Failed to delete account. Please try again.'
      );
    },
  });

  // Avatar helper functions
  const getInitials = () => {
    if (!currentUser) return '?';
    const fullName = getFullName(currentUser);
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = () => {
    if (!currentUser) return '#E5E5E5';
    const fullName = getFullName(currentUser);
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80'
    ];
    const index = fullName.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const isDeleteEnabled = deleteConfirmText === 'DELETE';

  return (
    <View style={styles.container}>
      <View style={[styles.headerContainer, { paddingTop: insets.top + 16 }]}>
        <HamburgerMenu />
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: getAvatarColor() }]}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
        </View>

        {/* Name */}
        <Text style={styles.nameText}>
          {currentUser ? getFullName(currentUser) : 'Loading...'}
        </Text>

        {/* Sign Out Button */}
        <SignOutButton />
      </View>

      {/* Delete Account Button - Fixed at bottom */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 10, paddingTop: 20 }]}>
        <Pressable
          style={styles.deleteAccountButton}
          onPress={() => {
            setShowDeleteModal(true);
          }}
        >
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </Pressable>
      </View>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirmText('');
        }}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => {
                setShowDeleteModal(false);
                setDeleteConfirmText('');
              }}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color="#000" />
            </Pressable>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <View style={styles.closeButton} />
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.modalWarningText}>
              Are you sure? This action cannot be undone. Type "DELETE" to continue.
            </Text>

            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type DELETE"
              placeholderTextColor="#999"
              style={styles.deleteInput}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <Pressable
              style={[
                styles.deleteButton,
                (!isDeleteEnabled || deleteAccountMutation.isPending) && styles.deleteButtonDisabled
              ]}
              onPress={() => {
                if (isDeleteEnabled && !deleteAccountMutation.isPending) {
                  deleteAccountMutation.mutate();
                }
              }}
              disabled={!isDeleteEnabled || deleteAccountMutation.isPending}
            >
              {deleteAccountMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[
                  styles.deleteButtonText,
                  (!isDeleteEnabled || deleteAccountMutation.isPending) && styles.deleteButtonTextDisabled
                ]}>
                  Delete
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function ProfileScreen() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Delay rendering until after mount to ensure ClerkProvider is ready
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading...</Text>
      </View>
    );
  }

  return <ProfileScreenContent />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
    minHeight: 60,
  },
  headerTitle: {
    flex: 1,
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '600',
    color: '#fff',
  },
  nameText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 40,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  deleteAccountButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FF3B30',
    backgroundColor: 'transparent',
    alignItems: 'center',
    alignSelf: 'center',
    minWidth: 200,
  },
  deleteAccountText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    minHeight: 60,
  },
  closeButton: {
    padding: 4,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalWarningText: {
    fontSize: 16,
    color: '#000',
    marginBottom: 24,
    lineHeight: 24,
  },
  deleteInput: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
    marginBottom: 24,
  },
  deleteButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
  },
  deleteButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  deleteButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  deleteButtonTextDisabled: {
    color: '#999',
  },
});

