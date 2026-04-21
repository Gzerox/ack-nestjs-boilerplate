import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestRequiredPipe } from '@common/request/pipes/request.required.pipe';
import { RequestIsValidUuidPipe } from '@common/request/pipes/request.is-valid-uuid.pipe';
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
import { FeatureFlagProtected } from '@modules/feature-flag/decorators/feature-flag.decorator';
import { TermPolicyAcceptanceProtected } from '@modules/term-policy/decorators/term-policy.decorator';
import {
    PaginationOffsetQuery,
    PaginationQueryFilterInEnum,
} from '@common/pagination/decorators/pagination.decorator';
import {
    IPaginationIn,
    IPaginationQueryOffsetParams,
} from '@common/pagination/interfaces/pagination.interface';
import { EnumTripFormResponseStatus, Prisma } from '@generated/prisma-client';
import { TripFormService } from '@modules/trip-form/services/trip-form.service';
import { TripFormSubmitRequestDto } from '@modules/trip-form/dtos/request/trip-form-submit.request.dto';
import { TripFormResponseResponseDto } from '@modules/trip-form/dtos/response/trip-form-response.response.dto';
import { TripFormWithResponseResponseDto } from '@modules/trip-form/dtos/response/trip-form-with-response.response.dto';
import {
    TripFormUserGetDoc,
    TripFormUserListDoc,
    TripFormUserSubmitDoc,
} from '@modules/trip-form/docs/trip-form.user.doc';
import {
    TRIP_FORM_TAG_USER,
    TripFormAvailableResponseStatus,
} from '@modules/trip-form/constants/trip-form.constant';

@ApiTags(TRIP_FORM_TAG_USER)
@Controller({ version: '1', path: '/trips' })
export class TripFormUserController {
    constructor(private readonly tripFormService: TripFormService) {}

    @TripFormUserListDoc()
    @TermPolicyAcceptanceProtected()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @ResponsePaging('trip-form.list')
    @Get('/:idTrip/forms')
    async list(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestRequiredPipe, RequestIsValidUuidPipe)
        tripId: string,
        @PaginationOffsetQuery()
        pagination: IPaginationQueryOffsetParams<
            Prisma.TripFormAssignmentSelect,
            Prisma.TripFormAssignmentWhereInput
        >,
        @PaginationQueryFilterInEnum<EnumTripFormResponseStatus>(
            'status',
            TripFormAvailableResponseStatus
        )
        status?: Record<string, IPaginationIn>
    ): Promise<IResponsePagingReturn<TripFormResponseResponseDto>> {
        return this.tripFormService.getMyFormList(userId, tripId, pagination, status);
    }

    @TripFormUserGetDoc()
    @TermPolicyAcceptanceProtected()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip-form.get')
    @Get('/:idTrip/forms/:idForm/assignments/:assignmentId')
    async get(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestRequiredPipe, RequestIsValidUuidPipe)
        tripId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidUuidPipe)
        idForm: string,
        @Param(
            'assignmentId',
            RequestRequiredPipe,
            RequestIsValidUuidPipe
        )
        assignmentId: string
    ): Promise<IResponseReturn<TripFormWithResponseResponseDto>> {
        return this.tripFormService.getMyForm(tripId, idForm, userId, assignmentId);
    }

    @TripFormUserSubmitDoc()
    @TermPolicyAcceptanceProtected()
    @UserProtected()
    @AuthJwtAccessProtected()
    @FeatureFlagProtected('trip')
    @ApiKeyProtected()
    @Response('trip-form.submit')
    @HttpCode(HttpStatus.OK)
    @Post('/:idTrip/forms/:idForm/assignments/:assignmentId/submit')
    async submit(
        @AuthJwtPayload('userId') userId: string,
        @Param('idTrip', RequestRequiredPipe, RequestIsValidUuidPipe)
        tripId: string,
        @Param('idForm', RequestRequiredPipe, RequestIsValidUuidPipe)
        idForm: string,
        @Param(
            'assignmentId',
            RequestRequiredPipe,
            RequestIsValidUuidPipe
        )
        assignmentId: string,
        @Body() dto: TripFormSubmitRequestDto
    ): Promise<IResponseReturn<TripFormResponseResponseDto>> {
        return this.tripFormService.submitForm(
            tripId,
            idForm,
            assignmentId,
            dto,
            userId
        );
    }
}
