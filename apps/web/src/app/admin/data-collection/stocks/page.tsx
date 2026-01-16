'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect to main data collection page since stock collection is now integrated as a tab
export default function StocksRedirect() {
    const router = useRouter();
    
    useEffect(() => {
        router.replace('/admin/data-collection');
    }, [router]);

    return (
        <div className="flex items-center justify-center py-12">
            <div className="text-center">
                <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400 text-sm">리다이렉트 중...</p>
            </div>
        </div>
    );
}
