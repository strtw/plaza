const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const createApi = (getToken: () => Promise<string | null>) => {
  const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
    if (!API_URL) {
      throw new Error('API_URL is not configured. Check your .env file.');
    }

    const token = await getToken();
    
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    const url = `${API_URL}${endpoint}`;
    console.log(`[API] Making request to: ${url}`);
    console.log(`[API] Method: ${options.method || 'GET'}`);
    console.log(`[API] Has token: ${!!token}`);
    
    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });
    } catch (fetchError: any) {
      console.error('[API] Fetch error:', fetchError);
      throw new Error(`Network error: ${fetchError.message || 'Failed to connect to server'}`);
    }

    console.log(`[API] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      // Try to get error message from response body
      let errorMessage = response.statusText || `HTTP ${response.status}`;
      let errorData: any = null;
      
      try {
        const text = await response.text();
        console.log(`[API] Error response body:`, text);
        if (text) {
          errorData = JSON.parse(text);
          errorMessage = errorData.message || errorData.error || errorData.msg || errorMessage;
        }
      } catch (e) {
        // If response isn't JSON, use status text
        console.log(`[API] Could not parse error response as JSON`);
      }
      
      console.error(`[API] Error [${response.status}]:`, errorMessage);
      throw new Error(`API error: ${errorMessage} (Status: ${response.status})`);
    }

    return response.json();
  };

  return {
    getOrCreateMe: () => fetchApi('/users/me'),
    getContacts: () => fetchApi('/contacts'),
    getContactsStatuses: () => fetchApi('/status/contacts'),
    getMyStatus: () => fetchApi('/status/me'),
    createStatus: (data: any) =>
      fetchApi('/status', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    generateInvite: () =>
      fetchApi('/invites/generate', { method: 'POST' }),
    getInvite: (code: string) => fetchApi(`/invites/${code}`),
    useInvite: (code: string) =>
      fetchApi(`/invites/${code}/use`, { method: 'POST' }),
    // Hash phone numbers on backend (privacy-first: backend hashes, doesn't store raw numbers)
    hashPhones: (phoneNumbers: string[]) =>
      fetchApi('/contacts/hash-phones', {
        method: 'POST',
        body: JSON.stringify({ phoneNumbers }),
      }),
    checkContacts: (phoneHashes: string[]) =>
      fetchApi('/contacts/check', {
        method: 'POST',
        body: JSON.stringify({ phoneHashes }),
      }),
    matchContacts: (phoneHashes: string[]) =>
      fetchApi('/contacts/match', {
        method: 'POST',
        body: JSON.stringify({ phoneHashes }),
      }),
    // Dev endpoint - only works when NODE_ENV !== 'production'
    createMockUsers: (phoneNumbers: string[]) =>
      fetchApi('/dev/mock-users', {
        method: 'POST',
        body: JSON.stringify({ phoneNumbers }),
      }),
  };
};

// Legacy hook for backward compatibility - only use after Clerk is confirmed ready
import { useAuth } from '@clerk/clerk-expo';
export const useApi = () => {
  const { getToken } = useAuth();
  return createApi(getToken);
};

