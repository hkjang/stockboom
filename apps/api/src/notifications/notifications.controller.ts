import { Controller, Get, Put, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
    constructor(private notificationsService: NotificationsService) { }

    @Get()
    @ApiOperation({ summary: 'Get all user notifications' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'isRead', required: false, type: Boolean })
    async findAll(
        @Request() req,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('isRead') isRead?: boolean,
    ) {
        const skip = page && limit ? (page - 1) * limit : undefined;
        const take = limit || 50;

        return this.notificationsService.findAll(req.user.userId, {
            skip,
            take,
            isRead,
        });
    }

    @Get('unread-count')
    @ApiOperation({ summary: 'Get unread notification count' })
    async getUnreadCount(@Request() req) {
        const count = await this.notificationsService.getUnreadCount(req.user.userId);
        return { count };
    }

    @Put(':id/read')
    @ApiOperation({ summary: 'Mark notification as read' })
    async markAsRead(@Param('id') id: string, @Request() req) {
        return this.notificationsService.markAsRead(id, req.user.userId);
    }

    @Put('read-all')
    @ApiOperation({ summary: 'Mark all notifications as read' })
    async markAllAsRead(@Request() req) {
        const count = await this.notificationsService.markAllAsRead(req.user.userId);
        return { marked: count };
    }
}
