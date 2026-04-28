// lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function apiFetch(url: string, options?: RequestInit) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  
  const res = await fetch(fullUrl, {
    ...options,
    credentials: 'include', // Important: sends cookies for auth
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  return res;
}