import { Injectable } from '@nestjs/common';
import { Document, Types } from 'mongoose';
import { TermsPolicyAcceptanceRepository } from '@modules/terms-policy/repository/repositories/terms-policy-acceptance.repository';
import {
    TermsPolicyAcceptanceDoc,
    TermsPolicyAcceptanceEntity,
} from '@modules/terms-policy/repository/entities/terms-policy-acceptance.entity';
import { ClassTransformOptions, plainToInstance } from 'class-transformer';
import { TermsPolicyAcceptanceGetResponseDto } from '@modules/terms-policy/dtos/response/terms-policy-acceptance.get.response.dto';
import { TermsPolicyAcceptanceListResponseDto } from '@modules/terms-policy/dtos/response/terms-policy-acceptance.list.response.dto';

@Injectable()
export class TermsPolicyAcceptanceService {
    constructor(
        private termsPolicyAcceptanceRepository: TermsPolicyAcceptanceRepository
    ) {}

    async hasAcceptedPolicy(
        userId: string,
        policyId: string
    ): Promise<boolean> {
        const existing = await this.termsPolicyAcceptanceRepository.findOne({
            user: new Types.ObjectId(userId),
            termsPolicy: new Types.ObjectId(policyId),
        });
        return !!existing;
    }

    async getAcceptedPolicies(
        userId: string
    ): Promise<TermsPolicyAcceptanceDoc[]> {
        return this.termsPolicyAcceptanceRepository.findAll({
            user: new Types.ObjectId(userId),
        });
    }

    async acceptPolicy(
        userId: string,
        policyId: string
    ): Promise<TermsPolicyAcceptanceDoc> {
        const entity = new TermsPolicyAcceptanceEntity();
        entity.termsPolicy = policyId;
        entity.acceptedAt = new Date();
        entity.user = userId;

        return this.termsPolicyAcceptanceRepository.create(entity);
    }

    mapList(
        policies: TermsPolicyAcceptanceDoc[],
        options?: ClassTransformOptions
    ): TermsPolicyAcceptanceListResponseDto[] {
        return plainToInstance(
            TermsPolicyAcceptanceListResponseDto,
            policies.map((e: TermsPolicyAcceptanceDoc) =>
                e instanceof Document ? e.toObject() : e
            ),
            options
        );
    }
    mapGet(
        policy: TermsPolicyAcceptanceDoc,
        options?: ClassTransformOptions
    ): TermsPolicyAcceptanceGetResponseDto {
        return plainToInstance(
            TermsPolicyAcceptanceGetResponseDto,
            policy.toObject(),
            options
        );
    }
}