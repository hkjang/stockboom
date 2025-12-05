import { getAuthHeader, getAuthToken, setAuthToken, clearAuth } from '@/hooks/useAuth';

/**
 * API Error class for consistent error handling
 */
export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public code?: string
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/**
 * Base API configuration
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
const REFRESH_TOKEN_ENDPOINT = '/api/auth/refresh';

/**
 * Token refresh state to prevent multiple refresh calls
 */
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(callback: (token: string) => void) {
    refreshSubscribers.push(callback);
}

function onTokenRefreshed(token: string) {
    refreshSubscribers.forEach((callback) => callback(token));
    refreshSubscribers = [];
}

/**
 * Attempt to refresh the auth token
 */
async function refreshToken(): Promise<string | null> {
    try {
        const response = await fetch(`${API_BASE_URL}${REFRESH_TOKEN_ENDPOINT}`, {
            method: 'POST',
            credentials: 'include', // Include refresh token cookie
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (response.ok) {
            const data = await response.json();
            if (data.token) {
                setAuthToken(data.token);
                return data.token;
            }
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Request interceptor type
 */
type RequestInterceptor = (config: RequestInit) => RequestInit | Promise<RequestInit>;
type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

const requestInterceptors: RequestInterceptor[] = [];
const responseInterceptors: ResponseInterceptor[] = [];

/**
 * Add request interceptor
 */
export function addRequestInterceptor(interceptor: RequestInterceptor) {
    requestInterceptors.push(interceptor);
    return () => {
        const index = requestInterceptors.indexOf(interceptor);
        if (index > -1) requestInterceptors.splice(index, 1);
    };
}

/**
 * Add response interceptor
 */
export function addResponseInterceptor(interceptor: ResponseInterceptor) {
    responseInterceptors.push(interceptor);
    return () => {
        const index = responseInterceptors.indexOf(interceptor);
        if (index > -1) responseInterceptors.splice(index, 1);
    };
}

/**
 * Apply request interceptors
 */
async function applyRequestInterceptors(config: RequestInit): Promise<RequestInit> {
    let result = config;
    for (const interceptor of requestInterceptors) {
        result = await interceptor(result);
    }
    return result;
}

/**
 * Apply response interceptors
 */
async function applyResponseInterceptors(response: Response): Promise<Response> {
    let result = response;
    for (const interceptor of responseInterceptors) {
        result = await interceptor(result);
    }
    return result;
}

/**
 * Make an authenticated fetch request with token refresh support
 */
export async function authFetch<T>(
    url: string,
    options: RequestInit = {},
    retryOnUnauthorized = true
): Promise<T> {
    let headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
        ...options.headers,
    };

    let config: RequestInit = {
        ...options,
        headers,
    };

    // Apply request interceptors
    config = await applyRequestInterceptors(config);

    let response = await fetch(`${API_BASE_URL}${url}`, config);

    // Apply response interceptors
    response = await applyResponseInterceptors(response);

    // Handle 401 Unauthorized - attempt token refresh
    if (response.status === 401 && retryOnUnauthorized) {
        if (!isRefreshing) {
            isRefreshing = true;
            const newToken = await refreshToken();
            isRefreshing = false;

            if (newToken) {
                onTokenRefreshed(newToken);
                // Retry the original request with new token
                return authFetch<T>(url, options, false);
            } else {
                // Refresh failed - clear auth and redirect to login
                clearAuth();
                if (typeof window !== 'undefined') {
                    window.location.href = '/auth/login';
                }
                throw new ApiError('Session expired. Please log in again.', 401);
            }
        } else {
            // Wait for the ongoing refresh to complete
            return new Promise((resolve, reject) => {
                subscribeTokenRefresh((token) => {
                    // Retry with new token
                    const newHeaders = {
                        ...config.headers,
                        Authorization: `Bearer ${token}`,
                    };
                    fetch(`${API_BASE_URL}${url}`, { ...config, headers: newHeaders })
                        .then((res) => res.json())
                        .then(resolve)
                        .catch(reject);
                });
            });
        }
    }

    if (!response.ok) {
        let errorMessage = 'Request failed';
        let errorCode: string | undefined;

        try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
            errorCode = errorData.code;
        } catch {
            errorMessage = response.statusText || errorMessage;
        }

        throw new ApiError(errorMessage, response.status, errorCode);
    }

    return response.json();
}

/**
 * SWR fetcher with authentication
 */
export const swrFetcher = async <T>(url: string): Promise<T> => {
    const token = getAuthToken();

    const response = await fetch(url, {
        headers: {
            Authorization: token ? `Bearer ${token}` : '',
        },
    });

    if (!response.ok) {
        let errorMessage = 'Failed to fetch';
        try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
            errorMessage = response.statusText || errorMessage;
        }
        throw new ApiError(errorMessage, response.status);
    }

    return response.json();
};

/**
 * Helper functions for common HTTP methods
 */
export const api = {
    get: <T>(url: string) => authFetch<T>(url),

    post: <T>(url: string, data?: unknown) =>
        authFetch<T>(url, {
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined,
        }),

    patch: <T>(url: string, data?: unknown) =>
        authFetch<T>(url, {
            method: 'PATCH',
            body: data ? JSON.stringify(data) : undefined,
        }),

    put: <T>(url: string, data?: unknown) =>
        authFetch<T>(url, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined,
        }),

    delete: <T>(url: string) =>
        authFetch<T>(url, {
            method: 'DELETE',
        }),
};

/**
 * Default request interceptor - adds timestamp
 */
addRequestInterceptor((config) => {
    // Add request timestamp for debugging
    const headers = new Headers(config.headers);
    headers.set('X-Request-Time', new Date().toISOString());
    return { ...config, headers };
});

