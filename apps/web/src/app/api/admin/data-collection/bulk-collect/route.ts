import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization') || '';
        const body = await request.json();

        const response = await fetch(`${API_URL}/api/admin/data-collection/bulk-collect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        console.error('Error bulk collecting:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to bulk collect' },
            { status: 500 }
        );
    }
}
