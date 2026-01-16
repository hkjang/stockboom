import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization') || '';
        const { searchParams } = new URL(request.url);

        const params = new URLSearchParams();
        if (searchParams.get('page')) params.set('page', searchParams.get('page')!);
        if (searchParams.get('limit')) params.set('limit', searchParams.get('limit')!);
        if (searchParams.get('status')) params.set('status', searchParams.get('status')!);
        if (searchParams.get('type')) params.set('type', searchParams.get('type')!);

        const response = await fetch(`${API_URL}/api/admin/data-collection/jobs-v2?${params}`, {
            headers: {
                'Authorization': authHeader,
            },
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        console.error('Error fetching jobs v2:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch jobs' },
            { status: 500 }
        );
    }
}
