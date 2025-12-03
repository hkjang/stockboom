import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function DELETE(
    request: NextRequest,
    { params }: { params: { stockId: string } }
) {
    try {
        const token = request.headers.get('authorization');
        const stockId = params.stockId;

        const res = await fetch(`${API_BASE_URL}/api/admin/stocks/${stockId}`, {
            method: 'DELETE',
            headers: token ? { 'Authorization': token } : {},
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Failed to delete stock' },
            { status: 500 }
        );
    }
}
