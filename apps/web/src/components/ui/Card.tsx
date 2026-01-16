'use client';

import { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    title?: string;
}

export function Card({ children, className = '', title }: CardProps) {
    return (
        <div className={`bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6 ${className}`}>
            {title && <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>}
            {children}
        </div>
    );
}
