import crypto from 'crypto';

/**
 * Encrypt sensitive data (e.g., API keys)
 */
export function encrypt(text: string, key: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        Buffer.from(key.padEnd(32, '0').substring(0, 32)),
        iv
    );

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedText: string, key: string): string {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(key.padEnd(32, '0').substring(0, 32)),
        iv
    );

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Format number as Korean currency
 */
export function formatCurrency(amount: number): string {
    return `₩${amount.toLocaleString('ko-KR')}`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 2): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Calculate percentage change
 */
export function calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
): Promise<T> {
    let lastError: Error;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            if (i < maxRetries - 1) {
                await sleep(delay * Math.pow(2, i));
            }
        }
    }

    throw lastError!;
}

/**
 * Chunk array into smaller arrays
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/**
 * Generate random string
 */
export function generateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex').substring(0, length);
}

/**
 * Validate Korean stock code
 */
export function isValidKoreanStockCode(code: string): boolean {
    return /^\d{6}$/.test(code);
}

/**
 * Format timestamp for logging
 */
export function formatTimestamp(date: Date = new Date()): string {
    return date.toISOString();
}

export * from './validators';
