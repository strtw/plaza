import { useClipboardInvite } from '../hooks/useClipboardInvite';
import { InviteDetectedModal } from './InviteDetectedModal';
import { useAuth } from '@clerk/clerk-expo';

export function InviteDetector() {
  const { isLoaded, isSignedIn } = useAuth();
  const { detectedCode, clearDetectedCode } = useClipboardInvite();

  // Only show invite detection when Clerk is loaded and user is signed in
  if (!isLoaded || !isSignedIn || !detectedCode) {
    return null;
  }

  const handleClose = () => {
    clearDetectedCode().catch(console.error);
  };

  return (
    <InviteDetectedModal
      visible={!!detectedCode}
      inviteCode={detectedCode}
      onClose={handleClose}
      onAccept={handleClose}
    />
  );
}

