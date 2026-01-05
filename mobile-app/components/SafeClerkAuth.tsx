import { ReactNode, Component, ErrorInfo } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  retryCount: number;
}

// Wrapper that safely handles Clerk auth errors
export class SafeClerkAuth extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error) {
    // Check if it's the Clerk provider error
    if (error.message.includes('ClerkProvider')) {
      return { hasError: true };
    }
    return null;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.log('SafeClerkAuth caught error:', error.message);
  }

  render() {
    if (this.state.hasError) {
      // Retry after a delay
      setTimeout(() => {
        this.setState({ hasError: false, retryCount: this.state.retryCount + 1 });
      }, 500);
      
      return this.props.fallback || (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text>Initializing...</Text>
        </View>
      );
    }

    return <>{this.props.children}</>;
  }
}

// Hook version that checks if Clerk is ready
export function useSafeAuth() {
  try {
    return useAuth();
  } catch (error: any) {
    if (error.message?.includes('ClerkProvider')) {
      // Return a safe default
      return {
        isLoaded: false,
        isSignedIn: false,
        getToken: async () => null,
      };
    }
    throw error;
  }
}

