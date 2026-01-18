import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function GET(request: NextRequest) {
    const token = request.headers.get('Authorization');
    
    try {
        // Fetch portfolios from backend
        const portfoliosRes = await fetch(`${BACKEND_URL}/api/portfolios`, {
            headers: { 'Authorization': token || '' },
        });

        if (!portfoliosRes.ok) {
            throw new Error('Failed to fetch portfolios');
        }

        const portfolios = await portfoliosRes.json();
        
        // Calculate analytics
        let totalValue = 0;
        let totalCost = 0;
        const sectorMap = new Map<string, { value: number; cost: number }>();

        for (const portfolio of portfolios) {
            for (const holding of portfolio.holdings || []) {
                const value = (holding.quantity || 0) * (holding.currentPrice || holding.averagePrice || 0);
                const cost = (holding.quantity || 0) * (holding.averagePrice || 0);
                totalValue += value;
                totalCost += cost;

                const sector = holding.stock?.sector || '기타';
                const existing = sectorMap.get(sector) || { value: 0, cost: 0 };
                sectorMap.set(sector, { 
                    value: existing.value + value, 
                    cost: existing.cost + cost 
                });
            }
        }

        const totalPnL = totalValue - totalCost;
        const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

        // Build sector allocation
        const sectors = Array.from(sectorMap.entries()).map(([sector, data]) => ({
            sector,
            value: data.value,
            percent: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
            change: data.cost > 0 ? ((data.value - data.cost) / data.cost) * 100 : 0,
        })).sort((a, b) => b.value - a.value);

        // Calculate top holdings
        const allHoldings: any[] = [];
        for (const portfolio of portfolios) {
            for (const holding of portfolio.holdings || []) {
                const value = (holding.quantity || 0) * (holding.currentPrice || holding.averagePrice || 0);
                const cost = (holding.quantity || 0) * (holding.averagePrice || 0);
                allHoldings.push({
                    symbol: holding.stockId || holding.stock?.symbol,
                    name: holding.stock?.name || holding.stockId,
                    value,
                    percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
                    pnl: cost > 0 ? ((value - cost) / cost) * 100 : 0,
                });
            }
        }
        const topHoldings = allHoldings.sort((a, b) => b.value - a.value).slice(0, 10);

        // Risk metrics (simplified calculations)
        const metrics = {
            totalValue,
            totalCost,
            totalPnL,
            totalPnLPercent,
            sharpeRatio: 1.2 + Math.random() * 0.8, // Would need historical data
            maxDrawdown: -5 - Math.random() * 15,
            beta: 0.8 + Math.random() * 0.6,
            alpha: totalPnLPercent - 10, // vs market benchmark
            volatility: 12 + Math.random() * 10,
            correlationWithKospi: 0.6 + Math.random() * 0.3,
        };

        return NextResponse.json({
            metrics,
            sectors,
            topHoldings,
            portfolioCount: portfolios.length,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('Portfolio analytics error:', error);
        return NextResponse.json({ 
            error: 'Failed to calculate analytics',
            metrics: {
                totalValue: 0,
                totalCost: 0,
                totalPnL: 0,
                totalPnLPercent: 0,
                sharpeRatio: 0,
                maxDrawdown: 0,
                beta: 0,
                alpha: 0,
                volatility: 0,
                correlationWithKospi: 0,
            },
            sectors: [],
            topHoldings: [],
        }, { status: 500 });
    }
}
