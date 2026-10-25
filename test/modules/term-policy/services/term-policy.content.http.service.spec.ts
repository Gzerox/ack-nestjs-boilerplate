import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';

import type { IAwsS3Presign } from '@common/aws/interfaces/aws.interface';
import { EnumMessageLanguage } from '@common/message/enums/message.enum';
import { RequestContextMissingException } from '@common/request/exceptions/request.context-missing.exception';
import {
    EnumPolicyAction,
    EnumPolicySubject,
    EnumTermPolicyType,
} from '@generated/prisma-client/client';
import { PolicyAbilityStoreKey } from '@modules/policy/constants/policy.constant';
import { PolicyAbilityDomain } from '@modules/policy/domains/policy.ability.domain';
import { PolicyForbiddenException } from '@modules/policy/exceptions/policy.forbidden.exception';
import { TermPolicyContentDomain } from '@modules/term-policy/domains/term-policy.content.domain';
import type { TermPolicyContentPresignRequestDto } from '@modules/term-policy/dtos/request/term-policy.content-presign.request.dto';
import type { TermPolicyContentRequestDto } from '@modules/term-policy/dtos/request/term-policy.content.request.dto';
import { TermPolicyContentHttpService } from '@modules/term-policy/services/term-policy.content.http.service';

describe('TermPolicyContentHttpService', () => {
    const termPolicyContentDomain: MockProxy<TermPolicyContentDomain> =
        mock<TermPolicyContentDomain>();
    const policyAbilityDomain: MockProxy<PolicyAbilityDomain> =
        mock<PolicyAbilityDomain>();
    const scopeWhere = { type: EnumTermPolicyType.privacy };
    const body = {
        key: 'term-policies/privacy/v1/en.hbs',
        size: 100,
        language: EnumMessageLanguage.en,
    } satisfies TermPolicyContentRequestDto;

    let service: TermPolicyContentHttpService;

    beforeEach(async () => {
        vi.resetAllMocks();
        policyAbilityDomain.scope.mockReturnValue(scopeWhere);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TermPolicyContentHttpService,
                {
                    provide: TermPolicyContentDomain,
                    useValue: termPolicyContentDomain,
                },
                { provide: PolicyAbilityDomain, useValue: policyAbilityDomain },
            ],
        }).compile();

        service = module.get(TermPolicyContentHttpService);
    });

    describe('generateContentPresignByAdmin', () => {
        it('delegates to the content domain and wraps the presign', async () => {
            const request = {
                language: EnumMessageLanguage.en,
                size: 100,
                type: EnumTermPolicyType.privacy,
                version: 1,
            } satisfies TermPolicyContentPresignRequestDto;
            const presign = mock<IAwsS3Presign>();
            termPolicyContentDomain.generateContentPresignByAdmin.mockResolvedValue(
                presign
            );

            await expect(
                service.generateContentPresignByAdmin(request)
            ).resolves.toEqual({ data: presign });
            expect(
                termPolicyContentDomain.generateContentPresignByAdmin
            ).toHaveBeenCalledWith(request);
        });
    });

    describe('updateContentByAdmin', () => {
        it('passes scope(update, TermPolicy) as additionalWhere and delegates to the content domain', async () => {
            termPolicyContentDomain.updateContentByAdmin.mockResolvedValue(
                undefined
            );

            await expect(
                service.updateContentByAdmin('term-policy-id', body)
            ).resolves.toEqual({});
            expect(policyAbilityDomain.scope).toHaveBeenCalledWith(
                EnumPolicyAction.update,
                EnumPolicySubject.TermPolicy
            );
            expect(
                termPolicyContentDomain.updateContentByAdmin
            ).toHaveBeenCalledWith('term-policy-id', body, scopeWhere);
        });

        it('throws PolicyForbiddenException and never calls the content domain when the ability has no update rule', async () => {
            policyAbilityDomain.scope.mockImplementation(() => {
                throw new PolicyForbiddenException();
            });

            await expect(
                service.updateContentByAdmin('term-policy-id', body)
            ).rejects.toThrow(PolicyForbiddenException);
            expect(
                termPolicyContentDomain.updateContentByAdmin
            ).not.toHaveBeenCalled();
        });

        it('throws RequestContextMissingException and touches nothing when no ability is stored', async () => {
            policyAbilityDomain.scope.mockImplementation(() => {
                throw new RequestContextMissingException(PolicyAbilityStoreKey);
            });

            await expect(
                service.updateContentByAdmin('term-policy-id', body)
            ).rejects.toThrow(RequestContextMissingException);
            expect(
                termPolicyContentDomain.updateContentByAdmin
            ).not.toHaveBeenCalled();
        });
    });

    describe('addContentByAdmin', () => {
        it('passes scope(update, TermPolicy) as additionalWhere and delegates to the content domain', async () => {
            termPolicyContentDomain.addContentByAdmin.mockResolvedValue(
                undefined
            );

            await expect(
                service.addContentByAdmin('term-policy-id', body)
            ).resolves.toEqual({});
            expect(policyAbilityDomain.scope).toHaveBeenCalledWith(
                EnumPolicyAction.update,
                EnumPolicySubject.TermPolicy
            );
            expect(
                termPolicyContentDomain.addContentByAdmin
            ).toHaveBeenCalledWith('term-policy-id', body, scopeWhere);
        });

        it('throws PolicyForbiddenException and never calls the content domain when the ability has no update rule', async () => {
            policyAbilityDomain.scope.mockImplementation(() => {
                throw new PolicyForbiddenException();
            });

            await expect(
                service.addContentByAdmin('term-policy-id', body)
            ).rejects.toThrow(PolicyForbiddenException);
            expect(
                termPolicyContentDomain.addContentByAdmin
            ).not.toHaveBeenCalled();
        });

        it('throws RequestContextMissingException and touches nothing when no ability is stored', async () => {
            policyAbilityDomain.scope.mockImplementation(() => {
                throw new RequestContextMissingException(PolicyAbilityStoreKey);
            });

            await expect(
                service.addContentByAdmin('term-policy-id', body)
            ).rejects.toThrow(RequestContextMissingException);
            expect(
                termPolicyContentDomain.addContentByAdmin
            ).not.toHaveBeenCalled();
        });
    });

    describe('removeContentByAdmin', () => {
        it('passes scope(update, TermPolicy) as additionalWhere and delegates to the content domain', async () => {
            termPolicyContentDomain.removeContentByAdmin.mockResolvedValue(
                undefined
            );

            await expect(
                service.removeContentByAdmin('term-policy-id', {
                    language: EnumMessageLanguage.en,
                })
            ).resolves.toEqual({});
            expect(policyAbilityDomain.scope).toHaveBeenCalledWith(
                EnumPolicyAction.update,
                EnumPolicySubject.TermPolicy
            );
            expect(
                termPolicyContentDomain.removeContentByAdmin
            ).toHaveBeenCalledWith(
                'term-policy-id',
                EnumMessageLanguage.en,
                scopeWhere
            );
        });

        it('throws PolicyForbiddenException and never calls the content domain when the ability has no update rule', async () => {
            policyAbilityDomain.scope.mockImplementation(() => {
                throw new PolicyForbiddenException();
            });

            await expect(
                service.removeContentByAdmin('term-policy-id', {
                    language: EnumMessageLanguage.en,
                })
            ).rejects.toThrow(PolicyForbiddenException);
            expect(
                termPolicyContentDomain.removeContentByAdmin
            ).not.toHaveBeenCalled();
        });

        it('throws RequestContextMissingException and touches nothing when no ability is stored', async () => {
            policyAbilityDomain.scope.mockImplementation(() => {
                throw new RequestContextMissingException(PolicyAbilityStoreKey);
            });

            await expect(
                service.removeContentByAdmin('term-policy-id', {
                    language: EnumMessageLanguage.en,
                })
            ).rejects.toThrow(RequestContextMissingException);
            expect(
                termPolicyContentDomain.removeContentByAdmin
            ).not.toHaveBeenCalled();
        });
    });

    describe('getContentByAdmin', () => {
        it('passes scope(read, TermPolicy) as additionalWhere and delegates to the content domain', async () => {
            const presign = mock<IAwsS3Presign>();
            termPolicyContentDomain.getContentByAdmin.mockResolvedValue(
                presign
            );

            await expect(
                service.getContentByAdmin(
                    'term-policy-id',
                    EnumMessageLanguage.en
                )
            ).resolves.toEqual({ data: presign });
            expect(policyAbilityDomain.scope).toHaveBeenCalledWith(
                EnumPolicyAction.read,
                EnumPolicySubject.TermPolicy
            );
            expect(
                termPolicyContentDomain.getContentByAdmin
            ).toHaveBeenCalledWith(
                'term-policy-id',
                EnumMessageLanguage.en,
                scopeWhere
            );
        });

        it('throws PolicyForbiddenException and never calls the content domain when the ability has no read rule', async () => {
            policyAbilityDomain.scope.mockImplementation(() => {
                throw new PolicyForbiddenException();
            });

            await expect(
                service.getContentByAdmin(
                    'term-policy-id',
                    EnumMessageLanguage.en
                )
            ).rejects.toThrow(PolicyForbiddenException);
            expect(
                termPolicyContentDomain.getContentByAdmin
            ).not.toHaveBeenCalled();
        });

        it('throws RequestContextMissingException and touches nothing when no ability is stored', async () => {
            policyAbilityDomain.scope.mockImplementation(() => {
                throw new RequestContextMissingException(PolicyAbilityStoreKey);
            });

            await expect(
                service.getContentByAdmin(
                    'term-policy-id',
                    EnumMessageLanguage.en
                )
            ).rejects.toThrow(RequestContextMissingException);
            expect(
                termPolicyContentDomain.getContentByAdmin
            ).not.toHaveBeenCalled();
        });
    });
});
