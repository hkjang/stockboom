'use client';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    showPageNumbers?: number;
}

export function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    showPageNumbers = 5,
}: PaginationProps) {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const halfShow = Math.floor(showPageNumbers / 2);

        let start = Math.max(1, currentPage - halfShow);
        let end = Math.min(totalPages, currentPage + halfShow);

        // Adjust if at the beginning or end
        if (currentPage <= halfShow) {
            end = Math.min(totalPages, showPageNumbers);
        }
        if (currentPage > totalPages - halfShow) {
            start = Math.max(1, totalPages - showPageNumbers + 1);
        }

        // Add first page and ellipsis
        if (start > 1) {
            pages.push(1);
            if (start > 2) pages.push('...');
        }

        // Add page numbers
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        // Add last page and ellipsis
        if (end < totalPages) {
            if (end < totalPages - 1) pages.push('...');
            pages.push(totalPages);
        }

        return pages;
    };

    return (
        <div className="flex items-center justify-center gap-1">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                ←
            </button>

            {getPageNumbers().map((page, index) =>
                typeof page === 'string' ? (
                    <span key={`ellipsis-${index}`} className="px-2 py-1 text-gray-500">
                        {page}
                    </span>
                ) : (
                    <button
                        key={page}
                        onClick={() => onPageChange(page)}
                        className={`px-3 py-1 rounded border ${currentPage === page
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300 bg-white hover:bg-gray-50'
                            }`}
                    >
                        {page}
                    </button>
                )
            )}

            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                →
            </button>
        </div>
    );
}

interface PaginationInfoProps {
    currentPage: number;
    pageSize: number;
    totalItems: number;
}

export function PaginationInfo({ currentPage, pageSize, totalItems }: PaginationInfoProps) {
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);

    return (
        <div className="text-sm text-gray-600">
            {totalItems > 0 ? (
                <>
                    <span className="font-medium">{start}</span>-<span className="font-medium">{end}</span> / 총{' '}
                    <span className="font-medium">{totalItems}</span>개
                </>
            ) : (
                '결과 없음'
            )}
        </div>
    );
}
