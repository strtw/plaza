import React from 'react';
import { Text, TextInput, TouchableOpacity, View, ActivityIndicator, Keyboard, ScrollView, Pressable } from 'react-native';
import { useSignIn, useAuth } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { createApi } from '../../lib/api';

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { getToken } = useAuth();
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  // Normalize phone number to E.164 format
  const normalizePhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('1') && digits.length === 11) {
      return `+${digits}`;
    }
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    return phone.startsWith('+') ? phone : `+1${digits}`;
  };


  const onSignInPress = async () => {
    if (!isLoaded) {
      setError('Clerk is not loaded yet. Please wait...');
      return;
    }

    if (!phoneNumber) {
      setError('Please enter your phone number');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const normalizedPhone = normalizePhone(phoneNumber);
      
      // Create sign-in attempt
      const signInAttempt = await signIn.create({
        identifier: normalizedPhone,
      });

      // Find the phone_code factor and get the phone_number_id
      const phoneCodeFactor = signInAttempt.supportedFirstFactors?.find(
        (factor: any) => factor.strategy === 'phone_code'
      ) as any;

      if (!phoneCodeFactor || !phoneCodeFactor.phoneNumberId) {
        throw new Error('Phone code verification not available for this account');
      }

      // Prepare phone code verification with phone_number_id
      await signIn.prepareFirstFactor({
        strategy: 'phone_code',
        phoneNumberId: phoneCodeFactor.phoneNumberId,
      });

      setPendingVerification(true);
    } catch (err: any) {
      console.error('Sign in error:', JSON.stringify(err, null, 2));
      const errorMessage = err?.errors?.[0]?.message || err?.message || 'Failed to send verification code. Please try again.';
      setError(errorMessage);
      // Dismiss keyboard when error occurs so user can see the sign up link
      Keyboard.dismiss();
    } finally {
      setLoading(false);
    }
  };

  const onPressVerify = async () => {
    if (!isLoaded) {
      setError('Clerk is not loaded yet. Please wait...');
      return;
    }

    if (!code) {
      setError('Please enter the verification code');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const completeSignIn = await signIn.attemptFirstFactor({
        strategy: 'phone_code',
        code,
      });

      console.log('Sign in status:', completeSignIn.status);
      console.log('Created session ID:', completeSignIn.createdSessionId);

      if (completeSignIn.status === 'complete') {
        // Set the active session - this will trigger the auth layout to redirect
        await setActive({ session: completeSignIn.createdSessionId });

        // Create user in Plaza database if they don't exist
        // This must complete before redirecting to prevent 404 errors
        // The API will handle waiting for the token
        try {
          const api = createApi(getToken);
          await api.getOrCreateMe();
          console.log('User created/updated in Plaza database');
        } catch (error: any) {
          console.error('Error creating user in Plaza database:', error);
          // Don't block sign-in if this fails - user can still use the app
        }

        // The auth layout will automatically redirect when isSignedIn becomes true
        // But we'll also manually navigate as a fallback
        setTimeout(() => {
          router.replace('/(tabs)/activity');
        }, 200);
      } else {
        setError('Sign in is not complete. Please try again.');
      }
    } catch (err: any) {
      console.error('Verification error:', JSON.stringify(err, null, 2));
      const errorMessage = err?.errors?.[0]?.message || err?.message || 'Invalid verification code. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable 
      style={{ flex: 1, backgroundColor: '#fff' }}
      onPress={Keyboard.dismiss}
    >
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {!pendingVerification ? (
          <>
            <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', color: '#000' }}>
              Sign In
            </Text>
            
            <TextInput
              value={phoneNumber}
              placeholder="Phone Number (e.g., +1234567890)"
              placeholderTextColor="#999"
              onChangeText={(phone) => setPhoneNumber(phone)}
              keyboardType="phone-pad"
              autoComplete="tel"
              style={{
                borderWidth: 1,
                borderColor: '#ddd',
                backgroundColor: '#fff',
                color: '#000',
                padding: 12,
                marginBottom: 10,
                borderRadius: 4,
              }}
            />

            {error ? (
              <Pressable 
                onPress={Keyboard.dismiss}
                style={{ backgroundColor: '#fee', padding: 12, marginBottom: 10, borderRadius: 4, borderWidth: 1, borderColor: '#fcc' }}
              >
                <Text style={{ color: '#c00', textAlign: 'center' }}>{error}</Text>
              </Pressable>
            ) : null}

            <TouchableOpacity
              onPress={onSignInPress}
              disabled={loading}
              style={{
                backgroundColor: loading ? '#999' : '#007AFF',
                padding: 15,
                borderRadius: 4,
                opacity: loading ? 0.6 : 1,
                marginBottom: 10,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
                  Send Verification Code
                </Text>
              )}
            </TouchableOpacity>

            <Link href="/(auth)/sign-up" style={{ marginTop: 20, textAlign: 'center' }}>
              <Text style={{ color: '#0066cc' }}>Don't have an account? Sign up</Text>
            </Link>
          </>
        ) : (
        <>
          <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#000' }}>
            Verify Phone Number
          </Text>
          
          <Text style={{ color: '#666', fontSize: 14, marginBottom: 20, textAlign: 'center' }}>
            We sent a verification code to{'\n'}
            <Text style={{ fontWeight: '600', color: '#000' }}>{phoneNumber}</Text>
          </Text>

          {error ? (
            <View style={{ backgroundColor: '#fee', padding: 12, marginBottom: 10, borderRadius: 4, borderWidth: 1, borderColor: '#fcc' }}>
              <Text style={{ color: '#c00', textAlign: 'center' }}>{error}</Text>
            </View>
          ) : null}

          <TextInput
            value={code}
            placeholder="Enter 6-digit code"
            placeholderTextColor="#999"
            onChangeText={(code) => setCode(code)}
            keyboardType="number-pad"
            maxLength={6}
            style={{
              borderWidth: 1,
              borderColor: '#ddd',
              backgroundColor: '#fff',
              color: '#000',
              padding: 12,
              marginBottom: 10,
              borderRadius: 4,
              fontSize: 18,
              letterSpacing: 4,
              textAlign: 'center',
            }}
          />

          <TouchableOpacity
            onPress={onPressVerify}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#999' : '#007AFF',
              padding: 15,
              borderRadius: 4,
              opacity: loading ? 0.6 : 1,
              marginBottom: 10,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
                Verify & Sign In
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setPendingVerification(false);
              setCode('');
              setError('');
            }}
            style={{ marginTop: 10 }}
          >
            <Text style={{ color: '#0066cc', textAlign: 'center' }}>Change phone number</Text>
          </TouchableOpacity>
        </>
        )}
      </ScrollView>
    </Pressable>
  );
}
