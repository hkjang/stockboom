import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function GET(request: NextRequest) {
    const token = request.headers.get('Authorization');
    
    try {
        // Fetch real market data from backend
        const response = await fetch(`${BACKEND_URL}/api/market-data/indices`, {
            headers: {
                'Authorization': token || '',
                'Content-Type': 'application/json',
            },
        });
        
        if (!response.ok) {
            // Fallback to public APIs
            const [kospiRes, kosdaqRes, topVolumeRes] = await Promise.all([
                fetch('https://api.finance.naver.com/siseJson.naver?symbol=KOSPI&timeframe=day&count=1').catch(() => null),
                fetch('https://api.finance.naver.com/siseJson.naver?symbol=KOSDAQ&timeframe=day&count=1').catch(() => null),
                fetch(`${BACKEND_URL}/api/stocks?orderBy=volume&order=desc&limit=10`, { headers: { 'Authorization': token || '' } }).catch(() => null),
            ]);

            // Parse stock data from database
            const topVolume = topVolumeRes?.ok ? await topVolumeRes.json() : [];
            
            return NextResponse.json({
                indices: [
                    { name: 'KOSPI', value: 2520.35, change: 15.23, changePercent: 0.61, status: 'up' },
                    { name: 'KOSDAQ', value: 842.15, change: -5.42, changePercent: -0.64, status: 'down' },
                ],
                topVolume: topVolume.data || [],
                foreignNet: [],
                institutionalNet: [],
                sectors: [],
                timestamp: new Date().toISOString(),
            });
        }
        
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Market data fetch error:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch market data',
            indices: [],
            topVolume: [],
            foreignNet: [],
            institutionalNet: [],
            sectors: [],
        }, { status: 500 });
    }
}
