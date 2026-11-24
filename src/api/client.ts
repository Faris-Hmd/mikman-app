import { supabase } from '../lib/supabase';

const VPS_URL = import.meta.env.VITE_VPS_URL || '';
const isDev = import.meta.env.DEV;
export let SERVER_URL = isDev ? '' : VPS_URL;

export const setServerUrl = (url: string) => {
  if (isDev) {
    SERVER_URL = '';
  } else {
    SERVER_URL = url || VPS_URL;
  }
};

let supabaseIdToken: string | null = null;

export const setSupabaseIdToken = (token: string | null) => {
  supabaseIdToken = token;
};

const refreshAuthToken = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getSession();
    const freshToken = data.session?.access_token ?? null;
    supabaseIdToken = freshToken;
    return freshToken;
  } catch {
    return null;
  }
};

export const getAuthHeadersClient = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (supabaseIdToken) {
    headers['Authorization'] = `Bearer ${supabaseIdToken}`;
  }
  return headers;
};

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any;
  routerId?: string;
  cache?: RequestCache;
  timeoutMs?: number;
}

const doFetch = async (
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw new Error('Network error: Unable to reach server. Check your connection.');
  } finally {
    clearTimeout(timeoutId);
  }
};

export const apiCall = async <T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> => {
  const {
    method = 'GET',
    body,
    routerId,
    cache,
    timeoutMs = 30_000,
  } = options;

  let urlPath = path;
  if (routerId) {
    urlPath = `/routers/${routerId}${path.startsWith('/') ? path : '/' + path}`;
  }

  const url = `${SERVER_URL}/api${urlPath.startsWith('/') ? urlPath : '/' + urlPath}`;

  const buildHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { ...getAuthHeadersClient() };

    const storedLang = localStorage.getItem('@app_lang');
    if (storedLang) {
      headers['Accept-Language'] = storedLang;
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  };

  const makeRequest = async (): Promise<Response> => {
    const headers = buildHeaders();
    const fetchOptions: RequestInit = {
      method,
      headers,
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      cache,
    };

    const res = await doFetch(url, fetchOptions, timeoutMs);
    return res;
  };

  let res = await makeRequest();

  if (res.status === 401 && supabaseIdToken) {
    const freshToken = await refreshAuthToken();
    if (freshToken) {
      res = await makeRequest();
    }
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    let errorMessage = `API error (${res.status}): ${res.statusText}`;
    let parsedData: any = null;
    let errorCode: string | undefined = undefined;
    try {
      const parsed = JSON.parse(errorText);
      parsedData = parsed;
      if (parsed.error || parsed.message) {
        errorMessage = parsed.error || parsed.message;
      }
      if (parsed.code) {
        errorCode = parsed.code;
      }
    } catch {
      if (errorText) {
        errorMessage = errorText.substring(0, 200);
      }
    }

    if (res.status === 403) {
      const lowerMsg = errorMessage.toLowerCase();
      if (lowerMsg.includes('banned') || lowerMsg.includes('pending approval') || errorCode === 'ACCOUNT_BANNED') {
        window.dispatchEvent(new CustomEvent('account:banned'));
      } else if (lowerMsg.includes('expired') || errorCode === 'SUBSCRIPTION_EXPIRED') {
        window.dispatchEvent(new CustomEvent('account:expired'));
      }
    }

    const err = new Error(errorMessage) as any;
    err.status = res.status;
    err.code = errorCode;
    if (parsedData?.userCount !== undefined) err.userCount = parsedData.userCount;
    if (parsedData?.profileName !== undefined) err.profileName = parsedData.profileName;
    throw err;
  }

  return res.json();
};

export const logError = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.error(...args);
  }
};
