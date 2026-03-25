import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestRequiredPipe } from '@common/request/pipes/request.required.pipe';
import { RequestIsValidObjectIdPipe } from '@common/request/pipes/request.is-valid-object-id.pipe';
import {
    Response,
    ResponsePaging,
} from '@common/response/decorators/response.decorator';
import {
    IResponsePagingReturn,
    IResponseReturn,
} from '@common/response/interfaces/response.interface';
import { UserProtected } from '@modules/user/decorators/user.decorator';
import {
    AuthJwtAccessProtected,
    AuthJwtPayload,
} from '@modules/auth/decorators/auth.jwt.decorator';
import { ApiKeyProtected } from '@modules/api-key/decorators/api-key.decorator';
import { TermPolicyAcceptanceProtected } from '@modules/term-policy/decorators/term-policy.decorator';
import {
    PaginationOffsetQuery,
    PaginationQueryFilterInEnum,
} from '@common/pagination/decorators/pagination.decorator';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { EnumFormResponseStatus, Prisma } from '@generated/prisma-client';
import { FormService } from '@modules/form/services/form.service';
import { FormSubmitRequestDto } from '@modules/form/dtos/request/form-submit.request.dto';
import { FormResponseResponseDto } from '@modules/form/dtos/response/form-response.response.dto';
import { FormWithResponseResponseDto } from '@modules/form/dtos/response/form-with-response.response.dto';
import {
    FormUserGetDoc,
    FormUserListDoc,
    FormUserSubmitDoc,
} from '@modules/form/docs/form.user.doc';
import {
    FORM_TAG_USER,
    FormDefaultResponseStatus,
} from '@modules/form/constants/form.constant';

@ApiTags(FORM_TAG_USER)
@Controller({ version: '1', path: '/forms' })
export class FormUserController {
    constructor(private readonly formService: FormService) {}

    @FormUserListDoc()
    @ResponsePaging('form.list')
    @TermPolicyAcceptanceProtected()
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/')
    async list(
        @AuthJwtPayload('userId') userId: string,
        @PaginationOffsetQuery()
        pagination: IPaginationQueryOffsetParams<
            Prisma.FormResponseSelect,
            Prisma.FormResponseWhereInput
        >,
        @PaginationQueryFilterInEnum<EnumFormResponseStatus>(
            'status',
            FormDefaultResponseStatus
        )
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<FormResponseResponseDto>> {
        return this.formService.getMyFormList(userId, pagination, status);
    }

    @FormUserGetDoc()
    @Response('form.get')
    @TermPolicyAcceptanceProtected()
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @Get('/:idForm')
    async get(
        @AuthJwtPayload('userId') userId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string,
        @Query('assignmentId', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        assignmentId: string
    ): Promise<IResponseReturn<FormWithResponseResponseDto>> {
        return this.formService.getMyForm(idForm, userId, assignmentId);
    }

    @FormUserSubmitDoc()
    @Response('form.submit')
    @TermPolicyAcceptanceProtected()
    @UserProtected()
    @AuthJwtAccessProtected()
    @ApiKeyProtected()
    @HttpCode(HttpStatus.OK)
    @Post('/:idForm/submit')
    async submit(
        @AuthJwtPayload('userId') userId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidObjectIdPipe)
        idForm: string,
        @Body() dto: FormSubmitRequestDto
    ): Promise<IResponseReturn<FormResponseResponseDto>> {
        return this.formService.submitForm(idForm, dto, userId);
    }
}
