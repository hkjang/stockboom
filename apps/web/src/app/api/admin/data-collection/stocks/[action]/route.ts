import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(
    request: NextRequest,
    { params }: { params: { action: string } }
) {
    try {
        const token = request.headers.get('authorization');
        const action = params.action;
        const body = await request.json();

        const res = await fetch(`${API_BASE_URL}/admin/data-collection/stocks/${action}`, {
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
            { error: error.message || 'Failed to execute stock data collection action' },
            { status: 500 }
        );
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: { action: string } }
) {
    try {
        const token = request.headers.get('authorization');
        const action = params.action;
        const { searchParams } = new URL(request.url);

        const res = await fetch(`${API_BASE_URL}/admin/data-collection/stocks/${action}?${searchParams.toString()}`, {
            method: 'GET',
            headers: {
                ...(token ? { 'Authorization': token } : {}),
            },
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Failed to fetch stock data collection info' },
            { status: 500 }
        );
    }
}
