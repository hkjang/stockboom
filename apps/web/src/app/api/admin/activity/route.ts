import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const token = request.headers.get('authorization');
    
    const apiResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/activity`, {
        headers: {
            'Authorization': token || '',
        },
    });

    if (!apiResponse.ok) {
        return NextResponse.json({ error: 'Failed to fetch activity' }, { status: apiResponse.status });
    }

    const data = await apiResponse.json();
    return NextResponse.json(data);
}
