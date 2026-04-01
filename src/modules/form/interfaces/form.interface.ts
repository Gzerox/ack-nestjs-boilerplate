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
    type: EnumFormQuestionType;
    label: string;
    supportText?: string;
    required: boolean;
    placeholder?: string;
    options?: IFormSchemaOption[];
    validation?: IFormSchemaValidation;
}

export interface IFormSchemaSection {
    label?: string | null;
    questions: IFormSchemaQuestion[];
}

export interface IFormSchemaSnapshot {
    title: string;
    description?: string | null;
    sections: IFormSchemaSection[];
}

export interface IFormWithStructure extends Form {
    sections?: FormSection[];
    questions?: FormQuestion[];
}

export interface IFormResponseStatusCount {
    pending: number;
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

export interface IFormWithCounts extends IFormWithStructure {
    count: IFormCount;
}

export interface IFormAssignmentWithRelations extends FormAssignment {
    form: IFormWithStructure;
    responses: IFormResponseWithAnswers[];
}
