'use client';

import { useState, useEffect, useCallback } from 'react';

const TOKEN_KEY = 'token';

export interface UseAuthReturn {
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    getToken: () => string | null;
    setToken: (token: string) => void;
    logout: () => void;
}

export function useAuth(): UseAuthReturn {
    const [token, setTokenState] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Client-side only: read from localStorage
        const storedToken = localStorage.getItem(TOKEN_KEY);
        setTokenState(storedToken);
        setIsLoading(false);
    }, []);

    const getToken = useCallback((): string | null => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(TOKEN_KEY);
    }, []);

    const setToken = useCallback((newToken: string) => {
        localStorage.setItem(TOKEN_KEY, newToken);
        setTokenState(newToken);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        setTokenState(null);
    }, []);

    return {
        token,
        isAuthenticated: !!token,
        isLoading,
        getToken,
        setToken,
        logout,
    };
}

/**
 * Helper function to get token (for use outside of React components)
 */
export function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

/**
 * Helper function to get authorization header
 */
export function getAuthHeader(): Record<string, string> {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Helper function to set token (for use outside of React components)
 */
export function setAuthToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Helper function to clear auth (for use outside of React components)
 */
export function clearAuth(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
}

