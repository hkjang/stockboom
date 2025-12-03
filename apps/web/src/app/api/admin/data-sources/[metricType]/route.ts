import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function PUT(
    request: NextRequest,
    { params }: { params: { metricType: string } }
) {
    try {
        const token = request.headers.get('authorization');
        const metricType = params.metricType;
        const body = await request.json();

        const res = await fetch(`${API_BASE_URL}/api/data-sources/${metricType}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': token } : {}),
            },
            body: JSON.stringify(body),
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Failed to update data source config' },
            { status: 500 }
        );
    }
}
