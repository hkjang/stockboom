'use client';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'success' | 'danger' | 'warning' | 'info' | 'default';
    size?: 'sm' | 'md' | 'lg';
}

export function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
    const variants = {
        success: 'bg-green-500/20 text-green-400',
        danger: 'bg-red-500/20 text-red-400',
        warning: 'bg-amber-500/20 text-amber-400',
        info: 'bg-blue-500/20 text-blue-400',
        default: 'bg-white/10 text-gray-300',
    };

    const sizes = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-sm',
        lg: 'px-3 py-1.5 text-base',
    };

    return (
        <span className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]}`}>
            {children}
        </span>
    );
}
