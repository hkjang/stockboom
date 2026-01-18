import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
    const token = request.headers.get('Authorization');
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || '005930';
    
    try {
        // Fetch real stock data and indicators from backend
        const [stockRes, indicatorsRes, signalsRes] = await Promise.all([
            fetch(`${BACKEND_URL}/api/stocks/${symbol}`, {
                headers: { 'Authorization': token || '' },
            }),
            fetch(`${BACKEND_URL}/api/analysis/indicators/${symbol}?timeframe=1d`, {
                headers: { 'Authorization': token || '' },
            }),
            fetch(`${BACKEND_URL}/api/analysis/signals/${symbol}`, {
                headers: { 'Authorization': token || '' },
            }),
        ]);

        const stock = stockRes.ok ? await stockRes.json() : null;
        const indicators = indicatorsRes.ok ? await indicatorsRes.json() : {};
        const signals = signalsRes.ok ? await signalsRes.json() : [];

        // Get real-time price from KIS if available
        let realtimePrice = null;
        try {
            const priceRes = await fetch(`${BACKEND_URL}/api/market-data/kis/price/${symbol}`, {
                headers: { 'Authorization': token || '' },
            });
            if (priceRes.ok) {
                realtimePrice = await priceRes.json();
            }
        } catch {}

        return NextResponse.json({
            stock: stock || {
                symbol,
                name: symbol,
                price: realtimePrice?.price || 0,
                change: realtimePrice?.change || 0,
                changePercent: realtimePrice?.changePercent || 0,
                volume: realtimePrice?.volume || 0,
                high: realtimePrice?.high || 0,
                low: realtimePrice?.low || 0,
                open: realtimePrice?.open || 0,
            },
            indicators: {
                RSI: indicators.RSI || null,
                MACD: indicators.MACD || null,
                Stochastic: indicators.Stochastic || null,
                ADX: indicators.ADX || null,
                ATR: indicators.ATR || null,
                VWAP: indicators.VWAP || null,
                SMA20: indicators.SMA20 || null,
                SMA50: indicators.SMA50 || null,
                BollingerBands: indicators.BollingerBands || null,
            },
            signals: signals.slice(0, 10),
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('Trading view data fetch error:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch trading data',
            stock: null,
            indicators: {},
            signals: [],
        }, { status: 500 });
    }
}
