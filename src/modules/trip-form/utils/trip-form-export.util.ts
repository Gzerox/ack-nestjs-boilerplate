import { Injectable } from '@nestjs/common';
import {
    TripFormAnswer,
    TripFormQuestion,
    TripFormSection,
} from '@generated/prisma-client';
import { HelperService } from '@common/helper/services/helper.service';
import { ITripFormAssignmentWithAnswers } from '@modules/trip-form/interfaces/trip-form.interface';

const EXPORT_BASE_COLUMNS = [
    'assignmentId',
    'userId',
    'status',
    'required',
    'startsAt',
    'closesAt',
    'submittedAt',
] as const;

@Injectable()
export class TripFormExportUtil {
    constructor(private readonly helperService: HelperService) {}

    orderQuestionsForExport(
        questions: TripFormQuestion[],
        sections: TripFormSection[]
    ): TripFormQuestion[] {
        const sectionPositionById = new Map<string, number>(
            sections.map(section => [section.id, section.position])
        );

        const sectionPosition = (q: TripFormQuestion): number =>
            sectionPositionById.get(q.sectionId) ?? Number.MAX_SAFE_INTEGER;

        return [...questions].sort(
            (a, b) =>
                sectionPosition(a) - sectionPosition(b) ||
                a.position - b.position ||
                a.id.localeCompare(b.id)
        );
    }

    buildResponseExportRow(
        assignment: ITripFormAssignmentWithAnswers,
        orderedQuestions: TripFormQuestion[]
    ): Record<string, string> {
        const answersByQuestionId = new Map<string, TripFormAnswer>(
            (assignment.answers ?? []).map(answer => [
                answer.questionId,
                answer,
            ])
        );

        const questionColumns = Object.fromEntries(
            orderedQuestions.map((question, index) => [
                this.buildQuestionColumnName(question, index),
                this.getExportAnswerValue(answersByQuestionId.get(question.id)),
            ])
        );

        return {
            assignmentId: assignment.id,
            userId: assignment.userId,
            status: assignment.status,
            required: String(assignment.required),
            startsAt: this.formatDate(assignment.startsAt),
            closesAt: this.formatDate(assignment.closesAt),
            submittedAt: this.formatDate(assignment.submittedAt),
            ...questionColumns,
        };
    }

    buildEmptyExportCsv(orderedQuestions: TripFormQuestion[]): string {
        const columns = [
            ...EXPORT_BASE_COLUMNS,
            ...orderedQuestions.map((q, i) =>
                this.buildQuestionColumnName(q, i)
            ),
        ];
        return columns.map(col => this.escapeCsvCell(col)).join(';');
    }

    private buildQuestionColumnName(
        question: TripFormQuestion,
        index: number
    ): string {
        const normalizedLabel = question.label.trim().replace(/\s+/g, ' ');
        return `question_${index + 1}_${normalizedLabel} (${question.id})`;
    }

    private formatDate(date: Date | null): string {
        return date ? this.helperService.dateFormatToIso(date) : '';
    }

    private escapeCsvCell(value: string): string {
        const escaped = value.replace(/"/g, '""');
        return /[";\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
    }

    private getExportAnswerValue(answer?: TripFormAnswer): string {
        if (!answer) {
            return '';
        }
        if (answer.textValue !== null) {
            return answer.textValue;
        }
        if (answer.numberValue !== null) {
            return String(answer.numberValue);
        }
        if (answer.optionValue !== null) {
            return answer.optionValue;
        }
        if (answer.optionValues.length > 0) {
            return answer.optionValues.join('|');
        }
        if (answer.booleanValue !== null) {
            return String(answer.booleanValue);
        }
        if (answer.dateValue !== null) {
            return this.helperService.dateFormatToIso(answer.dateValue);
        }
        return '';
    }
}
