import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(
    request: NextRequest,
    { params }: { params: { symbol: string } }
) {
    try {
        const token = request.headers.get('authorization');
        const symbol = params.symbol;

        // First try to get stock by symbol
        const res = await fetch(`${API_BASE_URL}/api/stocks?symbol=${symbol}`, {
            headers: token ? { 'Authorization': token } : {},
        });

        if (!res.ok) {
            // Try getting from admin stocks
            const adminRes = await fetch(`${API_BASE_URL}/api/admin/stocks?search=${symbol}`, {
                headers: token ? { 'Authorization': token } : {},
            });

            if (adminRes.ok) {
                const data = await adminRes.json();
                const stocks = data.stocks || data;
                const stock = Array.isArray(stocks) 
                    ? stocks.find((s: any) => s.symbol === symbol || s.stockCode === symbol)
                    : null;
                
                if (stock) {
                    return NextResponse.json(stock);
                }
            }
            
            return NextResponse.json(
                { error: 'Stock not found' },
                { status: 404 }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Failed to fetch stock' },
            { status: 500 }
        );
    }
}
