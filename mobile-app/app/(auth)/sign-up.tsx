import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSignUp } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const onSignUpPress = async () => {
    if (!isLoaded) {
      setError('Clerk is not loaded yet. Please wait...');
      return;
    }

    if (!emailAddress || !password) {
      setError('Please enter both email and password');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await signUp.create({
        emailAddress,
        password,
      });

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });

      setPendingVerification(true);
    } catch (err: any) {
      console.error('Sign up error:', JSON.stringify(err, null, 2));
      const errorMessage = err?.errors?.[0]?.message || err?.message || 'Failed to create account. Please try again.';
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
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId });
        router.replace('/(tabs)');
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
    <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' }}>
      {!pendingVerification ? (
        <>
          <TextInput
            autoCapitalize="none"
            value={emailAddress}
            placeholder="Email"
            placeholderTextColor="#999"
            onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
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
          <TextInput
            value={password}
            placeholder="Password"
            placeholderTextColor="#999"
            secureTextEntry
            onChangeText={(password) => setPassword(password)}
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
            onPress={onSignUpPress}
            disabled={!!loading}
            style={{
              backgroundColor: loading ? '#999' : 'blue',
              padding: 15,
              marginBottom: 10,
              borderRadius: 4,
              opacity: loading ? 0.6 : 1,
            }}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </Text>
          </TouchableOpacity>

          <Link href="/(auth)/sign-in" style={{ textAlign: 'center' }}>
            <Text style={{ color: '#0066cc' }}>Already have an account? Sign in</Text>
          </Link>
        </>
      ) : (
        <>
          <Text style={{ color: '#000', fontSize: 16, marginBottom: 20, textAlign: 'center' }}>
            We sent a verification code to{'\n'}
            <Text style={{ fontWeight: '600' }}>{emailAddress}</Text>
          </Text>

          {error ? (
            <View style={{ backgroundColor: '#fee', padding: 12, marginBottom: 10, borderRadius: 4, borderWidth: 1, borderColor: '#fcc' }}>
              <Text style={{ color: '#c00', textAlign: 'center' }}>{error}</Text>
            </View>
          ) : null}

          <TextInput
            value={code}
            placeholder="Enter verification code"
            placeholderTextColor="#999"
            onChangeText={(code) => setCode(code)}
            keyboardType="number-pad"
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

          <TouchableOpacity
            onPress={onPressVerify}
            disabled={!!loading}
            style={{
              backgroundColor: loading ? '#999' : 'blue',
              padding: 15,
              borderRadius: 4,
              opacity: loading ? 0.6 : 1,
            }}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
              {loading ? 'Verifying...' : 'Verify Email'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

