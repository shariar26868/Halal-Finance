const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api').replace(/\/$/, '');

export const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result?.toString();
    const separator = result?.indexOf(',');
    if (!result || separator === undefined || separator < 0) {
      reject(new Error('Could not read the selected file'));
      return;
    }
    resolve(result.slice(separator + 1));
  };
  reader.onerror = () => reject(reader.error || new Error('Could not read the selected file'));
  reader.readAsDataURL(file);
});

// Helper function for API calls
export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('accessToken');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  let data: any;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = { error: text || 'Request failed' };
  }

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
};
