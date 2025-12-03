import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(
    request: NextRequest,
    { params }: { params: { queueName: string; jobId: string } }
) {
    try {
        const token = request.headers.get('authorization');
        const { queueName, jobId } = params;

        const res = await fetch(`${API_BASE_URL}/api/admin/queues/${queueName}/jobs/${jobId}/retry`, {
            method: 'POST',
            headers: token ? { 'Authorization': token } : {},
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error: any) {
        console.error('Retry Job API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to retry job' },
            { status: 500 }
        );
    }
}
