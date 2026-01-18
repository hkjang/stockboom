import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function GET(request: NextRequest) {
    const token = request.headers.get('Authorization');
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market') || 'all';
    const rsiMin = parseInt(searchParams.get('rsiMin') || '0');
    const rsiMax = parseInt(searchParams.get('rsiMax') || '100');
    
    try {
        // Fetch stocks from database
        const stocksRes = await fetch(`${BACKEND_URL}/api/stocks?limit=100&orderBy=volume&order=desc`, {
            headers: { 'Authorization': token || '' },
        });

        if (!stocksRes.ok) {
            throw new Error('Failed to fetch stocks');
        }

        const stocksData = await stocksRes.json();
        const stocks = stocksData.data || stocksData || [];

        // Fetch indicators for each stock (batch)
        const indicatorsRes = await fetch(`${BACKEND_URL}/api/analysis/indicators/batch`, {
            method: 'POST',
            headers: { 
                'Authorization': token || '',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                symbols: stocks.slice(0, 20).map((s: any) => s.symbol || s.code),
            }),
        }).catch(() => null);

        const indicatorsMap = indicatorsRes?.ok ? await indicatorsRes.json() : {};

        // Build screener data
        const screenerData = stocks.map((stock: any) => {
            const symbol = stock.symbol || stock.code;
            const indicators = indicatorsMap[symbol] || {};
            
            return {
                symbol,
                name: stock.name || stock.koreanName || symbol,
                market: stock.market || 'KOSPI',
                price: stock.currentPrice || stock.price || 0,
                change: stock.priceChange || 0,
                changePercent: stock.priceChangePercent || stock.changePercent || 0,
                volume: stock.volume || 0,
                marketCap: stock.marketCap || 0,
                per: stock.per || 0,
                pbr: stock.pbr || 0,
                rsi: indicators.RSI?.value || null,
                macdSignal: indicators.MACD?.signal || null,
                foreignNet: stock.foreignNetBuy || 0,
                score: calculateScore(stock, indicators),
            };
        }).filter((s: any) => {
            if (market !== 'all' && s.market !== market) return false;
            if (s.rsi !== null && (s.rsi < rsiMin || s.rsi > rsiMax)) return false;
            return true;
        });

        return NextResponse.json({
            stocks: screenerData,
            total: screenerData.length,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('Screener data fetch error:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch screener data',
            stocks: [],
            total: 0,
        }, { status: 500 });
    }
}

function calculateScore(stock: any, indicators: any): number {
    let score = 50;
    
    // Price momentum
    if (stock.priceChangePercent > 0) score += Math.min(stock.priceChangePercent * 2, 10);
    else score += Math.max(stock.priceChangePercent * 2, -10);
    
    // RSI
    const rsi = indicators.RSI?.value;
    if (rsi !== undefined) {
        if (rsi < 30) score += 15; // Oversold = potential buy
        else if (rsi > 70) score -= 10; // Overbought
        else if (rsi >= 40 && rsi <= 60) score += 5; // Neutral zone
    }
    
    // MACD
    const macd = indicators.MACD?.signal;
    if (macd === 'BUY') score += 10;
    else if (macd === 'SELL') score -= 10;
    
    // Foreign buying
    if (stock.foreignNetBuy > 0) score += 10;
    else if (stock.foreignNetBuy < 0) score -= 5;
    
    // Volume surge
    if (stock.volumeRatio > 2) score += 10;
    
    return Math.min(100, Math.max(0, Math.round(score)));
}
