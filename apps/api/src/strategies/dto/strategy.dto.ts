import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsNumber, IsObject, IsBoolean, IsDateString, Min } from 'class-validator';
import { StrategyType } from '@stockboom/database';

export class CreateStrategyDto {
    @ApiProperty({ example: 'RSI Oversold Strategy' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'Buy when RSI < 30, Sell when RSI > 70', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ enum: StrategyType, example: 'INDICATOR_BASED' })
    @IsEnum(StrategyType)
    type: StrategyType;

    @ApiProperty({
        example: { indicator: 'RSI', oversold: 30, overbought: 70 },
        description: 'Strategy configuration (JSON)',
    })
    @IsObject()
    config: any;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    portfolioId?: string;

    @ApiProperty({ example: 5, required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    stopLossPercent?: number;

    @ApiProperty({ example: 10, required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    takeProfitPercent?: number;

    @ApiProperty({ example: 5000000, required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    maxPositionSize?: number;
}

export class UpdateStrategyDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsObject()
    config?: any;
}

export class BacktestDto {
    @ApiProperty({ example: 'stock-id' })
    @IsString()
    stockId: string;

    @ApiProperty({ example: '2023-01-01' })
    @IsDateString()
    startDate: Date;

    @ApiProperty({ example: '2023-12-31' })
    @IsDateString()
    endDate: Date;

    @ApiProperty({ example: 10000000 })
    @IsNumber()
    @Min(0)
    initialCapital: number;
}
