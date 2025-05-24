import { ApiTags } from '@nestjs/swagger';
import { Controller } from '@nestjs/common';
import { TermsPolicyService } from '@modules/terms-policy/services/terms-policy.service';

@ApiTags('modules.admin.terms-policy')
@Controller({
    version: '1',
    path: '/terms-policy',
})
export class TermsPolicyAdminController {
    constructor(private readonly termsPolicyService: TermsPolicyService) {}
}