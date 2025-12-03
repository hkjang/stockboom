import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { QueueModule } from '../queue/queue.module';
import { UserApiKeysModule } from '../user-api-keys/user-api-keys.module';
import { DataSourceModule } from '../data-source/data-source.module';

@Module({
    imports: [QueueModule, UserApiKeysModule, DataSourceModule],
    controllers: [AdminController],
    providers: [AdminService],
    exports: [AdminService],
})
export class AdminModule { }
