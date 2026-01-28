// Railway URL as fallback (stable, always works)
const RAILWAY_URL = 'https://plaza-dev.up.railway.app';

// Get API URL from environment, with smart detection
const getApiUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  
  if (!envUrl) {
    // No URL configured, use Railway as default
    return RAILWAY_URL;
  }

  // If URL contains localhost or 127.0.0.1, use as-is (for simulators)
  if (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  // If URL contains .local (mDNS hostname), use as-is (for physical devices)
  if (envUrl.includes('.local')) {
    return envUrl;
  }

  // If URL is a local IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x), use as-is
  // These will be tried first, with Railway as fallback
  if (/^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(envUrl)) {
    return envUrl;
  }

  // Otherwise, use the configured URL (likely Railway or other cloud service)
  return envUrl;
};

const API_URL = getApiUrl();

export const createApi = (getToken: () => Promise<string | null>) => {
  // Helper to wait for token with retries
  const waitForToken = async (maxRetries = 15, initialDelay = 800, retryDelay = 400): Promise<string> => {
    // Initial delay to give Clerk time to activate session
    await new Promise(resolve => setTimeout(resolve, initialDelay));
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const token = await getToken();
        if (token) {
          return token;
        }
      } catch (error) {
        // Token not ready yet, continue retrying
      }
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    throw new Error('No authentication token available after retries');
  };

  const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
    const token = await waitForToken();
    
    // Determine which URL to use
    const baseUrl = API_URL;
    const isLocalUrl = baseUrl.startsWith('http://') && 
      (baseUrl.includes('localhost') || 
       baseUrl.includes('127.0.0.1') || 
       baseUrl.includes('.local') ||
       /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(baseUrl));
    
    // Try the configured URL first
    const tryFetch = async (url: string): Promise<Response> => {
      return fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });
    };

    let response: Response;
    try {
      const url = `${baseUrl}${endpoint}`;
      console.log(`[API] Making request to: ${url}`);
      console.log(`[API] Method: ${options.method || 'GET'}`);
      
      response = await tryFetch(url);
    } catch (fetchError: any) {
      // If using local URL and it fails, try Railway as fallback
      if (isLocalUrl && baseUrl !== RAILWAY_URL) {
        console.log(`[API] Local backend unavailable, falling back to Railway...`);
        try {
          const fallbackUrl = `${RAILWAY_URL}${endpoint}`;
          console.log(`[API] Retrying with Railway URL: ${fallbackUrl}`);
          response = await tryFetch(fallbackUrl);
        } catch (fallbackError: any) {
          console.error('[API] Both local and Railway failed:', fallbackError);
          throw new Error(`Network error: ${fallbackError.message || 'Failed to connect to server'}`);
        }
      } else {
        console.error('[API] Fetch error:', fetchError);
        throw new Error(`Network error: ${fetchError.message || 'Failed to connect to server'}`);
      }
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
    createAccount: (firstName: string, lastName: string) =>
      fetchApi('/users/me/create', {
        method: 'POST',
        body: JSON.stringify({ firstName, lastName }),
      }),
    getContacts: () => fetchApi('/friends'),
    getPendingFriends: () => fetchApi('/friends/pending'),
    getFriendsStatuses: () => {
      // Backend always returns all accepted and muted friends - frontend handles filtering
      return fetchApi('/status/friends');
    },
    getMyStatus: () => fetchApi('/status/me'),
    createStatus: (data: any) =>
      fetchApi('/status', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteMyStatus: () =>
      fetchApi('/status/me', {
        method: 'DELETE',
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
    createMockUsers: (contacts: Array<{ phone: string; name: string }>) =>
      fetchApi('/dev/mock-users', {
        method: 'POST',
        body: JSON.stringify({ contacts }),
      }),
    // Friends endpoints
    acceptFriend: (sharerId: string) =>
      fetchApi(`/friends/${sharerId}/accept`, {
        method: 'POST',
      }),
    muteFriend: (sharerId: string) =>
      fetchApi(`/friends/${sharerId}/mute`, {
        method: 'POST',
      }),
    blockFriend: (sharerId: string) =>
      fetchApi(`/friends/${sharerId}/block`, {
        method: 'POST',
      }),
    unmuteFriend: (sharerId: string) =>
      fetchApi(`/friends/${sharerId}/unmute`, {
        method: 'POST',
      }),
    unblockFriend: (friendId: string) =>
      fetchApi(`/friends/${friendId}/unblock`, {
        method: 'POST',
      }),
    searchUsers: (query: string) =>
      fetchApi(`/users/search?q=${encodeURIComponent(query)}`),
    deleteAccount: () =>
      fetchApi('/users/me', {
        method: 'DELETE',
      }),
    // Groups
    getMyGroups: () => fetchApi('/groups'),
    getGroup: (id: string) => fetchApi(`/groups/${id}`),
    createGroup: (name: string) =>
      fetchApi('/groups', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    addGroupMember: (groupId: string, userId: string) =>
      fetchApi(`/groups/${groupId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }),
    removeGroupMember: (groupId: string, userId: string) =>
      fetchApi(`/groups/${groupId}/members/${userId}`, {
        method: 'DELETE',
      }),
    getGroupsForUser: (userId: string) =>
      fetchApi(`/groups?memberId=${encodeURIComponent(userId)}`),
  };
};

// Legacy hook for backward compatibility - only use after Clerk is confirmed ready
import { useAuth } from '@clerk/clerk-expo';
export const useApi = () => {
  const { getToken } = useAuth();
  return createApi(getToken);
};

