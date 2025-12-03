import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullAdapter } from '@bull-board/api/bullAdapter';

@Module({
    imports: [
        // Register queues
        BullModule.registerQueue(
            {
                name: 'data-collection',
            },
            {
                name: 'analysis',
            },
            {
                name: 'trading',
            },
            {
                name: 'notification',
            },
        ),

        // Bull Board for monitoring
        // BullBoardModule.forRoot({
        //     route: '/monitor/queues',
        //     adapter: ExpressAdapter,
        // }),
    ],
    exports: [BullModule], // Export BullModule so other modules can inject queues
})
export class QueueModule { }
