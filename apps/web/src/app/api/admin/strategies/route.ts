import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const token = request.headers.get('authorization');
    
    const apiResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/admin/strategies`, {
        headers: {
            'Authorization': token || '',
        },
    });

    if (!apiResponse.ok) {
        return NextResponse.json({ error: 'Failed to fetch strategies' }, { status: apiResponse.status });
    }

    const data = await apiResponse.json();
    return NextResponse.json(data);
}
