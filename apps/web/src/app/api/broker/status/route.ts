import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// GET /api/broker/status - KIS 연결 상태 조회
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');

        const headers: HeadersInit = {};
        if (authHeader) {
            headers['Authorization'] = authHeader;
        }

        const response = await fetch(`${API_URL}/api/admin/kis/status`, { headers });

        if (!response.ok) {
            return NextResponse.json(
                {
                    api: { tokenValid: false, tokenExpiresAt: null },
                    websocket: { connected: false, subscriptions: {} },
                },
                { status: 200 }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({
            api: { tokenValid: false, tokenExpiresAt: null },
            websocket: { connected: false, subscriptions: {} },
        });
    }
}
