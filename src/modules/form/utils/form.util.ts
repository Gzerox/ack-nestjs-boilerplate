import { Injectable } from '@nestjs/common';
import {
    EnumFormQuestionType,
    Form,
    FormAnswer,
    FormAssignment,
    FormResponse,
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

@Injectable()
export class FormUtil {
    mapFormOne(
        form: Form & { _count?: { assignments: number } }
    ): FormResponseDto {
        return plainToInstance(FormResponseDto, form);
    }

    mapFormList(
        forms: (Form & { _count?: { assignments: number } })[]
    ): FormResponseDto[] {
        return plainToInstance(FormResponseDto, forms);
    }

    mapAssignmentOne(assignment: FormAssignment): FormAssignmentResponseDto {
        return plainToInstance(FormAssignmentResponseDto, assignment);
    }

    mapResponseOne(
        response: FormResponse & { answers?: FormAnswer[] }
    ): FormResponseResponseDto {
        return plainToInstance(FormResponseResponseDto, response);
    }

    mapResponseList(
        responses: (FormResponse & { answers?: FormAnswer[] })[]
    ): FormResponseResponseDto[] {
        return plainToInstance(FormResponseResponseDto, responses);
    }

    mapFormWithResponse(
        form: Form & { _count?: { assignments: number } },
        response: (FormResponse & { answers?: FormAnswer[] }) | null
    ): FormWithResponseResponseDto {
        return plainToInstance(FormWithResponseResponseDto, {
            form,
            response,
        });
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
            const min = count > 0 ? Math.min(...nums) : null;
            const max = count > 0 ? Math.max(...nums) : null;
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
