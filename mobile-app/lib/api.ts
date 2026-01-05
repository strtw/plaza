import { useAuth } from '@clerk/clerk-expo';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const useApi = () => {
  const { getToken } = useAuth();

  const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
    const token = await getToken();
    
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  };

  return {
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
  };
};

