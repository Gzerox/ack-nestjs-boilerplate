import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class TripFileAssetRequestDto {
    @IsString()
    bucket: string;

    @IsString()
    key: string;

    @IsString()
    @IsOptional()
    cdnUrl?: string;

    @IsString()
    completedUrl: string;

    @IsString()
    mime: string;

    @IsString()
    extension: string;

    @IsString()
    access: string;

    @IsInt()
    @Min(0)
    size: number;
}
