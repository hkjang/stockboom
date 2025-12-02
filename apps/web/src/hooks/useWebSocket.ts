'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useWebSocket(url: string = 'http://localhost:3001') {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const newSocket = io(url);

        newSocket.on('connect', () => {
            console.log('WebSocket connected');
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('WebSocket disconnected');
            setIsConnected(false);
        });

        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, [url]);

    const subscribeToPortfolio = (portfolioId: string) => {
        if (socket) {
            socket.emit('subscribe-portfolio', portfolioId);
        }
    };

    const unsubscribeFromPortfolio = (portfolioId: string) => {
        if (socket) {
            socket.emit('unsubscribe-portfolio', portfolioId);
        }
    };

    const subscribeToStock = (stockId: string) => {
        if (socket) {
            socket.emit('subscribe-stock', stockId);
        }
    };

    const onPortfolioUpdate = (callback: (data: any) => void) => {
        if (socket) {
            socket.on('portfolio-update', callback);
            return () => socket.off('portfolio-update', callback);
        }
    };

    const onStockPriceUpdate = (callback: (data: any) => void) => {
        if (socket) {
            socket.on('price-update', callback);
            return () => socket.off('price-update', callback);
        }
    };

    const onTradeUpdate = (callback: (data: any) => void) => {
        if (socket) {
            socket.on('trade-update', callback);
            return () => socket.off('trade-update', callback);
        }
    };

    return {
        socket,
        isConnected,
        subscribeToPortfolio,
        unsubscribeFromPortfolio,
        subscribeToStock,
        onPortfolioUpdate,
        onStockPriceUpdate,
        onTradeUpdate,
    };
}
