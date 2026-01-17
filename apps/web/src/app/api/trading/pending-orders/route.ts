import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// GET /api/trading/pending-orders - 미체결 주문 조회
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');

        const headers: HeadersInit = {};
        if (authHeader) {
            headers['Authorization'] = authHeader;
        }

        const response = await fetch(
            `${API_URL}/api/trades?status=PENDING&status=SUBMITTED&status=PARTIALLY_FILLED`,
            { headers }
        );

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch pending orders' },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Pending orders API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
