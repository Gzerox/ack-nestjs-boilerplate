import { EnumSurveyRecipientStatus, EnumSurveyStatus } from '@prisma/client';

export const SURVEY_TAG_SHARED = 'modules.shared.survey';
export const SURVEY_TAG_USER = 'modules.user.survey';

export const SurveyDefaultAvailableSearch = ['title', 'description'];
export const SurveyDefaultAvailableSort = ['createdAt', 'publishedAt', 'closesAt', 'title'];
export const SurveyDefaultSort = 'createdAt';
export const SurveyDefaultPerPage = 20;
export const SurveyDefaultStatus = Object.values(EnumSurveyStatus);
export const SurveyDefaultRecipientStatus = Object.values(EnumSurveyRecipientStatus);
