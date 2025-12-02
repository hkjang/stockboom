import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreatePortfolioDto {
    @ApiProperty({ example: 'My Portfolio' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'Main trading portfolio', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: 'broker-account-id' })
    @IsString()
    brokerAccountId: string;

    @ApiProperty({ example: 10000000 })
    @IsNumber()
    @Min(0)
    cashBalance: number;
}

export class UpdatePortfolioDto {
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
    @IsBoolean()
    autoTrade?: boolean;
}

export class AddPositionDto {
    @ApiProperty({ example: 'stock-id' })
    @IsString()
    stockId: string;

    @ApiProperty({ example: 10 })
    @IsNumber()
    @Min(1)
    quantity: number;

    @ApiProperty({ example: 50000 })
    @IsNumber()
    @Min(0)
    avgPrice: number;
}
