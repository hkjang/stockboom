import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    try {
        const token = request.headers.get('authorization');
        const userId = params.userId;

        const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/api-keys`, {
            headers: token ? { 'Authorization': token } : {},
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Failed to fetch user API keys' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    try {
        const token = request.headers.get('authorization');
        const userId = params.userId;
        const body = await request.json();

        const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/api-keys`, {
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
            { error: error.message || 'Failed to update user API keys' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    try {
        const token = request.headers.get('authorization');
        const userId = params.userId;

        const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/api-keys`, {
            method: 'DELETE',
            headers: token ? { 'Authorization': token } : {},
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Failed to delete user API keys' },
            { status: 500 }
        );
    }
}
