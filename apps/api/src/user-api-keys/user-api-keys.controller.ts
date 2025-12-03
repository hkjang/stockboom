import { Controller, Get, Put, Delete, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserApiKeysService, UserApiKeysDto } from './user-api-keys.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('UserApiKeys')
@Controller('user/api-keys')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserApiKeysController {
    constructor(private userApiKeysService: UserApiKeysService) { }

    @Get()
    @ApiOperation({ summary: 'Get own API keys (masked)' })
    async getOwnKeys(@Request() req: any) {
        const userId = req.user.userId;
        return this.userApiKeysService.getMaskedKeys(userId, userId, false);
    }

    @Put()
    @ApiOperation({ summary: 'Update own API keys' })
    async updateOwnKeys(@Request() req: any, @Body() data: UserApiKeysDto) {
        const userId = req.user.userId;
        await this.userApiKeysService.updateKeys(userId, data, userId, false);
        return { success: true, message: 'API keys updated successfully' };
    }

    @Delete()
    @ApiOperation({ summary: 'Delete own API keys' })
    async deleteOwnKeys(@Request() req: any) {
        const userId = req.user.userId;
        await this.userApiKeysService.deleteKeys(userId, userId, false);
        return { success: true, message: 'API keys deleted successfully' };
    }

    // Note: Test endpoint would require actual API testing logic
    // Commented out for now
    // @Post('test')
    // @ApiOperation({ summary: 'Test API keys validity' })
    // async testKeys(@Request() req: any) {
    //     const userId = req.user.userId;
    //     // TODO: Implement actual testing logic
    //     return { kis: false, opendart: false };
    // }
}
