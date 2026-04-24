import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const supabaseUrl = `https://${projectId}.supabase.co`;

export const supabase = createClient(supabaseUrl, publicAnonKey);

const API_BASE = `${supabaseUrl}/functions/v1/make-server-bcce5cc4`;

// Helper function for API calls
export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('accessToken');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : { 'Authorization': `Bearer ${publicAnonKey}` }),
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
