import { BadRequestException, Injectable } from '@nestjs/common';
import { TermsPolicyRepository } from '@modules/terms-policy/repository/repositories/terms-policy.repository';
import { TermsPolicyAcceptanceService } from '@modules/terms-policy/services/terms-policy-acceptance.service';
import { TermsPolicyDoc } from '@modules/terms-policy/repository/entities/terms-policy.entity';
import { TermsPolicyAcceptanceDoc } from '@modules/terms-policy/repository/entities/terms-policy-acceptance.entity';

@Injectable()
export class TermsPolicyUserService {
    constructor(
        private readonly termsPolicyRepo: TermsPolicyRepository,
        private readonly termsPolicyAcceptanceService: TermsPolicyAcceptanceService
    ) {}

    async findPendingPoliciesForUser(
        userId: string
    ): Promise<TermsPolicyDoc[]> {
        const activePolicies = await this.termsPolicyRepo.findAll({
            isPublished: true,
            deleted: false,
        });

        const acceptedPolicies =
            await this.termsPolicyAcceptanceService.getAcceptedPolicies(userId);
        const acceptedPolicyIds = acceptedPolicies.map(policy => policy.id);

        return activePolicies.filter(
            p => !acceptedPolicyIds.includes(p.id.toString())
        );
    }

    async acceptPolicy(
        userId: string,
        policyId: string
    ): Promise<TermsPolicyAcceptanceDoc> {
        // Check if the policy is active
        const policy = await this.termsPolicyRepo.findOneById(policyId);
        if (!policy || !policy.isPublished) {
            throw new BadRequestException(
                'Policy is not active or does not exist'
            );
        }
        // Check if user already accepted this policy
        const alreadyAccepted =
            await this.termsPolicyAcceptanceService.hasAcceptedPolicy(
                userId,
                policyId
            );
        if (alreadyAccepted)
            throw new BadRequestException('Policy has been already accepted');

        return this.termsPolicyAcceptanceService.acceptPolicy(userId, policyId);
    }
}