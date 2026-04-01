import { Injectable } from '@nestjs/common';
import {
    EnumFormStatus,
    EnumFormQuestionType,
    Form,
    FormAnswer,
    FormAssignment,
} from '@generated/prisma-client';
import { plainToInstance } from 'class-transformer';
import { FormResponseDto } from '@modules/form/dtos/response/form.response.dto';
import { FormAssignmentResponseDto } from '@modules/form/dtos/response/form-assignment.response.dto';
import { FormResponseResponseDto } from '@modules/form/dtos/response/form-response.response.dto';
import { FormWithResponseResponseDto } from '@modules/form/dtos/response/form-with-response.response.dto';
import {
    FormQuestionBreakdownItemDto,
    FormQuestionSummaryResponseDto,
} from '@modules/form/dtos/response/form-question-summary.response.dto';
import {
    IFormResponseWithAnswers,
    IFormSchemaQuestion,
    IFormSchemaSection,
    IFormSchemaSnapshot,
    IFormWithStructure,
    IFormWithCounts,
} from '@modules/form/interfaces/form.interface';
import { IActivityLogMetadata } from '@modules/activity-log/interfaces/activity-log.interface';

@Injectable()
export class FormUtil {
    mapActivityLogMetadata(formId: string): IActivityLogMetadata {
        return { formId };
    }

    mapFormOne(
        form: Form | IFormWithCounts | IFormWithStructure
    ): FormResponseDto {
        return plainToInstance(FormResponseDto, {
            ...form,
            schemaSnapshot: this.buildSchema(form),
        });
    }

    mapFormList(
        forms: Array<Form | IFormWithCounts | IFormWithStructure>
    ): FormResponseDto[] {
        return plainToInstance(
            FormResponseDto,
            forms.map(form => ({
                ...form,
                schemaSnapshot: this.buildSchema(form),
            }))
        );
    }

    mapAssignmentOne(assignment: FormAssignment): FormAssignmentResponseDto {
        return plainToInstance(FormAssignmentResponseDto, assignment);
    }

    mapResponseOne(
        response: IFormResponseWithAnswers
    ): FormResponseResponseDto {
        return plainToInstance(FormResponseResponseDto, response);
    }

    mapResponseList(
        responses: IFormResponseWithAnswers[]
    ): FormResponseResponseDto[] {
        return plainToInstance(FormResponseResponseDto, responses);
    }

    mapFormWithResponse(
        form: Form | IFormWithCounts | IFormWithStructure,
        response: IFormResponseWithAnswers | null
    ): FormWithResponseResponseDto {
        return plainToInstance(FormWithResponseResponseDto, {
            form: {
                ...form,
                schemaSnapshot: this.buildSchema(form),
            },
            response,
        });
    }

    private buildSchema(
        form: Form | IFormWithCounts | IFormWithStructure
    ): IFormSchemaSnapshot {
        const structuredForm = form as IFormWithStructure;

        if (
            form.status === EnumFormStatus.published &&
            structuredForm.sections &&
            structuredForm.questions
        ) {
            const questionsBySectionId = new Map<
                string,
                Array<{
                    position: number;
                    question: IFormSchemaQuestion;
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
                            (question.options as unknown as IFormSchemaQuestion['options']) ??
                            undefined,
                        validation:
                            (question.validation as unknown as IFormSchemaQuestion['validation']) ??
                            undefined,
                    },
                });

                questionsBySectionId.set(question.sectionId, sectionQuestions);
            }

            const sections = [...structuredForm.sections]
                .sort((a, b) => a.position - b.position)
                .map<IFormSchemaSection>(section => ({
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

        return form.schemaSnapshot as unknown as IFormSchemaSnapshot;
    }

    buildQuestionSummary(
        answers: FormAnswer[],
        questionId: string,
        type: EnumFormQuestionType
    ): FormQuestionSummaryResponseDto {
        const breakdown: FormQuestionBreakdownItemDto[] = [];

        if (
            type === EnumFormQuestionType.singleSelect ||
            type === EnumFormQuestionType.multiSelect
        ) {
            const counts = new Map<string, number>();
            for (const answer of answers) {
                if (
                    type === EnumFormQuestionType.singleSelect &&
                    answer.optionValue
                ) {
                    counts.set(
                        answer.optionValue,
                        (counts.get(answer.optionValue) ?? 0) + 1
                    );
                } else if (type === EnumFormQuestionType.multiSelect) {
                    for (const v of answer.optionValues ?? []) {
                        counts.set(v, (counts.get(v) ?? 0) + 1);
                    }
                }
            }
            for (const [value, count] of counts.entries()) {
                breakdown.push({ value, count });
            }
        } else if (type === EnumFormQuestionType.boolean) {
            let trueCount = 0;
            let falseCount = 0;
            for (const answer of answers) {
                if (answer.booleanValue === true) {
                    trueCount++;
                } else if (answer.booleanValue === false) {
                    falseCount++;
                }
            }
            breakdown.push({ value: true, count: trueCount });
            breakdown.push({ value: false, count: falseCount });
        } else if (type === EnumFormQuestionType.number) {
            const nums = answers
                .map(a => a.numberValue)
                .filter((v): v is number => v !== null && v !== undefined);
            const count = nums.length;
            const min = count > 0 ? nums.reduce((a, b) => (b < a ? b : a)) : null;
            const max = count > 0 ? nums.reduce((a, b) => (b > a ? b : a)) : null;
            const avg =
                count > 0 ? nums.reduce((s, v) => s + v, 0) / count : null;
            breakdown.push({
                value: `min:${min},max:${max},avg:${avg !== null ? avg.toFixed(2) : null}`,
                count,
            });
        } else {
            // text or date: count non-null responses
            const count = answers.filter(a =>
                type === EnumFormQuestionType.text
                    ? a.textValue !== null
                    : a.dateValue !== null
            ).length;
            breakdown.push({ value: null, count });
        }

        return {
            questionId,
            type,
            totalResponses: answers.length,
            breakdown,
        };
    }
}
