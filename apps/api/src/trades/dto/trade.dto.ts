import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsBoolean, Min } from 'class-validator';
import { OrderType, OrderSide } from '@stockboom/database';

export class CreateTradeDto {
    @ApiProperty({ example: 'broker-account-id' })
    @IsString()
    brokerAccountId: string;

    @ApiProperty({ example: 'stock-id' })
    @IsString()
    stockId: string;

    @ApiProperty({ enum: OrderType, example: 'MARKET' })
    @IsEnum(OrderType)
    orderType: OrderType;

    @ApiProperty({ enum: OrderSide, example: 'BUY' })
    @IsEnum(OrderSide)
    orderSide: OrderSide;

    @ApiProperty({ example: 10 })
    @IsNumber()
    @Min(1)
    quantity: number;

    @ApiProperty({ example: 50000, required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    limitPrice?: number;

    @ApiProperty({ example: 45000, required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    stopPrice?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    strategyId?: string;

    @ApiProperty({ required: false, default: false })
    @IsOptional()
    @IsBoolean()
    isAutoTrade?: boolean;
}
