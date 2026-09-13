import 'reflect-metadata';
import { PipeTransform, Type } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { IPaginationQueryFilterExistsOptions } from '@common/pagination/interfaces/pagination.interface';
import { PaginationQueryFilterExists } from '@common/pagination/decorators/pagination.decorator';
import { PaginationQueryFilterExistsPipe } from '@common/pagination/pipes/pagination.filter.pipe';

jest.mock('@common/pagination/pipes/pagination.filter.pipe', () => ({
    ...jest.requireActual('@common/pagination/pipes/pagination.filter.pipe'),
    PaginationQueryFilterExistsPipe: jest.fn(),
}));

// `@nestjs/common`'s `Query` param decorator writes its metadata keyed by
// `${RouteParamtypes.QUERY}:${index}` — QUERY is enum member 4.
const queryRouteArgsKey = '4:0';

describe('PaginationQueryFilterExists', () => {
    const pipeFactory = PaginationQueryFilterExistsPipe as jest.MockedFunction<
        typeof PaginationQueryFilterExistsPipe
    >;
    const fakePipeType = {} as Type<PipeTransform>;

    beforeEach(() => {
        jest.resetAllMocks();
        pipeFactory.mockReturnValue(fakePipeType);
    });

    it('calls PaginationQueryFilterExistsPipe with the given options', () => {
        const options: IPaginationQueryFilterExistsOptions = {
            customField: 'revokedAt',
        };

        PaginationQueryFilterExists('isRevoked', options);

        expect(pipeFactory).toHaveBeenCalledWith(options);
    });

    it('calls PaginationQueryFilterExistsPipe with undefined options when none are given', () => {
        PaginationQueryFilterExists('isRevoked');

        expect(pipeFactory).toHaveBeenCalledWith(undefined);
    });

    it('returns a ParameterDecorator that binds the field and the produced pipe onto the query param metadata', () => {
        const decorator = PaginationQueryFilterExists('isRevoked');
        const target: object = {};

        decorator(target, 'listUsers', 0);

        const metadata = Reflect.getMetadata(
            ROUTE_ARGS_METADATA,
            target.constructor,
            'listUsers'
        );

        expect(metadata[queryRouteArgsKey]).toEqual({
            index: 0,
            data: 'isRevoked',
            pipes: [fakePipeType],
        });
    });
});
