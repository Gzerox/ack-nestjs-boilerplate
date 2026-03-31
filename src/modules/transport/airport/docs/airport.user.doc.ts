import { applyDecorators } from '@nestjs/common';
import {
    Doc,
    DocAuth,
    DocResponsePaging,
} from '@common/doc/decorators/doc.decorator';
import { AirportResponseDto } from '@modules/transport/airport/dtos/response/airport.response.dto';
import { AirportDefaultAvailableSearch } from '@modules/transport/airport/constants/airport.list.constant';

export function AirportUserListDoc(): MethodDecorator {
    return applyDecorators(
        Doc({ summary: 'get list of airports' }),
        DocAuth({ xApiKey: true, jwtAccessToken: true }),
        DocResponsePaging<AirportResponseDto>('airport.list', {
            dto: AirportResponseDto,
            availableSearch: AirportDefaultAvailableSearch,
        })
    );
}
