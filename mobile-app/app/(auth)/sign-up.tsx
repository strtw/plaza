import React from 'react';
import { Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useSignUp, useAuth } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { createApi } from '../../lib/api';

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { getToken } = useAuth();
  const router = useRouter();
  const [stage, setStage] = React.useState<'name' | 'phone' | 'verify'>('name');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
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


  const onNameContinue = () => {
    if (!firstName.trim()) {
      setError('Please enter your first name');
      return;
    }
    if (!lastName.trim()) {
      setError('Please enter your last name');
      return;
    }
    setError('');
    setStage('phone');
  };

  const onPhoneContinue = async () => {
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
      
      // Create sign-up attempt with phone number
      await signUp.create({
        phoneNumber: normalizedPhone,
      });

      // If username is required, generate one from phone number
      // This should be done before verification to avoid missing_requirements
      if (signUp.status === 'missing_requirements' && signUp.missingFields?.includes('username')) {
        const defaultUsername = `user_${normalizedPhone.replace(/\D/g, '').slice(-8)}`;
        await signUp.update({ username: defaultUsername });
      }

      // Prepare phone code verification
      await signUp.preparePhoneNumberVerification({ strategy: 'phone_code' });

      setStage('verify');
    } catch (err: any) {
      console.error('Sign up error:', JSON.stringify(err, null, 2));
      const errorMessage = err?.errors?.[0]?.message || err?.message || 'Failed to send verification code. Please try again.';
      setError(errorMessage);
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
      const completeSignUp = await signUp.attemptPhoneNumberVerification({
        code,
      });

      console.log('Sign up status:', completeSignUp.status);
      console.log('Created session ID:', completeSignUp.createdSessionId);
      console.log('Missing fields:', completeSignUp.missingFields);

        if (completeSignUp.status === 'complete') {
          // Store session ID and create account directly
          const sessionId = completeSignUp.createdSessionId;
          if (!sessionId) {
            setError('Session not available. Please try again.');
            setLoading(false);
            return;
          }

          // Activate the session first
          await setActive({ session: sessionId });

          // Create account with firstName and lastName
          // The API will handle waiting for the token
          try {
            const api = createApi(getToken);
            await api.createAccount(firstName.trim(), lastName.trim());
            console.log('Account created with firstName:', firstName.trim(), 'lastName:', lastName.trim());

            // Navigate to app immediately after successful account creation
            router.replace('/(tabs)/activity');
          } catch (error: any) {
            console.error('Error creating account:', error);
            setError(error.message || 'Failed to create account. Please try again.');
            setLoading(false);
            // Don't navigate on error - keep user on sign-up screen to retry
          }
          return;
      } else if (completeSignUp.status === 'missing_requirements') {
        // Check what's missing and handle it
        const missingFields = completeSignUp.missingFields || [];
        console.log('Missing requirements:', missingFields);
        
        // If username is required, generate one and update
        if (missingFields.includes('username')) {
          const defaultUsername = `user_${phoneNumber.replace(/\D/g, '').slice(-8)}`;
          try {
            // Update sign-up with username
            await signUp.update({ username: defaultUsername });
            
            // After updating, check if we can complete
            // The verification code was already used, so we need to check current status
            // Use type assertion to bypass TypeScript's type narrowing
            if ((signUp.status as string) === 'complete') {
              const sessionId = signUp.createdSessionId;
              if (!sessionId) {
                setError('Session not available. Please try again.');
                setLoading(false);
                return;
              }

              // Activate the session and create account
              await setActive({ session: sessionId });

              try {
                const api = createApi(getToken);
                await api.createAccount(firstName.trim(), lastName.trim());
                console.log('Account created with firstName:', firstName.trim(), 'lastName:', lastName.trim());
                // Navigate immediately after successful account creation
                router.replace('/(tabs)/activity');
              } catch (error: any) {
                console.error('Error creating account:', error);
                setError(error.message || 'Failed to create account. Please try again.');
                setLoading(false);
                // Don't navigate on error - keep user on sign-up screen to retry
              }
              return;
            } else {
              setError('Please configure Clerk dashboard: Go to User & Authentication → Username and set it to "Optional" or "Disabled"');
            }
          } catch (updateErr: any) {
            console.error('Update error:', updateErr);
            setError('Unable to complete sign-up. Please configure Clerk to make username optional.');
          }
        } else {
          setError(`Missing requirements: ${missingFields.join(', ')}. Please configure Clerk dashboard.`);
        }
      } else {
        setError(`Sign up status: ${completeSignUp.status}. Please try again.`);
      }
    } catch (err: any) {
      // Handle "already verified" error - means verification worked but sign-up needs completion
      if (err?.errors?.[0]?.code === 'verification_already_verified') {
        console.log('Verification already done, checking sign-up status...');
        // Check current sign-up status
        if (signUp.status === 'missing_requirements') {
          const missingFields = signUp.missingFields || [];
          if (missingFields.includes('username')) {
            const defaultUsername = `user_${phoneNumber.replace(/\D/g, '').slice(-8)}`;
            try {
              await signUp.update({ username: defaultUsername });
            } catch (updateErr: any) {
              console.error('Update error:', updateErr);
            }
          }
          // Check if complete now - use type assertion to bypass type narrowing
          if ((signUp.status as string) === 'complete') {
            const sessionId = signUp.createdSessionId;
            if (!sessionId) {
              setError('Session not available. Please try again.');
              setLoading(false);
              return;
            }

            // Activate the session and create account
            await setActive({ session: sessionId });

            try {
              const api = createApi(getToken);
              await api.createAccount(firstName.trim(), lastName.trim());
              console.log('Account created with firstName:', firstName.trim(), 'lastName:', lastName.trim());
              // Navigate immediately after successful account creation
              router.replace('/(tabs)/activity');
            } catch (error: any) {
              console.error('Error creating account:', error);
              setError(error.message || 'Failed to create account. Please try again.');
              setLoading(false);
              // Don't navigate on error - keep user on sign-up screen to retry
            }
            return;
          } else {
            setError('Please configure Clerk to make username optional in dashboard settings.');
          }
        } else if (signUp.status === 'complete') {
          const sessionId = signUp.createdSessionId;
          if (!sessionId) {
            setError('Session not available. Please try again.');
            setLoading(false);
            return;
          }

          // Activate the session and create account
          await setActive({ session: sessionId });

          try {
            const api = createApi(getToken);
            await api.createAccount(firstName.trim(), lastName.trim());
            console.log('Account created with firstName:', firstName.trim(), 'lastName:', lastName.trim());
            // Navigate immediately after successful account creation
            router.replace('/(tabs)/activity');
          } catch (error: any) {
            console.error('Error creating account:', error);
            setError(error.message || 'Failed to create account. Please try again.');
            setLoading(false);
            // Don't navigate on error - keep user on sign-up screen to retry
          }
          return;
        } else {
          setError('Sign-up verification complete but unable to finish. Please check Clerk configuration.');
        }
      } else if (err?.errors?.[0]?.code === 'session_exists' || err?.message?.includes('session') || err?.message?.includes('already')) {
        // Handle "session exists" error - user might already be signed up
        console.log('Session already exists, checking if we can proceed...');
        
        // Check if sign-up is complete
        if (signUp.status === 'complete') {
          const sessionId = signUp.createdSessionId;
          if (sessionId) {
            // Try to activate and create account
            try {
              await setActive({ session: sessionId });
              const api = createApi(getToken);
              await api.createAccount(firstName.trim(), lastName.trim());
              console.log('Account created after session exists error');
              router.replace('/(tabs)/activity');
              return;
            } catch (error: any) {
              // If account creation fails, user might already exist - try to navigate anyway
              console.log('Account might already exist, navigating to app...');
              router.replace('/(tabs)/activity');
              return;
            }
          }
        }
        
        setError('Your account may already exist. Please try signing in instead.');
      } else {
        console.error('Verification error:', JSON.stringify(err, null, 2));
        const errorMessage = err?.errors?.[0]?.message || err?.message || 'Invalid verification code. Please try again.';
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' }}>
      {stage === 'name' ? (
        <>
          <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#000' }}>
            What's your name?
          </Text>
          
          <Text style={{ color: '#666', fontSize: 14, marginBottom: 20, textAlign: 'center' }}>
            This is how others will see you on Plaza
          </Text>

          {error ? (
            <View style={{ backgroundColor: '#fee', padding: 12, marginBottom: 10, borderRadius: 4, borderWidth: 1, borderColor: '#fcc' }}>
              <Text style={{ color: '#c00', textAlign: 'center' }}>{error}</Text>
            </View>
          ) : null}

          <TextInput
            value={firstName}
            placeholder="First Name"
            placeholderTextColor="#999"
            onChangeText={(text) => setFirstName(text)}
            autoCapitalize="words"
            autoFocus
            style={{
              borderWidth: 1,
              borderColor: '#ddd',
              backgroundColor: '#fff',
              color: '#000',
              padding: 12,
              marginBottom: 10,
              borderRadius: 4,
              fontSize: 16,
            }}
          />

          <TextInput
            value={lastName}
            placeholder="Last Name"
            placeholderTextColor="#999"
            onChangeText={(text) => setLastName(text)}
            autoCapitalize="words"
            style={{
              borderWidth: 1,
              borderColor: '#ddd',
              backgroundColor: '#fff',
              color: '#000',
              padding: 12,
              marginBottom: 10,
              borderRadius: 4,
              fontSize: 16,
            }}
          />

          <TouchableOpacity
            onPress={onNameContinue}
            disabled={!firstName.trim() || !lastName.trim()}
            style={{
              backgroundColor: (!firstName.trim() || !lastName.trim()) ? '#999' : '#007AFF',
              padding: 15,
              marginBottom: 10,
              borderRadius: 4,
              opacity: (!firstName.trim() || !lastName.trim()) ? 0.6 : 1,
            }}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
              Continue
            </Text>
          </TouchableOpacity>

          <Link href="/(auth)/sign-in" style={{ textAlign: 'center' }}>
            <Text style={{ color: '#0066cc' }}>Already have an account? Sign in</Text>
          </Link>
        </>
      ) : stage === 'phone' ? (
        <>
          <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', color: '#000' }}>
            Enter Your Phone Number
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
            <View style={{ backgroundColor: '#fee', padding: 12, marginBottom: 10, borderRadius: 4, borderWidth: 1, borderColor: '#fcc' }}>
              <Text style={{ color: '#c00', textAlign: 'center' }}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={onPhoneContinue}
            disabled={loading || !phoneNumber.trim()}
            style={{
              backgroundColor: (loading || !phoneNumber.trim()) ? '#999' : '#007AFF',
              padding: 15,
              marginBottom: 10,
              borderRadius: 4,
              opacity: (loading || !phoneNumber.trim()) ? 0.6 : 1,
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

          <TouchableOpacity
            onPress={() => {
              setStage('name');
              setError('');
            }}
            style={{ marginTop: 10 }}
          >
            <Text style={{ color: '#0066cc', textAlign: 'center' }}>Back</Text>
          </TouchableOpacity>
        </>
      ) : stage === 'verify' ? (
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
                Verify
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setStage('phone');
              setCode('');
              setError('');
            }}
            style={{ marginTop: 10 }}
          >
            <Text style={{ color: '#0066cc', textAlign: 'center' }}>Change phone number</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}

