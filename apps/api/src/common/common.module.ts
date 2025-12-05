import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EncryptionService } from './encryption.service';
import { AuditLogService } from './audit-log.service';
import { IpWhitelistGuard } from './guards/ip-whitelist.guard';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [EncryptionService, AuditLogService, IpWhitelistGuard],
    exports: [EncryptionService, AuditLogService, IpWhitelistGuard],
})
export class CommonModule { }
