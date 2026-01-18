import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiEndpoint {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    description: string;
    params?: { name: string; type: string; required: boolean; description: string }[];
}

interface ApiCheckResult {
    id: string;
    name: string;
    category: 'backend' | 'external' | 'realtime';
    description: string;
    connected: boolean;
    message: string;
    responseTime: number;
    lastCheck: string;
    baseUrl: string;
    testedEndpoint: string;
    endpoints: ApiEndpoint[];
    configRequired: string[];
    configLocation: string;
    documentation: string;
    error?: string;
    statusCode?: number;
    features: string[];
    relatedMenus: { name: string; path: string; icon: string }[];
    // 새 필드들
    headers: { name: string; description: string; required: boolean }[];
    rateLimit: { requests: number; period: string; note?: string };
    authType: string;
    responseExample: string;
}

async function checkApi(
    id: string,
    name: string,
    category: 'backend' | 'external' | 'realtime',
    description: string,
    url: string,
    options: {
        baseUrl?: string;
        headers?: Record<string, string>;
        timeout?: number;
        endpoints?: ApiEndpoint[];
        configRequired?: string[];
        configLocation?: string;
        documentation?: string;
        features?: string[];
        relatedMenus?: { name: string; path: string; icon: string }[];
        requiredHeaders?: { name: string; description: string; required: boolean }[];
        rateLimit?: { requests: number; period: string; note?: string };
        authType?: string;
        responseExample?: string;
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
            message = `정상 연결 (HTTP ${response.status})`;
        } else if (response.status === 401 || response.status === 403) {
            connected = false;
            message = `인증 실패 (HTTP ${response.status}) - API 키를 확인하세요`;
        } else if (response.status === 404) {
            connected = false;
            message = `엔드포인트 없음 (HTTP ${response.status})`;
        } else if (response.status === 429) {
            connected = true;
            message = `Rate Limit 초과 (HTTP ${response.status})`;
        } else {
            connected = false;
            message = `오류 (HTTP ${response.status}: ${response.statusText})`;
        }
        
        return {
            id,
            name,
            category,
            description,
            connected,
            message,
            responseTime,
            lastCheck: new Date().toISOString(),
            baseUrl: options.baseUrl || url.split('/').slice(0, 3).join('/'),
            testedEndpoint: url,
            endpoints: options.endpoints || [],
            configRequired: options.configRequired || [],
            configLocation: options.configLocation || '',
            documentation: options.documentation || '',
            statusCode: response.status,
            features: options.features || [],
            relatedMenus: options.relatedMenus || [],
        };
    } catch (error: any) {
        return {
            id,
            name,
            category,
            description,
            connected: false,
            message: error.name === 'AbortError' ? `연결 시간 초과 (${timeout}ms)` : (error.message || '연결 실패'),
            responseTime: Date.now() - startTime,
            lastCheck: new Date().toISOString(),
            baseUrl: options.baseUrl || url.split('/').slice(0, 3).join('/'),
            testedEndpoint: url,
            endpoints: options.endpoints || [],
            configRequired: options.configRequired || [],
            configLocation: options.configLocation || '',
            documentation: options.documentation || '',
            error: error.message,
            features: options.features || [],
            relatedMenus: options.relatedMenus || [],
        };
    }
}

export async function GET(request: NextRequest) {
    const token = request.headers.get('Authorization');
    
    try {
        const apis = await Promise.all([
            // Backend Server
            checkApi(
                'backend',
                'Backend API Server',
                'backend',
                'NestJS 백엔드 서버 - 인증, 데이터베이스, 비즈니스 로직',
                `${BACKEND_URL}/api/health`,
                {
                    baseUrl: BACKEND_URL,
                    headers: { 'Authorization': token || '' },
                    endpoints: [
                        { method: 'GET', path: '/api/health', description: '서버 상태 확인' },
                        { method: 'GET', path: '/api/health/detailed', description: 'DB/Redis 상세 상태' },
                        { 
                            method: 'POST', path: '/api/auth/login', description: '로그인',
                            params: [
                                { name: 'email', type: 'string', required: true, description: '사용자 이메일' },
                                { name: 'password', type: 'string', required: true, description: '비밀번호' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/api/stocks', description: '종목 목록 조회',
                            params: [
                                { name: 'page', type: 'number', required: false, description: '페이지 번호 (기본: 1)' },
                                { name: 'limit', type: 'number', required: false, description: '페이지당 개수 (기본: 20)' },
                                { name: 'search', type: 'string', required: false, description: '검색어 (종목명/코드)' },
                                { name: 'market', type: 'string', required: false, description: 'KOSPI | KOSDAQ | ALL' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/api/portfolios', description: '포트폴리오 조회',
                            params: [
                                { name: 'userId', type: 'string', required: false, description: '사용자 ID (관리자용)' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/api/trades', description: '거래 내역 조회',
                            params: [
                                { name: 'portfolioId', type: 'string', required: false, description: '포트폴리오 ID' },
                                { name: 'status', type: 'string', required: false, description: 'PENDING | EXECUTED | CANCELLED' },
                                { name: 'startDate', type: 'string', required: false, description: '시작일 (YYYY-MM-DD)' },
                                { name: 'endDate', type: 'string', required: false, description: '종료일 (YYYY-MM-DD)' },
                            ]
                        },
                        { method: 'GET', path: '/api/admin/*', description: '관리자 API (인증 필요)' },
                    ],
                    configRequired: [],
                    configLocation: 'pnpm dev로 서버 실행',
                    documentation: 'http://localhost:3001/api/docs',
                    features: ['인증/로그인', '사용자 관리', '종목 데이터', '포트폴리오', '거래', '알림'],
                    relatedMenus: [
                        { name: '대시보드', path: '/admin', icon: 'LayoutDashboard' },
                        { name: '종목 관리', path: '/admin/stocks', icon: 'TrendingUp' },
                        { name: '데이터 수집', path: '/admin/data-collection', icon: 'Database' },
                        { name: '사용자 관리', path: '/admin/users', icon: 'Users' },
                    ],
                }
            ),
            
            // KIS API
            checkApi(
                'kis',
                'KIS API (한국투자증권)',
                'external',
                '한국투자증권 Open API - 국내/해외 주식 시세, 주문, 계좌 조회',
                `${BACKEND_URL}/api/market-data/kis/status`,
                {
                    baseUrl: 'https://openapi.koreainvestment.com:9443',
                    headers: { 'Authorization': token || '' },
                    timeout: 8000,
                    endpoints: [
                        { 
                            method: 'GET', path: '/uapi/domestic-stock/v1/quotations/inquire-price', description: '국내 주식 현재가',
                            params: [
                                { name: 'FID_COND_MRKT_DIV_CODE', type: 'string', required: true, description: '시장구분 (J: 주식)' },
                                { name: 'FID_INPUT_ISCD', type: 'string', required: true, description: '종목코드 (6자리)' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/uapi/domestic-stock/v1/quotations/inquire-daily-price', description: '국내 주식 일별 시세',
                            params: [
                                { name: 'FID_COND_MRKT_DIV_CODE', type: 'string', required: true, description: '시장구분' },
                                { name: 'FID_INPUT_ISCD', type: 'string', required: true, description: '종목코드' },
                                { name: 'FID_PERIOD_DIV_CODE', type: 'string', required: true, description: 'D:일, W:주, M:월' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/uapi/domestic-stock/v1/trading/inquire-balance', description: '잔고 조회',
                            params: [
                                { name: 'CANO', type: 'string', required: true, description: '계좌번호 앞 8자리' },
                                { name: 'ACNT_PRDT_CD', type: 'string', required: true, description: '계좌상품코드 뒤 2자리' },
                            ]
                        },
                        { 
                            method: 'POST', path: '/uapi/domestic-stock/v1/trading/order-cash', description: '주식 주문',
                            params: [
                                { name: 'PDNO', type: 'string', required: true, description: '종목코드' },
                                { name: 'ORD_DVSN', type: 'string', required: true, description: '주문구분 (00:지정가, 01:시장가)' },
                                { name: 'ORD_QTY', type: 'number', required: true, description: '주문수량' },
                                { name: 'ORD_UNPR', type: 'number', required: true, description: '주문단가 (시장가:0)' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/uapi/domestic-stock/v1/quotations/inquire-investor', description: '투자자별 매매동향',
                            params: [
                                { name: 'FID_INPUT_ISCD', type: 'string', required: true, description: '종목코드' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/uapi/overseas-stock/v1/quotations/price', description: '해외 주식 시세',
                            params: [
                                { name: 'EXCD', type: 'string', required: true, description: '거래소코드 (NAS, NYS 등)' },
                                { name: 'SYMB', type: 'string', required: true, description: '종목코드 (AAPL 등)' },
                            ]
                        },
                    ],
                    configRequired: ['KIS_APP_KEY', 'KIS_APP_SECRET', 'KIS_ACCOUNT_NUMBER'],
                    configLocation: '/admin/settings → API 키 관리',
                    documentation: 'https://apiportal.koreainvestment.com',
                    features: ['실시간 시세', '주문 체결', '잔고 조회', '해외 주식', '투자자 동향'],
                    relatedMenus: [
                        { name: '시장 현황', path: '/admin/market-data', icon: 'BarChart2' },
                        { name: '트레이딩 뷰', path: '/admin/trading-view', icon: 'LineChart' },
                        { name: '종목 스크리너', path: '/admin/screener', icon: 'Filter' },
                        { name: '관심종목', path: '/admin/watchlist', icon: 'Star' },
                    ],
                }
            ),
            
            // OpenDART
            checkApi(
                'opendart',
                'OpenDART (금융감독원)',
                'external',
                '금융감독원 전자공시시스템 - 기업 공시, 재무제표, 지분 공시',
                `${BACKEND_URL}/api/market-data/opendart/status`,
                {
                    baseUrl: 'https://opendart.fss.or.kr/api',
                    headers: { 'Authorization': token || '' },
                    timeout: 8000,
                    endpoints: [
                        { 
                            method: 'GET', path: '/list.json', description: '공시 목록 조회',
                            params: [
                                { name: 'crtfc_key', type: 'string', required: true, description: 'API 인증키' },
                                { name: 'corp_code', type: 'string', required: false, description: '고유번호 (8자리)' },
                                { name: 'bgn_de', type: 'string', required: false, description: '시작일 (YYYYMMDD)' },
                                { name: 'end_de', type: 'string', required: false, description: '종료일 (YYYYMMDD)' },
                                { name: 'pblntf_ty', type: 'string', required: false, description: '공시유형 (A:정기, B:주요사항)' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/company.json', description: '기업 개황 정보',
                            params: [
                                { name: 'crtfc_key', type: 'string', required: true, description: 'API 인증키' },
                                { name: 'corp_code', type: 'string', required: true, description: '고유번호 (8자리)' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/fnlttSinglAcntAll.json', description: '단일 재무제표',
                            params: [
                                { name: 'crtfc_key', type: 'string', required: true, description: 'API 인증키' },
                                { name: 'corp_code', type: 'string', required: true, description: '고유번호' },
                                { name: 'bsns_year', type: 'string', required: true, description: '사업연도 (YYYY)' },
                                { name: 'reprt_code', type: 'string', required: true, description: '보고서코드 (11011:사업, 11012:반기)' },
                                { name: 'fs_div', type: 'string', required: true, description: 'CFS:연결, OFS:개별' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/fnlttMultiAcnt.json', description: '다중 재무제표',
                            params: [
                                { name: 'crtfc_key', type: 'string', required: true, description: 'API 인증키' },
                                { name: 'corp_code', type: 'string', required: true, description: '고유번호' },
                                { name: 'bsns_year', type: 'string', required: true, description: '사업연도' },
                                { name: 'reprt_code', type: 'string', required: true, description: '보고서코드' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/majorstock.json', description: '대주주 지분 현황',
                            params: [
                                { name: 'crtfc_key', type: 'string', required: true, description: 'API 인증키' },
                                { name: 'corp_code', type: 'string', required: true, description: '고유번호' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/alotMatter.json', description: '배당 관련 사항',
                            params: [
                                { name: 'crtfc_key', type: 'string', required: true, description: 'API 인증키' },
                                { name: 'corp_code', type: 'string', required: true, description: '고유번호' },
                                { name: 'bsns_year', type: 'string', required: true, description: '사업연도' },
                                { name: 'reprt_code', type: 'string', required: true, description: '보고서코드' },
                            ]
                        },
                    ],
                    configRequired: ['OPENDART_API_KEY'],
                    configLocation: '/admin/settings → API 키 관리',
                    documentation: 'https://opendart.fss.or.kr/intro/main.do',
                    features: ['기업 공시', '재무제표', '배당 정보', '대주주 현황', '감사 보고서'],
                    relatedMenus: [
                        { name: '데이터 수집', path: '/admin/data-collection', icon: 'Database' },
                        { name: '종목 관리', path: '/admin/stocks', icon: 'TrendingUp' },
                    ],
                }
            ),
            
            // 공공데이터포털
            checkApi(
                'publicdata',
                '공공데이터포털 (금융위원회)',
                'external',
                '금융위원회 제공 주식 시세 정보 API',
                `${BACKEND_URL}/api/market-data/public-data/status`,
                {
                    baseUrl: 'https://apis.data.go.kr/1160100',
                    headers: { 'Authorization': token || '' },
                    timeout: 8000,
                    endpoints: [
                        { 
                            method: 'GET', path: '/service/GetStockSecuritiesInfoService/getStockPriceInfo', description: '주식 시세',
                            params: [
                                { name: 'serviceKey', type: 'string', required: true, description: 'API 인증키' },
                                { name: 'resultType', type: 'string', required: false, description: 'json | xml' },
                                { name: 'numOfRows', type: 'number', required: false, description: '한 페이지 결과 수' },
                                { name: 'pageNo', type: 'number', required: false, description: '페이지 번호' },
                                { name: 'likeItmsNm', type: 'string', required: false, description: '종목명 검색' },
                                { name: 'likeSrtnCd', type: 'string', required: false, description: '단축코드 (6자리)' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/service/GetKrxListedInfoService/getItemInfo', description: 'KRX 상장 종목',
                            params: [
                                { name: 'serviceKey', type: 'string', required: true, description: 'API 인증키' },
                                { name: 'resultType', type: 'string', required: false, description: 'json | xml' },
                                { name: 'mrktCls', type: 'string', required: false, description: 'KOSPI | KOSDAQ | KONEX' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/service/GetMarketIndexInfoService/getStockMarketIndex', description: '시장 지수',
                            params: [
                                { name: 'serviceKey', type: 'string', required: true, description: 'API 인증키' },
                                { name: 'resultType', type: 'string', required: false, description: 'json | xml' },
                                { name: 'idxNm', type: 'string', required: false, description: '지수명 (코스피, 코스닥 등)' },
                            ]
                        },
                    ],
                    configRequired: ['PUBLIC_DATA_API_KEY'],
                    configLocation: '/admin/settings → API 키 관리',
                    documentation: 'https://www.data.go.kr/data/15094808/openapi.do',
                    features: ['종목 시세', 'KRX 상장 정보', '시장 지수'],
                    relatedMenus: [
                        { name: '시장 현황', path: '/admin/market-data', icon: 'BarChart2' },
                        { name: '데이터 수집', path: '/admin/data-collection', icon: 'Database' },
                    ],
                }
            ),
            
            // Upbit
            checkApi(
                'upbit',
                'Upbit (업비트)',
                'external',
                '업비트 암호화폐 거래소 - 암호화폐 시세, 거래',
                'https://api.upbit.com/v1/market/all?isDetails=false',
                {
                    baseUrl: 'https://api.upbit.com/v1',
                    timeout: 5000,
                    endpoints: [
                        { 
                            method: 'GET', path: '/market/all', description: '마켓 코드 조회',
                            params: [
                                { name: 'isDetails', type: 'boolean', required: false, description: '상세 정보 포함 여부' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/ticker', description: '현재가 조회',
                            params: [
                                { name: 'markets', type: 'string', required: true, description: '마켓 코드 (KRW-BTC,KRW-ETH)' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/candles/minutes/{unit}', description: '분봉 캔들',
                            params: [
                                { name: 'unit', type: 'number', required: true, description: '분 단위 (1,3,5,15,30,60,240)' },
                                { name: 'market', type: 'string', required: true, description: '마켓 코드' },
                                { name: 'count', type: 'number', required: false, description: '개수 (최대 200)' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/candles/days', description: '일봉 캔들',
                            params: [
                                { name: 'market', type: 'string', required: true, description: '마켓 코드' },
                                { name: 'count', type: 'number', required: false, description: '개수 (최대 200)' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/orderbook', description: '호가 정보',
                            params: [
                                { name: 'markets', type: 'string', required: true, description: '마켓 코드 (,로 구분)' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/trades/ticks', description: '체결 내역',
                            params: [
                                { name: 'market', type: 'string', required: true, description: '마켓 코드' },
                                { name: 'count', type: 'number', required: false, description: '개수 (최대 500)' },
                            ]
                        },
                    ],
                    configRequired: [],
                    configLocation: 'Public API (별도 키 불필요)',
                    documentation: 'https://docs.upbit.com/reference',
                    features: ['실시간 시세', '차트 데이터', '호가 정보', '거래 내역'],
                    relatedMenus: [
                        { name: '암호화폐', path: '/admin/crypto', icon: 'Bitcoin' },
                    ],
                }
            ),
            
            // Naver Finance
            checkApi(
                'naver',
                'Naver Finance (네이버 금융)',
                'external',
                '네이버 금융 웹 스크래핑 - 뉴스, 투자자 동향, 종목 분석',
                'https://finance.naver.com',
                {
                    baseUrl: 'https://finance.naver.com',
                    timeout: 5000,
                    endpoints: [
                        { 
                            method: 'GET', path: '/item/main.naver', description: '종목 메인 페이지',
                            params: [
                                { name: 'code', type: 'string', required: true, description: '종목코드 (6자리)' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/item/sise.naver', description: '종목 시세',
                            params: [
                                { name: 'code', type: 'string', required: true, description: '종목코드' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/item/news_news.naver', description: '종목 뉴스',
                            params: [
                                { name: 'code', type: 'string', required: true, description: '종목코드' },
                                { name: 'page', type: 'number', required: false, description: '페이지 번호' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/sise/sise_index.naver', description: '시장 지수',
                            params: [
                                { name: 'code', type: 'string', required: false, description: '지수 코드' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/sise/sise_market_sum.naver', description: '시가총액',
                            params: [
                                { name: 'sosok', type: 'string', required: false, description: '0:코스피, 1:코스닥' },
                                { name: 'page', type: 'number', required: false, description: '페이지 번호' },
                            ]
                        },
                    ],
                    configRequired: [],
                    configLocation: 'Web Scraping (별도 키 불필요)',
                    documentation: 'https://finance.naver.com',
                    features: ['시장 지수', '뉴스 수집', '투자자 동향', '재무 정보'],
                    relatedMenus: [
                        { name: '뉴스 감성', path: '/admin/news-sentiment', icon: 'Newspaper' },
                        { name: '시장 현황', path: '/admin/market-data', icon: 'BarChart2' },
                    ],
                }
            ),
            
            // KIS WebSocket
            checkApi(
                'kis-ws',
                'KIS WebSocket (실시간)',
                'realtime',
                '한국투자증권 WebSocket - 실시간 시세, 체결',
                `${BACKEND_URL}/api/market-data/kis/websocket/status`,
                {
                    baseUrl: 'wss://ops.koreainvestment.com:21000',
                    headers: { 'Authorization': token || '' },
                    timeout: 5000,
                    endpoints: [
                        { 
                            method: 'GET', path: '/tryitout/H0STCNT0', description: '실시간 주식 체결가',
                            params: [
                                { name: 'tr_id', type: 'string', required: true, description: '거래ID (H0STCNT0)' },
                                { name: 'tr_key', type: 'string', required: true, description: '종목코드 (6자리)' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/tryitout/H0STASP0', description: '실시간 주식 호가',
                            params: [
                                { name: 'tr_id', type: 'string', required: true, description: '거래ID (H0STASP0)' },
                                { name: 'tr_key', type: 'string', required: true, description: '종목코드 (6자리)' },
                            ]
                        },
                        { 
                            method: 'GET', path: '/tryitout/H0STCNI0', description: '실시간 체결 통보',
                            params: [
                                { name: 'tr_id', type: 'string', required: true, description: '거래ID (H0STCNI0)' },
                                { name: 'tr_key', type: 'string', required: true, description: '고객ID 또는 HTS ID' },
                            ]
                        },
                    ],
                    configRequired: ['KIS_APP_KEY', 'KIS_APP_SECRET'],
                    configLocation: '/admin/settings → API 키 관리',
                    documentation: 'https://apiportal.koreainvestment.com',
                    features: ['실시간 체결가', '실시간 호가', '체결 통보'],
                    relatedMenus: [
                        { name: '트레이딩 뷰', path: '/admin/trading-view', icon: 'LineChart' },
                        { name: '시장 현황', path: '/admin/market-data', icon: 'BarChart2' },
                    ],
                }
            ),
        ]);

        const summary = {
            total: apis.length,
            connected: apis.filter(a => a.connected).length,
            disconnected: apis.filter(a => !a.connected).length,
            avgResponseTime: Math.round(apis.filter(a => a.responseTime > 0).reduce((sum, a) => sum + a.responseTime, 0) / apis.filter(a => a.responseTime > 0).length) || 0,
            byCategory: {
                backend: apis.filter(a => a.category === 'backend'),
                external: apis.filter(a => a.category === 'external'),
                realtime: apis.filter(a => a.category === 'realtime'),
            },
        };

        return NextResponse.json({
            apis,
            summary,
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
