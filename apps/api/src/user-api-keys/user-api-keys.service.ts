import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { prisma } from '@stockboom/database';
import { EncryptionService } from '../common/encryption.service';

export interface UserApiKeysDto {
    kisAppKey?: string;
    kisAppSecret?: string;
    kisAccountNumber?: string;
    kisMockMode?: boolean;
    openDartApiKey?: string;
    yahooApiKey?: string;
}

export interface DecryptedApiKeys {
    kisAppKey?: string;
    kisAppSecret?: string;
    kisAccountNumber?: string;
    kisMockMode: boolean;
    openDartApiKey?: string;
    yahooApiKey?: string;
}

@Injectable()
export class UserApiKeysService {
    private readonly logger = new Logger(UserApiKeysService.name);

    constructor(private encryptionService: EncryptionService) { }

    /**
     * Get decrypted API keys for a user
     * @param userId User ID
     * @param requesterId ID of the user making the request (for authorization)
     * @param isAdmin Whether the requester is an admin
     */
    async getKeys(userId: string, requesterId?: string, isAdmin: boolean = false): Promise<DecryptedApiKeys | null> {
        // Authorization check
        if (requesterId && requesterId !== userId && !isAdmin) {
            throw new ForbiddenException('You can only access your own API keys');
        }

        const apiKeys = await prisma.userApiKeys.findUnique({
            where: { userId },
        });

        if (!apiKeys) {
            return null;
        }

        // Decrypt keys
        return {
            kisAppKey: apiKeys.kisAppKey ? this.encryptionService.decrypt(apiKeys.kisAppKey) : undefined,
            kisAppSecret: apiKeys.kisAppSecret ? this.encryptionService.decrypt(apiKeys.kisAppSecret) : undefined,
            kisAccountNumber: apiKeys.kisAccountNumber || undefined,
            kisMockMode: apiKeys.kisMockMode,
            openDartApiKey: apiKeys.openDartApiKey ? this.encryptionService.decrypt(apiKeys.openDartApiKey) : undefined,
            yahooApiKey: apiKeys.yahooApiKey ? this.encryptionService.decrypt(apiKeys.yahooApiKey) : undefined,
        };
    }

    /**
     * Get masked API keys for display
     */
    async getMaskedKeys(userId: string, requesterId?: string, isAdmin: boolean = false) {
        const apiKeys = await prisma.userApiKeys.findUnique({
            where: { userId },
        });

        if (!apiKeys) {
            return null;
        }

        // Authorization check
        if (requesterId && requesterId !== userId && !isAdmin) {
            throw new ForbiddenException('You can only access your own API keys');
        }

        // Decrypt and mask
        return {
            kisAppKey: apiKeys.kisAppKey ? this.encryptionService.mask(this.encryptionService.decrypt(apiKeys.kisAppKey)) : null,
            kisAppSecret: apiKeys.kisAppSecret ? '****' : null,
            kisAccountNumber: apiKeys.kisAccountNumber || null,
            kisMockMode: apiKeys.kisMockMode,
            openDartApiKey: apiKeys.openDartApiKey ? this.encryptionService.mask(this.encryptionService.decrypt(apiKeys.openDartApiKey)) : null,
            yahooApiKey: apiKeys.yahooApiKey ? this.encryptionService.mask(this.encryptionService.decrypt(apiKeys.yahooApiKey)) : null,
            isActive: apiKeys.isActive,
            lastUsedAt: apiKeys.lastUsedAt,
        };
    }

    /**
     * Update API keys for a user
     */
    async updateKeys(userId: string, data: UserApiKeysDto, requesterId?: string, isAdmin: boolean = false): Promise<void> {
        // Authorization check
        if (requesterId && requesterId !== userId && !isAdmin) {
            throw new ForbiddenException('You can only update your own API keys');
        }

        // Encrypt keys
        const encryptedData: any = {};

        if (data.kisAppKey !== undefined) {
            encryptedData.kisAppKey = data.kisAppKey ? this.encryptionService.encrypt(data.kisAppKey) : null;
        }
        if (data.kisAppSecret !== undefined) {
            encryptedData.kisAppSecret = data.kisAppSecret ? this.encryptionService.encrypt(data.kisAppSecret) : null;
        }
        if (data.kisAccountNumber !== undefined) {
            encryptedData.kisAccountNumber = data.kisAccountNumber || null;
        }
        if (data.kisMockMode !== undefined) {
            encryptedData.kisMockMode = data.kisMockMode;
        }
        if (data.openDartApiKey !== undefined) {
            encryptedData.openDartApiKey = data.openDartApiKey ? this.encryptionService.encrypt(data.openDartApiKey) : null;
        }
        if (data.yahooApiKey !== undefined) {
            encryptedData.yahooApiKey = data.yahooApiKey ? this.encryptionService.encrypt(data.yahooApiKey) : null;
        }

        // Upsert keys
        await prisma.userApiKeys.upsert({
            where: { userId },
            update: encryptedData,
            create: {
                userId,
                ...encryptedData,
            },
        });

        this.logger.log(`Updated API keys for user ${userId}`);
    }

    /**
     * Delete API keys for a user
     */
    async deleteKeys(userId: string, requesterId?: string, isAdmin: boolean = false): Promise<void> {
        // Authorization check
        if (requesterId && requesterId !== userId && !isAdmin) {
            throw new ForbiddenException('You can only delete your own API keys');
        }

        await prisma.userApiKeys.delete({
            where: { userId },
        });

        this.logger.log(`Deleted API keys for user ${userId}`);
    }

    /**
     * Check if user has API keys configured
     */
    async hasKeys(userId: string): Promise<boolean> {
        const count = await prisma.userApiKeys.count({
            where: { userId },
        });
        return count > 0;
    }

    /**
     * Update last used timestamp
     */
    async updateLastUsed(userId: string): Promise<void> {
        await prisma.userApiKeys.update({
            where: { userId },
            data: { lastUsedAt: new Date() },
        });
    }
}
