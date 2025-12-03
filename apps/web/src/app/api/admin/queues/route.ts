import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
    try {
        const token = request.headers.get('authorization');

        const res = await fetch(`${API_BASE_URL}/api/admin/queues`, {
            headers: token ? { 'Authorization': token } : {},
        });

        const data = await res.json();

        if (!res.ok) {
            console.error('Backend API Error:', {
                status: res.status,
                url: `${API_BASE_URL}/api/admin/queues`,
                data
            });
        }

        return NextResponse.json(data, { status: res.status });
    } catch (error: any) {
        console.error('Queue API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch queues' },
            { status: 500 }
        );
    }
}
