import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { HealthCheckService } from './health-check.service';

@Module({
    imports: [ConfigModule],
    controllers: [HealthController],
    providers: [HealthCheckService],
    exports: [HealthCheckService],
})
export class HealthModule {}
