import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// GET /api/trading/tickers/[symbol] - 체결 내역 조회
export async function GET(
    request: NextRequest,
    { params }: { params: { symbol: string } }
) {
    try {
        const symbol = params.symbol;
        const { searchParams } = new URL(request.url);
        const limit = searchParams.get('limit') || '30';
        const authHeader = request.headers.get('authorization');

        const headers: HeadersInit = {};
        if (authHeader) {
            headers['Authorization'] = authHeader;
        }

        const response = await fetch(
            `${API_URL}/api/market-data/tickers/${symbol}?limit=${limit}`,
            { headers }
        );

        if (!response.ok) {
            // 체결 데이터가 없으면 빈 배열 반환
            return NextResponse.json([]);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Tickers API error:', error);
        return NextResponse.json([]);
    }
}
