import { applyDecorators } from '@nestjs/common';
import {
    Doc,
    DocAuth,
    DocRequest,
    DocResponse,
    DocResponsePaging,
} from '@common/doc/decorators/doc.decorator';
import { AirportDocQuerySearch } from '@modules/transport/airport/constants/airport.doc.constant';
import { AirportDefaultAvailableSearch } from '@modules/transport/airport/constants/airport.list.constant';
import { AirportResponseDto } from '@modules/transport/airport/dtos/response/airport.response.dto';

export function AirportSharedListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get list of airports' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponsePaging<AirportResponseDto>('airport.list', {
            dto: AirportResponseDto,
            availableSearch: AirportDefaultAvailableSearch,
        })
    );
}

export function AirportSharedSearchDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'search airports for autocomplete' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocRequest({ queries: AirportDocQuerySearch }),
        DocResponse('airport.search', {
            dto: AirportResponseDto,
        })
    );
}
