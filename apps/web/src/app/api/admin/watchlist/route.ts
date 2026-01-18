import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
    const token = request.headers.get('Authorization');
    
    try {
        // Fetch watchlist groups from backend
        const groupsRes = await fetch(`${BACKEND_URL}/api/watchlists`, {
            headers: { 'Authorization': token || '' },
        });

        if (!groupsRes.ok) {
            // Try to get user's portfolio stocks as fallback
            const portfolioRes = await fetch(`${BACKEND_URL}/api/portfolios`, {
                headers: { 'Authorization': token || '' },
            });
            
            const portfolioData = portfolioRes.ok ? await portfolioRes.json() : [];
            const stocks = portfolioData[0]?.holdings || [];
            
            return NextResponse.json({
                groups: [{
                    id: 'default',
                    name: '관심종목',
                    items: stocks.map((s: any) => ({
                        symbol: s.stockId || s.symbol,
                        name: s.stock?.name || s.name || s.symbol,
                        price: s.currentPrice || 0,
                        change: s.priceChange || 0,
                        changePercent: s.changePercent || 0,
                        volume: s.volume || 0,
                        rsi: null,
                        macdSignal: null,
                        hasAlert: false,
                    })),
                }],
                timestamp: new Date().toISOString(),
            });
        }

        const groups = await groupsRes.json();
        
        // Enrich with real-time data
        for (const group of groups) {
            for (const item of group.items) {
                try {
                    const priceRes = await fetch(`${BACKEND_URL}/api/market-data/kis/price/${item.symbol}`, {
                        headers: { 'Authorization': token || '' },
                    });
                    if (priceRes.ok) {
                        const price = await priceRes.json();
                        item.price = price.price || item.price;
                        item.change = price.change || item.change;
                        item.changePercent = price.changePercent || item.changePercent;
                    }
                } catch {}
            }
        }

        return NextResponse.json({
            groups,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('Watchlist fetch error:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch watchlist',
            groups: [],
        }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const token = request.headers.get('Authorization');
    const body = await request.json();
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/watchlists`, {
            method: 'POST',
            headers: { 
                'Authorization': token || '',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error('Failed to create watchlist');
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Watchlist create error:', error);
        return NextResponse.json({ error: 'Failed to create watchlist' }, { status: 500 });
    }
}
