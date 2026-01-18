import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        // Fetch from Upbit API directly (public API, no auth needed)
        const [tickersRes, marketsRes] = await Promise.all([
            fetch('https://api.upbit.com/v1/ticker?markets=KRW-BTC,KRW-ETH,KRW-XRP,KRW-SOL,KRW-DOGE,KRW-ADA,KRW-AVAX,KRW-DOT,KRW-MATIC,KRW-LINK'),
            fetch('https://api.upbit.com/v1/market/all?isDetails=true'),
        ]);
        
        const [tickers, markets] = await Promise.all([
            tickersRes.ok ? tickersRes.json() : [],
            marketsRes.ok ? marketsRes.json() : [],
        ]);
        
        // Create market name map
        const marketMap = new Map<string, string>();
        markets.forEach((m: any) => {
            marketMap.set(m.market, m.korean_name);
        });
        
        // Calculate sentiment
        let risingCount = 0;
        let fallingCount = 0;
        let totalChangeRate = 0;
        
        const formattedTickers = tickers.map((t: any) => {
            if (t.change === 'RISE') risingCount++;
            else if (t.change === 'FALL') fallingCount++;
            totalChangeRate += t.signed_change_rate;
            
            return {
                market: t.market,
                name: marketMap.get(t.market) || t.market,
                tradePrice: t.trade_price,
                change: t.change,
                changeRate: t.signed_change_rate,
                accTradePrice24h: t.acc_trade_price_24h,
            };
        });
        
        const avgChangeRate = totalChangeRate / tickers.length;
        const riseRatio = risingCount / tickers.length;
        const score = Math.min(100, Math.max(0, riseRatio * 50 + Math.min(Math.abs(avgChangeRate) * 500, 50)));
        
        let label = '중립';
        if (score >= 75) label = '극단적 탐욕';
        else if (score >= 55) label = '탐욕';
        else if (score >= 45) label = '중립';
        else if (score >= 25) label = '공포';
        else label = '극단적 공포';
        
        return NextResponse.json({
            tickers: formattedTickers,
            sentiment: {
                score: Math.round(score),
                label,
                factors: {
                    risingCoins: risingCount,
                    fallingCoins: fallingCount,
                    avgChangeRate: (avgChangeRate * 100).toFixed(2),
                }
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('Crypto tickers fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch crypto data' }, { status: 500 });
    }
}
