import type { Metadata } from 'next'
import { ToastProvider } from '@/components/ui/Toast'
import './globals.css'

export const metadata: Metadata = {
    title: 'StockBoom - 주식 자동 매매 시스템',
    description: 'AI 기반 주식 자동 매매 플랫폼',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="ko">
            <body>
                <ToastProvider>{children}</ToastProvider>
            </body>
        </html>
    )
}
