import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EncryptionService } from './encryption.service';
import { AuditLogService } from './audit-log.service';
import { IpWhitelistGuard } from './guards/ip-whitelist.guard';
import { LoggerService } from './logger.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [EncryptionService, AuditLogService, IpWhitelistGuard, LoggerService],
    exports: [EncryptionService, AuditLogService, IpWhitelistGuard, LoggerService],
})
export class CommonModule { }

