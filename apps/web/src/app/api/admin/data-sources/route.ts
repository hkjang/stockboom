import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
    try {
        const token = request.headers.get('authorization');

        const res = await fetch(`${API_BASE_URL}/api/data-sources`, {
            headers: token ? { 'Authorization': token } : {},
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Failed to fetch data sources' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const token = request.headers.get('authorization');
        const body = await request.json();

        const res = await fetch(`${API_BASE_URL}/api/data-sources/initialize`, {
            method: 'POST',
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
            { error: error.message || 'Failed to initialize data sources' },
            { status: 500 }
        );
    }
}
