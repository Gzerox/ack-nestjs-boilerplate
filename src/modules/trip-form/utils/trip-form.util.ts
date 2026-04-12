import { Injectable } from '@nestjs/common';
import {
    EnumTripFormQuestionType,
    EnumTripFormStatus,
    TripForm,
    TripFormAssignment,
} from '@generated/prisma-client';
import type { Prisma } from '@generated/prisma-client';
import { plainToInstance } from 'class-transformer';
import { TripFormResponseDto } from '@modules/trip-form/dtos/response/trip-form.response.dto';
import { TripFormAssignmentResponseDto } from '@modules/trip-form/dtos/response/trip-form-assignment.response.dto';
import { TripFormResponseResponseDto } from '@modules/trip-form/dtos/response/trip-form-response.response.dto';
import { TripFormWithResponseResponseDto } from '@modules/trip-form/dtos/response/trip-form-with-response.response.dto';
import {
    ITripFormAssignmentWithAnswers,
    ITripFormSchemaQuestion,
    ITripFormSchemaSection,
    ITripFormSchemaSnapshot,
    ITripFormWithCounts,
    ITripFormWithStructure,
} from '@modules/trip-form/interfaces/trip-form.interface';
import { IActivityLogMetadata } from '@modules/activity-log/interfaces/activity-log.interface';

@Injectable()
export class TripFormUtil {
    mapActivityLogMetadata(formId: string): IActivityLogMetadata {
        return { formId };
    }

    mapFormOne(
        form: TripForm | ITripFormWithCounts | ITripFormWithStructure
    ): TripFormResponseDto {
        return plainToInstance(TripFormResponseDto, {
            ...form,
            schemaSnapshot: this.buildSchema(form),
        });
    }

    mapFormList(
        forms: Array<TripForm | ITripFormWithCounts | ITripFormWithStructure>
    ): TripFormResponseDto[] {
        return plainToInstance(
            TripFormResponseDto,
            forms.map(form => ({
                ...form,
                schemaSnapshot: this.buildSchema(form),
            }))
        );
    }

    mapAssignmentOne(assignment: TripFormAssignment): TripFormAssignmentResponseDto {
        return plainToInstance(TripFormAssignmentResponseDto, assignment);
    }

    mapResponseOne(
        assignment: ITripFormAssignmentWithAnswers
    ): TripFormResponseResponseDto {
        return plainToInstance(TripFormResponseResponseDto, assignment);
    }

    mapResponseList(
        assignments: ITripFormAssignmentWithAnswers[]
    ): TripFormResponseResponseDto[] {
        return plainToInstance(TripFormResponseResponseDto, assignments);
    }

    mapFormWithResponse(
        form: TripForm | ITripFormWithCounts | ITripFormWithStructure,
        response: ITripFormAssignmentWithAnswers | null
    ): TripFormWithResponseResponseDto {
        const { schemaSnapshot: _, ...formWithoutSchema } = form
        return plainToInstance(TripFormWithResponseResponseDto, {
            form: formWithoutSchema,
            response,
        });
    }

    private buildSchema(
        form: TripForm | ITripFormWithCounts | ITripFormWithStructure
    ): ITripFormSchemaSnapshot {
        const structuredForm = form as ITripFormWithStructure;

        if (
            form.status === EnumTripFormStatus.published &&
            structuredForm.sections &&
            structuredForm.questions
        ) {
            const questionsBySectionId = new Map<
                string,
                Array<{
                    position: number;
                    question: ITripFormSchemaQuestion;
                }>
            >();

            for (const question of structuredForm.questions) {
                const sectionQuestions =
                    questionsBySectionId.get(question.sectionId) ?? [];

                sectionQuestions.push({
                    position: question.position,
                    question: {
                        type: question.type,
                        label: question.label,
                        supportText: question.supportText ?? undefined,
                        required: question.required,
                        placeholder: question.placeholder ?? undefined,
                        options:
                            (question.options as unknown as ITripFormSchemaQuestion['options']) ??
                            undefined,
                        validation:
                            (question.validation as unknown as ITripFormSchemaQuestion['validation']) ??
                            undefined,
                    },
                });

                questionsBySectionId.set(question.sectionId, sectionQuestions);
            }

            const sections = [...structuredForm.sections]
                .sort((a, b) => a.position - b.position)
                .map<ITripFormSchemaSection>(section => ({
                    id: section.id,
                    label: section.label ?? undefined,
                    questions: (questionsBySectionId.get(section.id) ?? [])
                        .sort((a, b) => a.position - b.position)
                        .map(entry => entry.question),
                }));

            return {
                title: form.title,
                description: form.description ?? null,
                sections,
            };
        }

        return form.schemaSnapshot as unknown as ITripFormSchemaSnapshot;
    }

    normalizeSchemaSnapshot(form: TripForm): ITripFormSchemaSnapshot {
        const raw = form.schemaSnapshot;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            return { title: form.title, description: form.description ?? null, sections: [] };
        }
        return raw as unknown as ITripFormSchemaSnapshot;
    }

    buildSchemaSnapshot(
        title: string,
        description: string | null | undefined,
        sections: ITripFormSchemaSection[]
    ): ITripFormSchemaSnapshot {
        return {
            title,
            description: description ?? null,
            sections: sections.map(section => ({
                label: section.label ?? null,
                questions: section.questions.map(question => ({
                    type: question.type,
                    label: question.label,
                    supportText: question.supportText ?? null,
                    required: question.required,
                    placeholder: question.placeholder ?? null,
                    options: question.options?.map(o => ({ value: o.value, label: o.label })) ?? null,
                    validation: question.validation ?? null,
                })),
            })),
        };
    }

    buildPublishSections(sections: ITripFormSchemaSection[]): Array<{
        label: string | null;
        position: number;
        questions: Array<{
            type: EnumTripFormQuestionType;
            label: string;
            supportText?: string | null;
            placeholder?: string | null;
            required: boolean;
            position: number;
            validation?: Prisma.InputJsonValue | null;
            options?: Prisma.InputJsonValue | null;
        }>;
    }> {
        return sections.map((section, si) => ({
            label: section.label ?? null,
            position: si,
            questions: section.questions.map((q, qi) => ({
                type: q.type,
                label: q.label,
                supportText: q.supportText ?? null,
                placeholder: q.placeholder ?? null,
                required: q.required,
                position: qi,
                validation: (q.validation ?? null) as Prisma.InputJsonValue | null,
                options: (q.options?.length
                    ? q.options.map(o => ({ value: o.value, label: o.label }))
                    : null) as Prisma.InputJsonValue | null,
            })),
        }));
    }

}
