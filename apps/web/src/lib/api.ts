import { getAuthHeader, getAuthToken } from '@/hooks/useAuth';

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

/**
 * Make an authenticated fetch request
 */
export async function authFetch<T>(
    url: string,
    options: RequestInit = {}
): Promise<T> {
    const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
        ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        let errorMessage = 'Request failed';
        let errorCode: string | undefined;

        try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
            errorCode = errorData.code;
        } catch {
            // If response is not JSON, use status text
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
