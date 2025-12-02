import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsObject, IsBoolean } from 'class-validator';
import { AlertType } from '@stockboom/database';

export class CreateAlertDto {
    @ApiProperty({ enum: AlertType, example: 'PRICE_CHANGE' })
    @IsEnum(AlertType)
    type: AlertType;

    @ApiProperty({ example: 'Samsung Price Alert' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'Alert when price changes by 5%', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({
        example: { symbol: '005930', changePercent: 5, direction: 'UP' },
        description: 'Alert conditions (JSON)',
    })
    @IsObject()
    conditions: any;

    @ApiProperty({ default: true, required: false })
    @IsOptional()
    @IsBoolean()
    webPush?: boolean;

    @ApiProperty({ default: false, required: false })
    @IsOptional()
    @IsBoolean()
    email?: boolean;
}

export class UpdateAlertDto {
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
    conditions?: any;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    webPush?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    email?: boolean;
}
