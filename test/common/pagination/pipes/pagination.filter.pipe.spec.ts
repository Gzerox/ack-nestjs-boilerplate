import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { ArgumentMetadata, PipeTransform, Type } from '@nestjs/common';
import { RequestStoreService } from '@common/request/services/request.store.service';
import { PaginationStoreKey } from '@common/pagination/constants/pagination.constant';
import { EnumPaginationStatusCodeError } from '@common/pagination/enums/pagination.status-code.enum';
import { PaginationFilterInvalidValueException } from '@common/pagination/exceptions/pagination.filter-invalid-value.exception';
import {
    IPaginationQuery,
    IPaginationQueryFilterExistsOptions,
} from '@common/pagination/interfaces/pagination.interface';
import { PaginationQueryFilterExistsPipe } from '@common/pagination/pipes/pagination.filter.pipe';

describe('PaginationQueryFilterExistsPipe', () => {
    const requestStoreService: DeepMocked<RequestStoreService> =
        createMock<RequestStoreService>();

    const buildPipe = (
        options?: IPaginationQueryFilterExistsOptions
    ): PipeTransform => {
        const PipeType: Type<PipeTransform> =
            PaginationQueryFilterExistsPipe(options);
        return new PipeType(requestStoreService);
    };

    const buildMetadata = (field: string): ArgumentMetadata => ({
        type: 'query',
        data: field,
    });

    beforeEach(() => {
        jest.resetAllMocks();
        requestStoreService.get.mockReturnValue(null);
    });

    describe('transform', () => {
        it('returns undefined when the value is falsy', async () => {
            const pipe = buildPipe();

            const result = await pipe.transform('', buildMetadata('isRevoked'));

            expect(result).toBeUndefined();
            expect(requestStoreService.merge).not.toHaveBeenCalled();
        });

        it('returns undefined when the value is only whitespace', async () => {
            const pipe = buildPipe();

            const result = await pipe.transform(
                '   ',
                buildMetadata('isRevoked')
            );

            expect(result).toBeUndefined();
            expect(requestStoreService.merge).not.toHaveBeenCalled();
        });

        it('throws PaginationFilterInvalidValueException when the trimmed value is neither true nor false', async () => {
            const pipe = buildPipe();

            try {
                await pipe.transform('maybe', buildMetadata('isRevoked'));
                throw new Error('expected pipe.transform to throw');
            } catch (error) {
                expect(error).toBeInstanceOf(
                    PaginationFilterInvalidValueException
                );
                expect(error).toMatchObject({
                    module: 'pagination',
                    statusCode: EnumPaginationStatusCodeError.filterInvalidValue,
                    statusCodeKey:
                        EnumPaginationStatusCodeError[
                            EnumPaginationStatusCodeError.filterInvalidValue
                        ],
                    messagePath: 'pagination.error.filterInvalidValue',
                });
            }

            expect(requestStoreService.merge).not.toHaveBeenCalled();
        });

        it('returns a `not: null` filter keyed by field when the trimmed value is true', async () => {
            const pipe = buildPipe();

            const result = await pipe.transform(
                'true',
                buildMetadata('isRevoked')
            );

            expect(result).toEqual({ isRevoked: { not: null } });
        });

        it('returns an `equals: null` filter keyed by field when the trimmed value is false', async () => {
            const pipe = buildPipe();

            const result = await pipe.transform(
                'false',
                buildMetadata('isRevoked')
            );

            expect(result).toEqual({ isRevoked: { equals: null } });
        });

        it('remaps the returned filter key to customField for a true value', async () => {
            const pipe = buildPipe({ customField: 'revokedAt' });

            const result = await pipe.transform(
                'true',
                buildMetadata('isRevoked')
            );

            expect(result).toEqual({ revokedAt: { not: null } });
        });

        it('remaps the returned filter key to customField for a false value', async () => {
            const pipe = buildPipe({ customField: 'revokedAt' });

            const result = await pipe.transform(
                'false',
                buildMetadata('isRevoked')
            );

            expect(result).toEqual({ revokedAt: { equals: null } });
        });

        it('merges the raw boolean into RequestStoreService keyed by field, trimming surrounding whitespace', async () => {
            const pipe = buildPipe();

            await pipe.transform(' true ', buildMetadata('isRevoked'));

            expect(requestStoreService.merge).toHaveBeenCalledWith<
                [string, Partial<IPaginationQuery>]
            >(PaginationStoreKey, { filters: { isRevoked: true } });
        });

        it('merges the raw false boolean into RequestStoreService keyed by field even when customField is set', async () => {
            const pipe = buildPipe({ customField: 'revokedAt' });

            await pipe.transform('false', buildMetadata('isRevoked'));

            expect(requestStoreService.merge).toHaveBeenCalledWith<
                [string, Partial<IPaginationQuery>]
            >(PaginationStoreKey, { filters: { isRevoked: false } });
        });

        it('merges the boolean on top of filters already present in the store', async () => {
            requestStoreService.get.mockReturnValue({
                filters: { search: 'foo' },
            } as Partial<IPaginationQuery>);

            const pipe = buildPipe();

            await pipe.transform('true', buildMetadata('isRevoked'));

            expect(requestStoreService.merge).toHaveBeenCalledWith<
                [string, Partial<IPaginationQuery>]
            >(PaginationStoreKey, {
                filters: { search: 'foo', isRevoked: true },
            });
        });
    });
});
