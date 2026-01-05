import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../lib/api';
import { useRouter } from 'expo-router';

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
  });

  const useInviteMutation = useMutation({
    mutationFn: () => api.useInvite(inviteCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-statuses'] });
      onAccept();
      onClose();
      router.replace('/(tabs)');
    },
  });

  const handleAccept = () => {
    useInviteMutation.mutate();
  };

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
          ) : error || !invite ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>Invalid Invite</Text>
              <Text style={styles.errorText}>
                This invite code is invalid or has expired.
              </Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Invite Detected!</Text>
              <Text style={styles.subtitle}>
                {invite.inviter.name || invite.inviter.email} invited you to connect.
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
          )}
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

