import { ApiProperty } from '@nestjs/swagger';

export class FormMetricsResponseDto {
    @ApiProperty({ description: 'Total number of assigned respondents', example: 100, required: true })
    assignedCount: number;

    @ApiProperty({ description: 'Number of respondents who have not started', example: 40, required: true })
    notStartedCount: number;

    @ApiProperty({ description: 'Number of respondents who submitted', example: 60, required: true })
    submittedCount: number;

    @ApiProperty({ description: 'Completion rate as a percentage (0–100)', example: 60.0, required: true })
    completionRate: number;
}
