import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const token = request.headers.get('authorization');
    const url = new URL(request.url);
    const limit = url.searchParams.get('limit') || '100';
    
    const apiResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/trades?limit=${limit}`, {
        headers: {
            'Authorization': token || '',
        },
    });

    if (!apiResponse.ok) {
        return NextResponse.json({ error: 'Failed to fetch trades' }, { status: apiResponse.status });
    }

    const data = await apiResponse.json();
    return NextResponse.json(data);
}
