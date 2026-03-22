import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { SurveyUserResponseDto } from '@modules/survey/dtos/response/survey-user.response.dto';
import { SurveyRecipientResponseDto } from '@modules/survey/dtos/response/survey-recipient.response.dto';

export class SurveyWithRecipientResponseDto {
    @ApiProperty({
        description: 'Survey details',
        type: SurveyUserResponseDto,
        required: true,
    })
    @Type(() => SurveyUserResponseDto)
    survey: SurveyUserResponseDto;

    @ApiProperty({
        description: 'Recipient record for the current user',
        type: SurveyRecipientResponseDto,
        required: true,
    })
    @Type(() => SurveyRecipientResponseDto)
    recipient: SurveyRecipientResponseDto;
}
