import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function GET(request: NextRequest) {
    const token = request.headers.get('Authorization');
    
    try {
        // Check all API statuses from backend
        const [
            kisStatus,
            dartStatus,
            publicDataStatus,
            upbitStatus,
        ] = await Promise.allSettled([
            fetch(`${BACKEND_URL}/api/market-data/kis/status`, { 
                headers: { 'Authorization': token || '' },
                signal: AbortSignal.timeout(5000),
            }),
            fetch(`${BACKEND_URL}/api/market-data/opendart/status`, { 
                headers: { 'Authorization': token || '' },
                signal: AbortSignal.timeout(5000),
            }),
            fetch(`${BACKEND_URL}/api/market-data/public-data/status`, { 
                headers: { 'Authorization': token || '' },
                signal: AbortSignal.timeout(5000),
            }),
            fetch('https://api.upbit.com/v1/market/all?isDetails=false', {
                signal: AbortSignal.timeout(5000),
            }),
        ]);

        const checkStatus = async (result: PromiseSettledResult<Response>) => {
            if (result.status === 'fulfilled') {
                const startTime = Date.now();
                try {
                    await result.value.json();
                    return {
                        connected: result.value.ok,
                        responseTime: Date.now() - startTime,
                        statusCode: result.value.status,
                    };
                } catch {
                    return { connected: false, responseTime: 0, error: 'Parse error' };
                }
            }
            return { connected: false, responseTime: 0, error: result.reason?.message || 'Failed' };
        };

        const apis = [
            {
                name: 'KIS API',
                description: '한국투자증권 Open API',
                ...(await checkStatus(kisStatus)),
                dailyCalls: 0,
                rateLimit: 20,
                rateLimitUsed: 0,
            },
            {
                name: 'OpenDART',
                description: '금융감독원 전자공시',
                ...(await checkStatus(dartStatus)),
                dailyCalls: 0,
                rateLimit: 10000,
                rateLimitUsed: 0,
            },
            {
                name: '공공데이터포털',
                description: '금융위원회 시세정보',
                ...(await checkStatus(publicDataStatus)),
                dailyCalls: 0,
                rateLimit: 1000,
                rateLimitUsed: 0,
            },
            {
                name: 'Upbit',
                description: '암호화폐 시세',
                ...(await checkStatus(upbitStatus)),
                dailyCalls: 0,
                rateLimit: 100,
                rateLimitUsed: 0,
            },
        ];

        const connectedCount = apis.filter(a => a.connected).length;

        return NextResponse.json({
            apis,
            summary: {
                total: apis.length,
                connected: connectedCount,
                disconnected: apis.length - connectedCount,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('API status check error:', error);
        return NextResponse.json({ 
            error: 'Failed to check API status',
            apis: [],
            summary: { total: 0, connected: 0, disconnected: 0 },
        }, { status: 500 });
    }
}
