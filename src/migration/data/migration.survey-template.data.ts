import { EnumAppEnvironment } from '@app/enums/app.enum';
import { SurveyTemplateCreateRequestDto } from '@modules/survey/dtos/request/survey-template.create.request.dto';
import { SurveySchema } from '@generated/prisma-client';

const surveyTemplateData: SurveyTemplateCreateRequestDto[] = [
    {
        name: 'customer-satisfaction-survey',
        schema: {
            title: 'Customer Satisfaction Survey',
            description: 'Help us improve by sharing your feedback',
            sections: [
                {
                    id: 'section-1',
                    name: 'overall-experience',
                    label: 'Overall Experience',
                    questions: [
                        {
                            id: 'q1',
                            name: 'overall-rating',
                            type: 'number',
                            label: 'How would you rate your overall experience?',
                            required: true,
                            validation: {
                                min: 1,
                                max: 5,
                            },
                        },
                        {
                            id: 'q2',
                            name: 'satisfaction-level',
                            type: 'radio',
                            label: 'What is your satisfaction level?',
                            required: true,
                            options: [
                                { value: 'very-satisfied', label: 'Very Satisfied' },
                                { value: 'satisfied', label: 'Satisfied' },
                                { value: 'neutral', label: 'Neutral' },
                                { value: 'dissatisfied', label: 'Dissatisfied' },
                                { value: 'very-dissatisfied', label: 'Very Dissatisfied' },
                            ],
                            validation: {},
                        },
                    ],
                },
                {
                    id: 'section-2',
                    name: 'service-quality',
                    label: 'Service Quality',
                    questions: [
                        {
                            id: 'q3',
                            name: 'service-aspects',
                            type: 'checkbox',
                            label: 'Which aspects of our service impressed you?',
                            required: false,
                            options: [
                                { value: 'quality', label: 'Quality' },
                                { value: 'speed', label: 'Speed' },
                                { value: 'support', label: 'Customer Support' },
                                { value: 'price', label: 'Price' },
                                { value: 'reliability', label: 'Reliability' },
                            ],
                            validation: {},
                        },
                        {
                            id: 'q4',
                            name: 'improvements',
                            type: 'textarea',
                            label: 'What could we improve?',
                            required: false,
                            placeholder: 'Share your suggestions...',
                            validation: {
                                multiline: true,
                                maxLength: 500,
                            },
                        },
                    ],
                },
            ],
        } as SurveySchema,
    },
    {
        name: 'product-feedback-survey',
        schema: {
            title: 'Product Feedback Survey',
            description: 'Your feedback helps us build better products',
            sections: [
                {
                    id: 'section-1',
                    name: 'product-usage',
                    label: 'Product Usage',
                    questions: [
                        {
                            id: 'q1',
                            name: 'product-category',
                            type: 'select',
                            label: 'Which product did you use?',
                            required: true,
                            options: [
                                { value: 'product-a', label: 'Product A' },
                                { value: 'product-b', label: 'Product B' },
                                { value: 'product-c', label: 'Product C' },
                            ],
                            validation: {},
                        },
                        {
                            id: 'q2',
                            name: 'usage-frequency',
                            type: 'radio',
                            label: 'How often do you use this product?',
                            required: true,
                            options: [
                                { value: 'daily', label: 'Daily' },
                                { value: 'weekly', label: 'Weekly' },
                                { value: 'monthly', label: 'Monthly' },
                                { value: 'rarely', label: 'Rarely' },
                            ],
                            validation: {},
                        },
                    ],
                },
            ],
        } as SurveySchema,
    },
];

export const migrationSurveyTemplateData: Record<
    EnumAppEnvironment,
    SurveyTemplateCreateRequestDto[]
> = {
    [EnumAppEnvironment.local]: surveyTemplateData,
    [EnumAppEnvironment.development]: surveyTemplateData,
    [EnumAppEnvironment.staging]: surveyTemplateData,
    [EnumAppEnvironment.production]: surveyTemplateData,
};
