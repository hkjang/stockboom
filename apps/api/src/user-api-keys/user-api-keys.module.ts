import { Module } from '@nestjs/common';
import { UserApiKeysService } from './user-api-keys.service';
import { UserApiKeysController } from './user-api-keys.controller';
import { CommonModule } from '../common/common.module';

@Module({
    imports: [CommonModule],
    controllers: [UserApiKeysController],
    providers: [UserApiKeysService],
    exports: [UserApiKeysService],
})
export class UserApiKeysModule { }
