import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// GET /api/broker/balance - 계좌 잔고 조회
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');

        const headers: HeadersInit = {};
        if (authHeader) {
            headers['Authorization'] = authHeader;
        }

        const response = await fetch(`${API_URL}/api/admin/kis/test/balance`, { headers });

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch balance' },
                { status: response.status }
            );
        }

        const data = await response.json();
        
        if (data.success) {
            return NextResponse.json(data.data);
        }
        
        return NextResponse.json(null);
    } catch (error) {
        return NextResponse.json(null);
    }
}
