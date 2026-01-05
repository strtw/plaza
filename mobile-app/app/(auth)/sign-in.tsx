import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = React.useState('');
  const [password, setPassword] = React.useState('');

  const onSignInPress = async () => {
    if (!isLoaded) {
      return;
    }

    try {
      const completeSignIn = await signIn.create({
        identifier: emailAddress,
        password,
      });

      await setActive({ session: completeSignIn.createdSessionId });
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Error:', JSON.stringify(err, null, 2));
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <TextInput
        autoCapitalize="none"
        value={emailAddress}
        placeholder="Email"
        onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      <TextInput
        value={password}
        placeholder="Password"
        secureTextEntry={true}
        onChangeText={(password) => setPassword(password)}
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />

      <TouchableOpacity onPress={onSignInPress} style={{ backgroundColor: 'blue', padding: 15 }}>
        <Text style={{ color: 'white', textAlign: 'center' }}>Sign In</Text>
      </TouchableOpacity>

      <Link href="/(auth)/sign-up" style={{ marginTop: 20, textAlign: 'center' }}>
        <Text>Don't have an account? Sign up</Text>
      </Link>
    </View>
  );
}
