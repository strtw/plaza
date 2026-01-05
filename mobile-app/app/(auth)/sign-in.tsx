import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const onSignInPress = async () => {
    if (!isLoaded) {
      setError('Clerk is not loaded yet. Please wait...');
      return;
    }

    if (!emailAddress || !password) {
      setError('Please enter both email and password');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const completeSignIn = await signIn.create({
        identifier: emailAddress,
        password,
      });

      await setActive({ session: completeSignIn.createdSessionId });
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Sign in error:', JSON.stringify(err, null, 2));
      const errorMessage = err?.errors?.[0]?.message || err?.message || 'Failed to sign in. Please check your credentials.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' }}>
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
        onPress={onSignInPress}
        disabled={!!loading}
        style={{
          backgroundColor: loading ? '#999' : 'blue',
          padding: 15,
          borderRadius: 4,
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Text>
      </TouchableOpacity>

      <Link href="/(auth)/sign-up" style={{ marginTop: 20, textAlign: 'center' }}>
        <Text style={{ color: '#0066cc' }}>Don't have an account? Sign up</Text>
      </Link>
    </View>
  );
}
