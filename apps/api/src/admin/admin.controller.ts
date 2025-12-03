import { Controller, Get, Patch, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { AdminGuard } from '../auth/guards/admin.guard'; // TODO: Implement admin role guard

@ApiTags('Admin')
@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard) // TODO: Add AdminGuard
@ApiBearerAuth()
export class AdminController {
    constructor(private adminService: AdminService) { }

    @Get('stats')
    @ApiOperation({ summary: 'Get system statistics' })
    async getStats() {
        return this.adminService.getSystemStats();
    }

    @Get('metrics')
    @ApiOperation({ summary: 'Get system metrics (CPU, memory, etc.)' })
    async getMetrics() {
        return this.adminService.getSystemMetrics();
    }

    @Get('queues')
    @ApiOperation({ summary: 'Get queue status' })
    async getQueues() {
        console.log('AdminController.getQueues called');
        return this.adminService.getQueueStatus();
    }

    @Get('users')
    @ApiOperation({ summary: 'Get all users' })
    async getUsers() {
        return this.adminService.getAllUsers();
    }

    @Patch('users/:userId')
    @ApiOperation({ summary: 'Update user' })
    async updateUser(
        @Param('userId') userId: string,
        @Body() body: { isActive?: boolean; name?: string; email?: string },
    ) {
        if (body.isActive !== undefined) {
            return this.adminService.updateUserStatus(userId, body.isActive);
        }
        return this.adminService.updateUser(userId, body);
    }

    @Delete('users/:userId')
    @ApiOperation({ summary: 'Delete user' })
    async deleteUser(@Param('userId') userId: string) {
        return this.adminService.deleteUser(userId);
    }

    @Post('users/:userId/reset-password')
    @ApiOperation({ summary: 'Reset user password' })
    async resetPassword(@Param('userId') userId: string) {
        return this.adminService.resetUserPassword(userId);
    }

    @Get('queues/:queueName/failed')
    @ApiOperation({ summary: 'Get failed jobs for a queue' })
    async getFailedJobs(
        @Param('queueName') queueName: string,
        @Query('limit') limit?: number,
    ) {
        return this.adminService.getFailedJobs(queueName, limit ? parseInt(limit as any) : 10);
    }

    @Post('queues/:queueName/jobs/:jobId/retry')
    @ApiOperation({ summary: 'Retry a failed job' })
    async retryJob(
        @Param('queueName') queueName: string,
        @Param('jobId') jobId: string,
    ) {
        return this.adminService.retryFailedJob(queueName, jobId);
    }

    @Delete('queues/:queueName/completed')
    @ApiOperation({ summary: 'Clear completed jobs from queue' })
    async clearCompleted(@Param('queueName') queueName: string) {
        return this.adminService.clearCompletedJobs(queueName);
    }
}
