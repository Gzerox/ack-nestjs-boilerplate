import {
    EnumTripFormQuestionType,
    TripForm,
    TripFormAnswer,
    TripFormAssignment,
    TripFormQuestion,
    TripFormSection,
} from '@generated/prisma-client';

export type {
    TripForm,
    TripFormAnswer,
    TripFormAssignment,
    TripFormQuestion,
    TripFormSection,
};

export interface ITripFormSchemaOption {
    value: string;
    label: string;
}

export interface ITripFormSchemaValidation {
    min?: number;
    max?: number;
    multiline?: boolean;
    maxLength?: number;
}

export interface ITripFormSchemaQuestion {
    type: EnumTripFormQuestionType;
    label: string;
    supportText?: string;
    placeholder?: string;
    required: boolean;
    options?: ITripFormSchemaOption[];
    validation?: ITripFormSchemaValidation;
}

export interface ITripFormSchemaSection {
    label?: string | null;
    questions: ITripFormSchemaQuestion[];
}

export interface ITripFormSchemaSnapshot {
    title: string;
    description?: string | null;
    sections: ITripFormSchemaSection[];
}

export interface ITripFormWithStructure extends TripForm {
    sections?: TripFormSection[];
    questions?: TripFormQuestion[];
}

export interface ITripFormResponseStatusCount {
    pending: number;
    submitted: number;
}

export interface ITripFormAssignmentCount {
    assignments: number;
}

export interface ITripFormAssignmentWithAnswers extends TripFormAssignment {
    answers?: TripFormAnswer[];
}

export interface ITripFormCount {
    assignment: ITripFormAssignmentCount;
    response: ITripFormResponseStatusCount;
}

export interface ITripFormWithCounts extends ITripFormWithStructure {
    count: ITripFormCount;
}

export interface ITripFormAssignmentWithRelations extends ITripFormAssignmentWithAnswers {
    form: ITripFormWithStructure;
}
