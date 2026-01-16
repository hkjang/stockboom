import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
    imports: [MarketDataModule],
    providers: [WebsocketGateway],
    exports: [WebsocketGateway],
})
export class WebsocketModule { }

