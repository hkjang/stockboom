import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(
    request: NextRequest,
    { params }: { params: { jobId: string } }
) {
    try {
        const authHeader = request.headers.get('Authorization') || '';
        const jobId = params.jobId;

        const response = await fetch(`${API_URL}/api/admin/data-collection/jobs/${jobId}/retry`, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
            },
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        console.error('Error retrying job:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to retry job' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { jobId: string } }
) {
    try {
        const authHeader = request.headers.get('Authorization') || '';
        const jobId = params.jobId;

        const response = await fetch(`${API_URL}/api/admin/data-collection/jobs/${jobId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': authHeader,
            },
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        console.error('Error canceling job:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to cancel job' },
            { status: 500 }
        );
    }
}
