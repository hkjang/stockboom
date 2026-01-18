import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiCheckResult {
    name: string;
    description: string;
    connected: boolean;
    message: string;
    responseTime: number;
    lastCheck: string;
    endpoint: string;
    configRequired: string[];
    configLocation: string;
    documentation: string;
    error?: string;
    statusCode?: number;
    rateLimit?: { used: number; limit: number };
}

async function checkApi(
    name: string,
    description: string,
    url: string,
    options: {
        headers?: Record<string, string>;
        timeout?: number;
        configRequired?: string[];
        configLocation?: string;
        documentation?: string;
    } = {}
): Promise<ApiCheckResult> {
    const startTime = Date.now();
    const timeout = options.timeout || 5000;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
            headers: options.headers || {},
            signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        
        let message = '';
        let connected = false;
        
        if (response.ok) {
            connected = true;
            message = `정상 연결 (${response.status})`;
        } else if (response.status === 401 || response.status === 403) {
            connected = false;
            message = 'API 키가 유효하지 않거나 권한이 없습니다';
        } else if (response.status === 404) {
            connected = false;
            message = 'API 엔드포인트를 찾을 수 없습니다';
        } else if (response.status === 429) {
            connected = true;
            message = 'Rate Limit 초과 (잠시 후 다시 시도하세요)';
        } else {
            connected = false;
            message = `오류 응답: ${response.status} ${response.statusText}`;
        }
        
        return {
            name,
            description,
            connected,
            message,
            responseTime,
            lastCheck: new Date().toISOString(),
            endpoint: url.replace(/api_key=[^&]+/, 'api_key=****').replace(/crtfc_key=[^&]+/, 'crtfc_key=****'),
            configRequired: options.configRequired || [],
            configLocation: options.configLocation || '',
            documentation: options.documentation || '',
            statusCode: response.status,
        };
    } catch (error: any) {
        return {
            name,
            description,
            connected: false,
            message: error.name === 'AbortError' ? `연결 시간 초과 (${timeout}ms)` : (error.message || '연결 실패'),
            responseTime: Date.now() - startTime,
            lastCheck: new Date().toISOString(),
            endpoint: url.replace(/api_key=[^&]+/, 'api_key=****').replace(/crtfc_key=[^&]+/, 'crtfc_key=****'),
            configRequired: options.configRequired || [],
            configLocation: options.configLocation || '',
            documentation: options.documentation || '',
            error: error.message,
        };
    }
}

export async function GET(request: NextRequest) {
    const token = request.headers.get('Authorization');
    
    try {
        // Check backend connection first
        const backendCheck = await checkApi(
            'Backend API',
            'NestJS 백엔드 서버',
            `${BACKEND_URL}/api/health`,
            {
                headers: { 'Authorization': token || '' },
                configRequired: [],
                configLocation: 'Backend 서버 실행 (pnpm dev)',
                documentation: 'localhost:3001',
            }
        );
        
        // Check individual APIs
        const [kisCheck, dartCheck, upbitCheck, naverCheck] = await Promise.all([
            // KIS API - Check via backend
            checkApi(
                'KIS API',
                '한국투자증권 Open API (주식 시세, 주문, 계좌)',
                `${BACKEND_URL}/api/market-data/kis/status`,
                {
                    headers: { 'Authorization': token || '' },
                    timeout: 8000,
                    configRequired: ['KIS_APP_KEY', 'KIS_APP_SECRET', 'KIS_ACCOUNT_NUMBER'],
                    configLocation: '/admin/settings → API 키 관리',
                    documentation: 'https://apiportal.koreainvestment.com',
                }
            ),
            
            // OpenDART API - Check via backend
            checkApi(
                'OpenDART',
                '금융감독원 전자공시시스템 (공시, 재무제표)',
                `${BACKEND_URL}/api/market-data/opendart/status`,
                {
                    headers: { 'Authorization': token || '' },
                    timeout: 8000,
                    configRequired: ['OPENDART_API_KEY'],
                    configLocation: '/admin/settings → API 키 관리',
                    documentation: 'https://opendart.fss.or.kr',
                }
            ),
            
            // Upbit API - Direct check (public API)
            checkApi(
                'Upbit',
                '업비트 암호화폐 거래소 (암호화폐 시세)',
                'https://api.upbit.com/v1/market/all?isDetails=false',
                {
                    timeout: 5000,
                    configRequired: [],
                    configLocation: 'Public API - 별도 설정 불필요',
                    documentation: 'https://docs.upbit.com',
                }
            ),
            
            // Naver Finance - Check via scraping test
            checkApi(
                'Naver Finance',
                '네이버 금융 웹 스크래핑 (뉴스, 투자자 동향)',
                'https://finance.naver.com',
                {
                    timeout: 5000,
                    configRequired: [],
                    configLocation: 'Web Scraping - 별도 설정 불필요',
                    documentation: 'https://finance.naver.com',
                }
            ),
        ]);
        
        // Check WebSocket status via backend
        const wsCheck = await checkApi(
            'KIS WebSocket',
            '한국투자증권 실시간 시세 (WebSocket)',
            `${BACKEND_URL}/api/market-data/kis/websocket/status`,
            {
                headers: { 'Authorization': token || '' },
                timeout: 5000,
                configRequired: ['KIS_APP_KEY', 'KIS_APP_SECRET'],
                configLocation: '/admin/settings → API 키 관리',
                documentation: 'https://apiportal.koreainvestment.com',
            }
        );
        
        // Check Public Data Portal
        const publicDataCheck = await checkApi(
            '공공데이터포털',
            '금융위원회 주식시세정보 API',
            `${BACKEND_URL}/api/market-data/public-data/status`,
            {
                headers: { 'Authorization': token || '' },
                timeout: 8000,
                configRequired: ['PUBLIC_DATA_API_KEY'],
                configLocation: '/admin/settings → API 키 관리',
                documentation: 'https://www.data.go.kr',
            }
        );
        
        const apis = [backendCheck, kisCheck, dartCheck, publicDataCheck, upbitCheck, naverCheck, wsCheck];
        const connectedCount = apis.filter(a => a.connected).length;
        const avgResponseTime = Math.round(apis.filter(a => a.responseTime > 0).reduce((sum, a) => sum + a.responseTime, 0) / apis.filter(a => a.responseTime > 0).length) || 0;

        return NextResponse.json({
            apis,
            summary: {
                total: apis.length,
                connected: connectedCount,
                disconnected: apis.length - connectedCount,
                avgResponseTime,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('API status check error:', error);
        return NextResponse.json({ 
            error: 'Failed to check API status',
            apis: [],
            summary: { total: 0, connected: 0, disconnected: 0, avgResponseTime: 0 },
        }, { status: 500 });
    }
}
