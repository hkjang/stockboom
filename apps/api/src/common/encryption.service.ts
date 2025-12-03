import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Encryption Service for securely storing API keys and sensitive data
 * Uses AES-256-GCM encryption
 */
@Injectable()
export class EncryptionService {
    private readonly algorithm = 'aes-256-gcm';
    private readonly keyLength = 32; // 256 bits
    private readonly ivLength = 16; // 128 bits
    private readonly encryptionKey: Buffer;

    constructor(private configService: ConfigService) {
        const key = this.configService.get<string>('ENCRYPTION_KEY');

        if (!key) {
            throw new Error('ENCRYPTION_KEY environment variable is required');
        }

        // Convert base64 key to buffer
        this.encryptionKey = Buffer.from(key, 'base64');

        if (this.encryptionKey.length !== this.keyLength) {
            throw new Error(`ENCRYPTION_KEY must be ${this.keyLength} bytes (base64 encoded)`);
        }
    }

    /**
     * Encrypt plaintext data
     * @param plaintext Data to encrypt
     * @returns Encrypted data in format: iv:authTag:ciphertext (all base64)
     */
    encrypt(plaintext: string): string {
        if (!plaintext) {
            return '';
        }

        // Generate random IV
        const iv = crypto.randomBytes(this.ivLength);

        // Create cipher
        const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

        // Encrypt data
        let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
        ciphertext += cipher.final('base64');

        // Get authentication tag
        const authTag = cipher.getAuthTag();

        // Return format: iv:authTag:ciphertext (all base64 encoded)
        return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext}`;
    }

    /**
     * Decrypt encrypted data
     * @param encrypted Encrypted data in format: iv:authTag:ciphertext
     * @returns Decrypted plaintext
     */
    decrypt(encrypted: string): string {
        if (!encrypted) {
            return '';
        }

        try {
            // Parse encrypted data
            const parts = encrypted.split(':');
            if (parts.length !== 3) {
                throw new Error('Invalid encrypted data format');
            }

            const iv = Buffer.from(parts[0], 'base64');
            const authTag = Buffer.from(parts[1], 'base64');
            const ciphertext = parts[2];

            // Create decipher
            const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
            decipher.setAuthTag(authTag);

            // Decrypt data
            let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
            plaintext += decipher.final('utf8');

            return plaintext;
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    /**
     * Mask a string for display (show first 4 and last 4 chars)
     * @param value String to mask
     * @returns Masked string
     */
    mask(value: string): string {
        if (!value || value.length <= 8) {
            return '****';
        }

        const first = value.substring(0, 4);
        const last = value.substring(value.length - 4);
        const middle = '*'.repeat(Math.min(value.length - 8, 20));

        return `${first}${middle}${last}`;
    }

    /**
     * Generate a random encryption key (for setup)
     * @returns Base64 encoded random key
     */
    static generateKey(): string {
        return crypto.randomBytes(32).toString('base64');
    }
}
