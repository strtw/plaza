import { Redirect } from 'expo-router';

// Redirect index route to Activity (default tab)
export default function IndexRedirect() {
  return <Redirect href="/(tabs)/activity" />;
}
