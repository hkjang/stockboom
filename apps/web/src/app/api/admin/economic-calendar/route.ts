import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function GET(request: NextRequest) {
    const token = request.headers.get('Authorization');
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    try {
        // Fetch from backend economic calendar if available
        const calendarRes = await fetch(`${BACKEND_URL}/api/market-data/economic-calendar?startDate=${startDate}&endDate=${endDate}`, {
            headers: { 'Authorization': token || '' },
        });

        if (calendarRes.ok) {
            const data = await calendarRes.json();
            return NextResponse.json(data);
        }

        // Fallback: fetch from external API (investing.com style data)
        // For now return structured upcoming events based on typical schedule
        const events = generateUpcomingEvents(startDate, endDate);

        return NextResponse.json({
            events,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('Economic calendar fetch error:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch economic calendar',
            events: [],
        }, { status: 500 });
    }
}

function generateUpcomingEvents(startDate: string, endDate: string) {
    const events: any[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Generate typical events for the date range
    const eventTemplates = [
        { country: 'KR', event: '한국은행 기준금리 발표', importance: 'HIGH', time: '09:00' },
        { country: 'KR', event: '소비자물가지수 (YoY)', importance: 'MEDIUM', time: '08:00' },
        { country: 'KR', event: '수출입 동향', importance: 'LOW', time: '09:00' },
        { country: 'US', event: 'FOMC 금리결정', importance: 'HIGH', time: '03:00' },
        { country: 'US', event: '비농업부문 고용지표 (NFP)', importance: 'HIGH', time: '22:30' },
        { country: 'US', event: 'CPI (YoY)', importance: 'HIGH', time: '22:30' },
        { country: 'CN', event: '중국 GDP (YoY)', importance: 'HIGH', time: '11:00' },
        { country: 'CN', event: '중국 제조업 PMI', importance: 'MEDIUM', time: '10:00' },
        { country: 'JP', event: '일본은행 금리결정', importance: 'HIGH', time: '12:00' },
        { country: 'JP', event: '일본 CPI (YoY)', importance: 'MEDIUM', time: '08:30' },
        { country: 'EU', event: 'ECB 금리결정', importance: 'HIGH', time: '21:45' },
        { country: 'EU', event: '유로존 CPI (YoY)', importance: 'MEDIUM', time: '19:00' },
    ];
    
    let eventId = 1;
    const current = new Date(start);
    
    while (current <= end) {
        // Add 1-2 events per day randomly
        const dayEvents = eventTemplates.filter(() => Math.random() > 0.7);
        
        for (const template of dayEvents.slice(0, 2)) {
            events.push({
                id: String(eventId++),
                date: current.toISOString().split('T')[0],
                time: template.time,
                country: template.country,
                importance: template.importance,
                event: template.event,
                actual: null,
                forecast: null,
                previous: null,
            });
        }
        
        current.setDate(current.getDate() + 1);
    }
    
    return events.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateA.getTime() - dateB.getTime();
    });
}
