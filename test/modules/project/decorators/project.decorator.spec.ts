import 'reflect-metadata';
import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { mock } from 'vitest-mock-extended';
import type { ClsService } from 'nestjs-cls';
import { ClsServiceManager } from 'nestjs-cls';

import { HttpStatus } from '@nestjs/common';
import { DocResponseEntryMetaKey } from '@common/doc/constants/doc.constant';
import { RequestContextMissingException } from '@common/request/exceptions/request.context-missing.exception';
import {
    ProjectMemberStoreKey,
    ProjectMemberRequiredMetaKey,
    ProjectStoreKey,
} from '@modules/project/constants/project.constant';
import {
    ProjectCurrent,
    ProjectMemberCurrent,
    ProjectMemberProtected,
    ProjectProtected,
} from '@modules/project/decorators/project.decorator';
import { ProjectGuard } from '@modules/project/guards/project.guard';
import { ProjectMemberGuard } from '@modules/project/guards/project.member.guard';
import { EnumProjectStatusCodeError } from '@modules/project/enums/project.status-code.enum';

vi.mock('nestjs-cls', () => ({
    ClsServiceManager: { getClsService: vi.fn() },
}));
vi.mock('@modules/project/guards/project.guard', () => ({
    ProjectGuard: vi.fn(),
}));
vi.mock('@modules/project/guards/project.member.guard', () => ({
    ProjectMemberGuard: vi.fn(),
}));

const extractFactory = (decorator: () => ParameterDecorator) => {
    const target = { constructor: vi.fn() };
    decorator()(target, 'handler', 0);
    const metadata = Reflect.getMetadata(
        ROUTE_ARGS_METADATA,
        target.constructor,
        'handler'
    );
    return metadata[Object.keys(metadata)[0]].factory as (
        data: unknown
    ) => unknown;
};

describe('project decorators', () => {
    it('mounts the project guard for ProjectProtected', () => {
        const projectHandler = vi.fn();
        ProjectProtected()({}, 'project', { value: projectHandler });
        expect(Reflect.getMetadata(GUARDS_METADATA, projectHandler)).toEqual([
            ProjectGuard,
        ]);
    });

    it('mounts the one member guard, strict by default, and documents memberForbidden', () => {
        const handler = vi.fn();
        ProjectMemberProtected()({}, 'member', { value: handler });
        expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
            ProjectMemberGuard,
        ]);
        expect(Reflect.getMetadata(ProjectMemberRequiredMetaKey, handler)).toBe(
            true
        );
        expect(Reflect.getMetadata(DocResponseEntryMetaKey, handler)).toEqual([
            expect.objectContaining({
                httpStatus: HttpStatus.FORBIDDEN,
                statusCode: EnumProjectStatusCodeError.memberForbidden,
            }),
        ]);
    });

    it('treats an empty options object as strict', () => {
        const handler = vi.fn();
        ProjectMemberProtected({})({}, 'member', { value: handler });
        expect(Reflect.getMetadata(ProjectMemberRequiredMetaKey, handler)).toBe(
            true
        );
    });

    it('mounts the same guard non-rejecting with required false and no project-member error', () => {
        const handler = vi.fn();
        ProjectMemberProtected({ required: false })({}, 'member', {
            value: handler,
        });
        expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
            ProjectMemberGuard,
        ]);
        expect(Reflect.getMetadata(ProjectMemberRequiredMetaKey, handler)).toBe(
            false
        );
        expect(
            Reflect.getMetadata(DocResponseEntryMetaKey, handler)
        ).toBeUndefined();
    });

    it.each([
        [ProjectCurrent, ProjectStoreKey, { id: 'project-id' }],
        [ProjectMemberCurrent, ProjectMemberStoreKey, { id: 'member-id' }],
    ] as const)(
        'reads complete and selected CLS values',
        (decorator, key, value) => {
            const cls = mock<ClsService>();
            cls.get.mockReturnValue(value);
            vi.mocked(ClsServiceManager.getClsService).mockReturnValue(cls);
            const factory = extractFactory(() => decorator());
            expect(factory(undefined)).toBe(value);
            expect(factory(null)).toBe(value);
            expect(factory('id')).toBe(value.id);
            expect(cls.get).toHaveBeenCalledWith(key);
        }
    );

    it.each([ProjectCurrent, ProjectMemberCurrent])(
        'rejects missing context and selected fields',
        decorator => {
            const cls = mock<ClsService>();
            vi.mocked(ClsServiceManager.getClsService).mockReturnValue(cls);
            cls.get.mockReturnValueOnce(undefined);
            expect(() => extractFactory(() => decorator())(undefined)).toThrow(
                RequestContextMissingException
            );
            cls.get.mockReturnValueOnce(null);
            expect(() => extractFactory(() => decorator())(undefined)).toThrow(
                RequestContextMissingException
            );
            cls.get.mockReturnValueOnce({ id: null });
            expect(() => extractFactory(() => decorator())('id')).toThrow(
                RequestContextMissingException
            );
            cls.get.mockReturnValueOnce({ id: undefined });
            expect(() => extractFactory(() => decorator())('id')).toThrow(
                RequestContextMissingException
            );
        }
    );
});
