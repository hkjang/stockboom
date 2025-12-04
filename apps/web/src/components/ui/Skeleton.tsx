'use client';

import { ReactNode } from 'react';

interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
}

export function Skeleton({ className = '', width, height }: SkeletonProps) {
    const style: React.CSSProperties = {};
    if (width) style.width = typeof width === 'number' ? `${width}px` : width;
    if (height) style.height = typeof height === 'number' ? `${height}px` : height;

    return (
        <div
            className={`animate-pulse bg-gray-200 rounded ${className}`}
            style={style}
        />
    );
}

interface SkeletonTextProps {
    lines?: number;
    className?: string;
}

export function SkeletonText({ lines = 3, className = '' }: SkeletonTextProps) {
    return (
        <div className={`space-y-2 ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    height={16}
                    width={i === lines - 1 ? '60%' : '100%'}
                />
            ))}
        </div>
    );
}

interface SkeletonTableProps {
    rows?: number;
    cols?: number;
}

export function SkeletonTable({ rows = 5, cols = 5 }: SkeletonTableProps) {
    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex gap-4">
                {Array.from({ length: cols }).map((_, i) => (
                    <Skeleton key={i} height={20} className="flex-1" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIdx) => (
                <div key={rowIdx} className="flex gap-4">
                    {Array.from({ length: cols }).map((_, colIdx) => (
                        <Skeleton key={colIdx} height={16} className="flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

interface SkeletonCardProps {
    children?: ReactNode;
    className?: string;
}

export function SkeletonCard({ className = '' }: SkeletonCardProps) {
    return (
        <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
            <Skeleton height={24} width="40%" className="mb-4" />
            <SkeletonText lines={2} />
        </div>
    );
}
