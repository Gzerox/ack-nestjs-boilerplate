import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/services/database.service';
import {
    EnumFormResponseStatus,
    FormAssignment,
} from '@generated/prisma-client';
import { FormAssignmentCreateRequestDto } from '@modules/form/dtos/request/form-assignment-create.request.dto';
import { IFormAssignmentWithRelations } from '@modules/form/interfaces/form.interface';

@Injectable()
export class FormAssignmentRepository {
    constructor(private readonly databaseService: DatabaseService) {}

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

    async existByFormAndUser(formId: string, userId: string): Promise<boolean> {
        const count = await this.databaseService.formAssignment.count({
            where: { formId, userId, isActive: true },
        });
        return count > 0;
    }

    async findByIdWithFormAndResponse(
        id: string,
        userId: string
    ): Promise<IFormAssignmentWithRelations | null> {
        return this.databaseService.formAssignment.findUnique({
            where: { id },
            include: {
                form: true,
                responses: {
                    where: { userId },
                    take: 1,
                    include: { answers: true },
                },
            },
        }) as Promise<IFormAssignmentWithRelations | null>;
    }
}
