import { useAuthStore } from '@/stores/auth';

const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export interface HttpOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined | null>;
}

export async function http<T = unknown>(path: string, opts: HttpOptions = {}): Promise<T> {
  const { query, headers, ...rest } = opts;
  const auth = useAuthStore();

  let url = BASE + path;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    }
    const s = params.toString();
    if (s) url += '?' + s;
  }

  const isJson = typeof opts.body === 'string';
  const resp = await fetch(url, {
    ...rest,
    headers: {
      ...(isJson ? { 'Content-Type': 'application/json' } : {}),
      ...auth.authHeader(),
      ...headers,
    },
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${txt.slice(0, 500)}`);
  }
  return (await resp.json()) as T;
}
