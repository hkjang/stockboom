import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// POST /api/broker/sync - 계좌 동기화
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');

        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (authHeader) {
            headers['Authorization'] = authHeader;
        }

        const response = await fetch(`${API_URL}/api/admin/kis/sync/all`, {
            method: 'POST',
            headers,
        });

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ success: false, message: 'Sync failed' });
    }
}
