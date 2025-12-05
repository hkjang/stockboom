'use client';

import { useState, useCallback, DragEvent } from 'react';

interface FileDropzoneProps {
    onFileSelect: (file: File) => void;
    accept?: string;
    maxSize?: number;
    loading?: boolean;
    currentFile?: File | null;
}

export function FileDropzone({
    onFileSelect,
    accept = '.xml,.zip',
    maxSize = 50 * 1024 * 1024, // 50MB default
    loading = false,
    currentFile = null,
}: FileDropzoneProps) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const validateFile = (file: File): boolean => {
        setError(null);

        // Check file size
        if (file.size > maxSize) {
            setError(`파일 크기가 너무 큽니다. (최대 ${Math.round(maxSize / 1024 / 1024)}MB)`);
            return false;
        }

        // Check file extension
        const validExtensions = accept.split(',').map(ext => ext.trim().toLowerCase());
        const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!validExtensions.includes(fileExt)) {
            setError(`지원하지 않는 파일 형식입니다. (${accept})`);
            return false;
        }

        return true;
    };

    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const file = e.dataTransfer.files?.[0];
        if (file && validateFile(file)) {
            onFileSelect(file);
        }
    }, [onFileSelect]);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && validateFile(file)) {
            onFileSelect(file);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    return (
        <div className="space-y-3">
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                    relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer
                    ${isDragOver
                        ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
                        : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
                    }
                    ${loading ? 'opacity-50 pointer-events-none' : ''}
                `}
                onClick={() => document.getElementById('file-input')?.click()}
            >
                <input
                    id="file-input"
                    type="file"
                    accept={accept}
                    onChange={handleFileInput}
                    className="hidden"
                    disabled={loading}
                />

                <div className="flex flex-col items-center gap-3 text-center">
                    {isDragOver ? (
                        <>
                            <div className="p-4 rounded-full bg-blue-500/20">
                                <DropIcon className="w-8 h-8 text-blue-400" />
                            </div>
                            <p className="text-blue-400 font-medium">파일을 놓으세요!</p>
                        </>
                    ) : currentFile ? (
                        <>
                            <div className="p-4 rounded-full bg-emerald-500/20">
                                <FileIcon className="w-8 h-8 text-emerald-400" />
                            </div>
                            <div>
                                <p className="font-medium text-white">{currentFile.name}</p>
                                <p className="text-sm text-gray-400">{formatFileSize(currentFile.size)}</p>
                            </div>
                            <p className="text-xs text-gray-500">다른 파일을 선택하려면 클릭하거나 드래그하세요</p>
                        </>
                    ) : (
                        <>
                            <div className="p-4 rounded-full bg-gray-700">
                                <UploadIcon className="w-8 h-8 text-gray-400" />
                            </div>
                            <div>
                                <p className="font-medium text-gray-300">
                                    파일을 드래그하거나 클릭하여 선택
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                    XML 또는 ZIP 파일 (최대 {Math.round(maxSize / 1024 / 1024)}MB)
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {loading && (
                    <div className="absolute inset-0 bg-gray-900/50 rounded-xl flex items-center justify-center">
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-blue-400">업로드 중...</span>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-400">{error}</p>
                </div>
            )}
        </div>
    );
}

// Icons
function UploadIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
    );
}

function DropIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
    );
}

function FileIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    );
}
