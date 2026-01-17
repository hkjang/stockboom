'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Clock, Wifi, WifiOff } from 'lucide-react';

interface MarketStatus {
    isOpen: boolean;
    market: 'KOSPI' | 'KOSDAQ' | 'US';
    currentValue: number;
    change: number;
    changePercent: number;
    nextOpenTime?: string;
}

export default function MarketStatusIndicator() {
    const [status, setStatus] = useState<MarketStatus | null>(null);
    const [isConnected, setIsConnected] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        // 시간 업데이트
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        // 시장 상태 체크
        checkMarketStatus();
        const marketTimer = setInterval(checkMarketStatus, 60000);

        return () => {
            clearInterval(timer);
            clearInterval(marketTimer);
        };
    }, []);

    const checkMarketStatus = () => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const day = now.getDay();

        // 한국 시장 (월~금, 9:00~15:30)
        const isWeekday = day >= 1 && day <= 5;
        const isMarketHours = (hours === 9 && minutes >= 0) || 
                              (hours > 9 && hours < 15) || 
                              (hours === 15 && minutes <= 30);
        
        const isOpen = isWeekday && isMarketHours;

        // 모의 데이터
        setStatus({
            isOpen,
            market: 'KOSPI',
            currentValue: 2534.12,
            change: 15.34,
            changePercent: 0.61,
            nextOpenTime: isOpen ? undefined : '내일 09:00',
        });
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    if (!status) return null;

    return (
        <div className="flex items-center gap-4 px-4 py-2 bg-white/5 backdrop-blur-lg rounded-lg border border-white/10">
            {/* 연결 상태 */}
            <div className="flex items-center gap-1">
                {isConnected ? (
                    <Wifi size={14} className="text-green-400" />
                ) : (
                    <WifiOff size={14} className="text-red-400" />
                )}
            </div>

            {/* 시간 */}
            <div className="flex items-center gap-1.5 text-xs">
                <Clock size={12} className="text-blue-400" />
                <span className="text-blue-200 font-mono">{formatTime(currentTime)}</span>
            </div>

            {/* 구분선 */}
            <div className="w-px h-4 bg-white/20" />

            {/* 시장 상태 */}
            <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                    status.isOpen 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-gray-500/20 text-gray-400'
                }`}>
                    {status.isOpen ? '장중' : '장마감'}
                </span>
                <span className="text-xs text-blue-200 font-medium">{status.market}</span>
                <span className="text-xs text-white font-bold">
                    {status.currentValue.toLocaleString()}
                </span>
                <span className={`flex items-center gap-0.5 text-xs font-medium ${
                    status.change >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                    {status.change >= 0 ? (
                        <TrendingUp size={12} />
                    ) : (
                        <TrendingDown size={12} />
                    )}
                    {status.change >= 0 ? '+' : ''}{status.changePercent.toFixed(2)}%
                </span>
            </div>

            {/* 다음 개장 시간 */}
            {!status.isOpen && status.nextOpenTime && (
                <>
                    <div className="w-px h-4 bg-white/20" />
                    <span className="text-[10px] text-gray-400">
                        다음 개장: {status.nextOpenTime}
                    </span>
                </>
            )}
        </div>
    );
}
