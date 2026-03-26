import {
    EnumFormQuestionType,
    Form,
    FormAnswer,
    FormAssignment,
    FormQuestion,
    FormResponse,
    FormSection,
} from '@generated/prisma-client';

export type {
    Form,
    FormAnswer,
    FormAssignment,
    FormQuestion,
    FormResponse,
    FormSection,
};

export interface IFormSchemaOption {
    value: string;
    label: string;
}

export interface IFormSchemaValidation {
    min?: number;
    max?: number;
    multiline?: boolean;
    maxLength?: number;
}

export interface IFormSchemaQuestion {
    id: string;
    type: EnumFormQuestionType;
    label: string;
    required: boolean;
    placeholder?: string;
    options?: IFormSchemaOption[];
    validation?: IFormSchemaValidation;
}

export interface IFormSchemaSection {
    id: string;
    label?: string | null;
    questions: IFormSchemaQuestion[];
}

export interface IFormSchemaSnapshot {
    title: string;
    description?: string | null;
    sections: IFormSchemaSection[];
}

export interface IFormResponseStatusCount {
    notStarted: number;
    submitted: number;
}

export interface IFormAssignmentCount {
    assignments: number;
}

export interface IFormResponseWithAnswers extends FormResponse {
    answers?: FormAnswer[];
}

export interface IFormCount {
    assignment: IFormAssignmentCount;
    response: IFormResponseStatusCount;
}

export interface IFormWithCounts extends Form {
    count: IFormCount;
}
