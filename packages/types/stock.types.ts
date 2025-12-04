// Stock Entity Types (별칭으로 Prisma Stock과 구분)
export interface StockEntity {
    id: string;
    symbol: string;
    name: string;
    market: 'KOSPI' | 'KOSDAQ' | 'KONEX';
    sector?: string;
    industry?: string;

    // OpenDart Company Info
    corpCode?: string;
    stockCode?: string;
    corpName?: string;
    corpNameEng?: string;
    ceoName?: string;
    corpCls?: string;
    address?: string;
    homePage?: string;
    irUrl?: string;
    phoneNumber?: string;
    faxNumber?: string;
    establishDate?: string;
    accountingMonth?: string;

    // Market Data
    currentPrice?: number;
    openPrice?: number;
    highPrice?: number;
    lowPrice?: number;
    volume?: number;
    marketCap?: number;

    // Status
    isActive: boolean;
    isTradable: boolean;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
    lastPriceUpdate?: Date;
}

// Stock Form Data (for editing)
export interface StockFormData {
    symbol: string;
    name: string;
    market: string;
    sector?: string;
    isActive: boolean;
    isTradable: boolean;

    // OpenDart fields
    corpCode?: string;
    stockCode?: string;
    corpName?: string;
    corpNameEng?: string;
    ceoName?: string;
    corpCls?: string;
    address?: string;
    homePage?: string;
    irUrl?: string;
    phoneNumber?: string;
    faxNumber?: string;

    // Market data
    currentPrice?: number;
    openPrice?: number;
    highPrice?: number;
    lowPrice?: number;
    volume?: number;
    marketCap?: number;
}

// Stock Statistics
export interface StockStats {
    candles: {
        count: number;
        lastUpdated?: Date;
    };
    indicators: {
        count: number;
        lastUpdated?: Date;
    };
    news: {
        count: number;
        lastUpdated?: Date;
    };
    aiReports: {
        count: number;
        lastUpdated?: Date;
    };
}

// Stock with stats (for list view)
export interface StockWithStats extends StockEntity {
    stats?: StockStats;
}

// API Response Types
export interface StockListResponse {
    stocks: StockWithStats[];
    total: number;
    page?: number;
    limit?: number;
}

export interface StockDetailResponse extends StockEntity {
    stats?: StockStats;
}

// Bulk Import Types
export interface BulkStockInput {
    symbol: string;
    name: string;
    market?: string;
    sector?: string;
}

export interface BulkImportResult {
    success: BulkStockInput[];
    failed: Array<{
        stock: BulkStockInput;
        error: string;
    }>;
}

// Data Collection Types
export interface DataCollectionJob {
    id: string;
    name: string;
    status: 'pending' | 'active' | 'completed' | 'failed';
    timestamp?: Date;
    failedReason?: string;
    progress?: number;
}

export interface CollectionJobsResponse {
    jobs: DataCollectionJob[];
}
