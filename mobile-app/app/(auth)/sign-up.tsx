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

  const onSignUpPress = async () => {
    if (!isLoaded) {
      return;
    }

    try {
      await signUp.create({
        emailAddress,
        password,
      });

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });

      setPendingVerification(true);
    } catch (err: any) {
      console.error('Error:', JSON.stringify(err, null, 2));
    }
  };

  const onPressVerify = async () => {
    if (!isLoaded) {
      return;
    }

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      console.error('Error:', JSON.stringify(err, null, 2));
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      {!pendingVerification ? (
        <>
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

          <TouchableOpacity
            onPress={onSignUpPress}
            style={{ backgroundColor: 'blue', padding: 15, marginBottom: 10 }}
          >
            <Text style={{ color: 'white', textAlign: 'center' }}>Sign Up</Text>
          </TouchableOpacity>

          <Link href="/(auth)/sign-in" style={{ textAlign: 'center' }}>
            <Text>Already have an account? Sign in</Text>
          </Link>
        </>
      ) : (
        <>
          <TextInput
            value={code}
            placeholder="Enter verification code"
            onChangeText={(code) => setCode(code)}
            style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
          />

          <TouchableOpacity
            onPress={onPressVerify}
            style={{ backgroundColor: 'blue', padding: 15 }}
          >
            <Text style={{ color: 'white', textAlign: 'center' }}>
              Verify Email
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

