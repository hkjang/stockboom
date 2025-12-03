import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(
    request: NextRequest,
    { params }: { params: { queueName: string } }
) {
    try {
        const token = request.headers.get('authorization');
        const queueName = params.queueName;

        const res = await fetch(`${API_BASE_URL}/api/admin/queues/${queueName}/failed`, {
            headers: token ? { 'Authorization': token } : {},
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error: any) {
        console.error('Failed Jobs API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch failed jobs' },
            { status: 500 }
        );
    }
}
