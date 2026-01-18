import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization') || '';

        const response = await fetch(`${API_URL}/api/admin/scheduler/status`, {
            headers: {
                'Authorization': authHeader,
            },
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        console.error('Error fetching scheduler status:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch scheduler status' },
            { status: 500 }
        );
    }
}
