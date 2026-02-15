import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsCustomEmail } from '@common/request/validations/request.custom-email.validation';
import { Transform } from 'class-transformer';

export class ProjectMemberInviteCreateRequestDto {
    @ApiProperty({
        required: true,
        description: 'Email address to invite',
    })
    @IsCustomEmail()
    @IsNotEmpty()
    @MaxLength(100)
    @Transform(({ value }) => value.toLowerCase().trim())
    email: string;

    @ApiProperty({
        required: true,
        description: 'Role name for project member',
        example: 'project-viewer',
    })
    @IsString()
    @IsNotEmpty()
    roleName: string;
}
