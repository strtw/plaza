import React, { useEffect } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../lib/api';
import { useRouter } from 'expo-router';
import { getFullName } from '../lib/types';

interface InviteDetectedModalProps {
  visible: boolean;
  inviteCode: string;
  onClose: () => void;
  onAccept: () => void;
}

export function InviteDetectedModal({ visible, inviteCode, onClose, onAccept }: InviteDetectedModalProps) {
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: invite, isLoading, error } = useQuery({
    queryKey: ['invite', inviteCode],
    queryFn: () => api.getInvite(inviteCode),
    enabled: visible && !!inviteCode,
    retry: false, // Don't retry on 404 errors
    // Silently handle 404 errors - they're expected when clipboard contains invalid codes
    onError: (err: any) => {
      // Only log non-404 errors
      if (!err?.message?.includes('404') && !err?.message?.includes('not found')) {
        console.error('Error fetching invite:', err);
      }
    },
  });

  const useInviteMutation = useMutation({
    mutationFn: () => api.useInvite(inviteCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['friends-statuses'] });
      onAccept();
      onClose();
      router.replace('/(tabs)');
    },
  });

  const handleAccept = () => {
    useInviteMutation.mutate();
  };

  // Automatically close modal if invite is not found (404) - false positive from clipboard
  useEffect(() => {
    if (error && !isLoading) {
      const isNotFound = error?.message?.includes('404') || 
                        error?.message?.includes('not found') ||
                        error?.message?.includes('Not Found');
      
      if (isNotFound) {
        // Silently close modal for 404 errors (false positive from clipboard detection)
        onClose();
      }
    }
  }, [error, isLoading, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Checking invite...</Text>
            </View>
          ) : invite ? (
            <>
              <Text style={styles.title}>Invite Detected!</Text>
              <Text style={styles.subtitle}>
                {getFullName(invite.inviter)} invited you to connect.
              </Text>

              <View style={styles.buttonContainer}>
                <Pressable
                  onPress={handleAccept}
                  style={[styles.button, styles.acceptButton]}
                  disabled={useInviteMutation.isPending}
                >
                  <Text style={styles.acceptButtonText}>
                    {useInviteMutation.isPending ? 'Accepting...' : 'Accept Invite'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={onClose}
                  style={[styles.button, styles.declineButton]}
                  disabled={useInviteMutation.isPending}
                >
                  <Text style={styles.declineButtonText}>Maybe Later</Text>
                </Pressable>
              </View>
            </>
          ) : error ? (
            // Only show error for non-404 errors (404s are handled by useEffect to close modal)
            (() => {
              const isNotFound = error?.message?.includes('404') || 
                                error?.message?.includes('not found') ||
                                error?.message?.includes('Not Found');
              
              // Don't render anything for 404s - modal will be closed by useEffect
              if (isNotFound) {
                return null;
              }
              
              // For other errors, show error message
              return (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorTitle}>Invalid Invite</Text>
                  <Text style={styles.errorText}>
                    This invite code is invalid or has expired.
                  </Text>
                  <Pressable onPress={onClose} style={styles.closeButton}>
                    <Text style={styles.closeButtonText}>Close</Text>
                  </Pressable>
                </View>
              );
            })()
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#c00',
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  declineButton: {
    backgroundColor: '#f0f0f0',
  },
  declineButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  closeButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

