import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function GET(request: NextRequest) {
    const token = request.headers.get('Authorization');
    
    try {
        // Fetch alerts from backend
        const alertsRes = await fetch(`${BACKEND_URL}/api/alerts`, {
            headers: { 'Authorization': token || '' },
        });

        if (!alertsRes.ok) {
            throw new Error('Failed to fetch alerts');
        }

        const alerts = await alertsRes.json();
        
        // Separate price alerts and indicator alerts
        const priceAlerts = (alerts.data || alerts).filter((a: any) => 
            ['ABOVE', 'BELOW', 'CHANGE_UP', 'CHANGE_DOWN'].includes(a.type || a.alertType)
        ).map((a: any) => ({
            id: a.id,
            symbol: a.stockId || a.symbol,
            stockName: a.stock?.name || a.stockName || a.stockId,
            type: a.type || a.alertType,
            targetPrice: a.targetPrice || a.threshold,
            changePercent: a.changePercent,
            currentPrice: a.stock?.currentPrice || 0,
            isActive: a.isActive !== false,
            triggered: a.triggered || a.status === 'TRIGGERED',
            triggeredAt: a.triggeredAt,
        }));

        const indicatorAlerts = (alerts.data || alerts).filter((a: any) => 
            ['RSI', 'MACD', 'GOLDEN_CROSS', 'DEATH_CROSS', 'VOLUME_SPIKE', 'INDICATOR'].includes(a.type || a.alertType)
        ).map((a: any) => ({
            id: a.id,
            symbol: a.stockId || a.symbol,
            stockName: a.stock?.name || a.stockName || a.stockId,
            indicator: a.indicator || a.type,
            condition: a.condition || a.message || `${a.indicator || a.type} 조건`,
            isActive: a.isActive !== false,
            triggered: a.triggered || a.status === 'TRIGGERED',
            triggeredAt: a.triggeredAt,
        }));

        return NextResponse.json({
            priceAlerts,
            indicatorAlerts,
            stats: {
                total: priceAlerts.length + indicatorAlerts.length,
                active: [...priceAlerts, ...indicatorAlerts].filter(a => a.isActive).length,
                triggered: [...priceAlerts, ...indicatorAlerts].filter(a => a.triggered).length,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('Alerts settings fetch error:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch alerts',
            priceAlerts: [],
            indicatorAlerts: [],
            stats: { total: 0, active: 0, triggered: 0 },
        }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const token = request.headers.get('Authorization');
    const body = await request.json();
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/alerts`, {
            method: 'POST',
            headers: { 
                'Authorization': token || '',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                stockId: body.symbol,
                type: body.type,
                targetPrice: body.targetPrice,
                threshold: body.threshold,
                indicator: body.indicator,
                condition: body.condition,
                message: body.message,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to create alert');
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Alert create error:', error);
        return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const token = request.headers.get('Authorization');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/alerts/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': token || '' },
        });

        if (!response.ok) {
            throw new Error('Failed to delete alert');
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Alert delete error:', error);
        return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
    }
}
