import { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@clerk/clerk-expo';

// Invite codes are 32 character hex strings (16 bytes = 32 hex chars)
const INVITE_CODE_REGEX = /^[a-f0-9]{32}$/i;

export function useClipboardInvite() {
  const { isSignedIn, isLoaded } = useAuth();
  const [detectedCode, setDetectedCode] = useState<string | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Only check clipboard if user is signed in and loaded
    if (!isLoaded || !isSignedIn) {
      return;
    }

    // Check clipboard once on app launch
    if (!hasChecked) {
      const checkClipboard = async () => {
        try {
          const clipboardText = await Clipboard.getStringAsync();
          
          // Check if clipboard contains a valid invite code
          // Look for 32 character hex string (might be part of a longer message)
          const match = clipboardText.match(INVITE_CODE_REGEX);
          
          if (match) {
            const code = match[0];
            setDetectedCode(code);
          }
          
          setHasChecked(true);
        } catch (error) {
          console.error('Error checking clipboard:', error);
          setHasChecked(true);
        }
      };

      checkClipboard();
    }
  }, [isLoaded, isSignedIn, hasChecked]);

  const clearDetectedCode = async () => {
    setDetectedCode(null);
    // Clear the clipboard after using the code
    await Clipboard.setStringAsync('');
  };

  return {
    detectedCode,
    hasChecked,
    clearDetectedCode,
  };
}

