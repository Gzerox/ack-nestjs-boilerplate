import {
    EnumFormKind,
    EnumFormResponseStatus,
    EnumFormStatus,
} from '@generated/prisma-client';

export const FORM_TAG_SHARED = 'modules.shared.form';
export const FORM_TAG_USER = 'modules.user.form';

export const FormDefaultAvailableSearch = ['title', 'description'];
export const FormDefaultAvailableSort = [
    'createdAt',
    'publishedAt',
    'closesAt',
    'title',
];
export const FormDefaultSort = 'createdAt';
export const FormDefaultPerPage = 20;
export const FormAvailableStatus = Object.values(EnumFormStatus);
export const FormAvailableResponseStatus = Object.values(EnumFormResponseStatus);
export const FormAvailableKind = Object.values(EnumFormKind);
