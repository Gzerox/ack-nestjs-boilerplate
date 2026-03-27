import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import { IPaginationQueryOffsetParams } from '@common/pagination/interfaces/pagination.interface';
import { PaginationService } from '@common/pagination/services/pagination.service';
import { IResponsePagingReturn } from '@common/response/interfaces/response.interface';
import {
    EnumFormResponseStatus,
    FormAssignment,
    Prisma,
} from '@generated/prisma-client';
import { FormAssignmentCreateRequestDto } from '@modules/form/dtos/request/form-assignment-create.request.dto';

@Injectable()
export class FormAssignmentRepository {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly paginationService: PaginationService
    ) {}

    async createWithResponse(
        formId: string,
        dto: FormAssignmentCreateRequestDto
    ): Promise<FormAssignment> {
        return this.databaseService.$transaction(async tx => {
            const assignment = await tx.formAssignment.create({
                data: {
                    formId,
                    userId: dto.userId,
                    required: dto.required ?? true,
                    startsAt: dto.startsAt ?? null,
                    closesAt: dto.closesAt ?? null,
                    isActive: true,
                },
            });

            await tx.formResponse.create({
                data: {
                    formId,
                    assignmentId: assignment.id,
                    userId: dto.userId,
                    status: EnumFormResponseStatus.pending,
                },
            });

            return assignment;
        });
    }

    async findById(id: string): Promise<FormAssignment | null> {
        return this.databaseService.formAssignment.findUnique({
            where: { id },
        });
    }

    async findManyByForm(
        formId: string,
        pagination: IPaginationQueryOffsetParams<
            Prisma.FormAssignmentSelect,
            Prisma.FormAssignmentWhereInput
        >
    ): Promise<IResponsePagingReturn<FormAssignment>> {
        return this.paginationService.offset<
            FormAssignment,
            Prisma.FormAssignmentSelect,
            Prisma.FormAssignmentWhereInput
        >(this.databaseService.formAssignment, {
            ...pagination,
            where: { ...pagination.where, formId },
        });
    }
}
