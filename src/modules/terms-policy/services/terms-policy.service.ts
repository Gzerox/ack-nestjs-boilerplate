import {
    TermsPolicyDoc,
    TermsPolicyEntity,
} from '@modules/terms-policy/repository/entities/terms-policy.entity';
import { TermsPolicyRepository } from '@modules/terms-policy/repository/repositories/terms-policy.repository';
import { ENUM_PAGINATION_ORDER_DIRECTION_TYPE } from '@common/pagination/enums/pagination.enum';
import { UpdateResult } from 'mongodb';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ENUM_TERMS_POLICY_TYPE } from '@modules/terms-policy/enums/terms-policy.enum';
import { Document } from 'mongoose';
import { IDatabaseSaveOptions } from '@common/database/interfaces/database.interface';
import { HelperDateService } from '@common/helper/services/helper.date.service';
import { ENUM_TERMS_POLICY_STATUS_CODE_ERROR } from '@modules/terms-policy/enums/terms-policy.status-code.enum';
import { ClassTransformOptions, plainToInstance } from 'class-transformer';
import { TermsPolicyListResponseDto } from '@modules/terms-policy/dtos/response/terms-policy.list.response.dto';
import { TermsPolicyGetResponseDto } from '@modules/terms-policy/dtos/response/terms-policy.get.response.dto';

@Injectable()
export class TermsPolicyService {
    constructor(
        private helperDate: HelperDateService,
        private termsPolicyRepository: TermsPolicyRepository
    ) {}

    async findPreviousVersions(_id: string): Promise<TermsPolicyDoc> {
        return this.termsPolicyRepository.findOneById(_id);
    }
    async findOneById(_id: string): Promise<TermsPolicyDoc> {
        return this.termsPolicyRepository.findOneById(_id);
    }

    async update(
        repository: TermsPolicyDoc,
        options?: IDatabaseSaveOptions
    ): Promise<TermsPolicyDoc> {
        if (
            repository.isPublished &&
            repository.publishedAt < this.helperDate.create()
        ) {
            throw new BadRequestException({
                statusCode:
                    ENUM_TERMS_POLICY_STATUS_CODE_ERROR.UPDATE_FORBIDDEN_STATUS_PUBLISHED,
                message: 'terms-policy.error.updateForbiddenStatusPublished',
            });
        }
        return this.termsPolicyRepository.save(repository, options);
    }

    async publish(
        repository: TermsPolicyDoc,
        options?: IDatabaseSaveOptions
    ): Promise<TermsPolicyDoc> {
        repository.isPublished = true;
        repository.publishedAt = new Date();
        return this.termsPolicyRepository.save(repository, options);
    }

    /**
     * Get the currently active policy of a specific type and language.
     */
    async findLatestPublished(
        type: ENUM_TERMS_POLICY_TYPE,
        language: string
    ): Promise<TermsPolicyDoc> {
        return this.termsPolicyRepository.findOne({
            type,
            language,
            isPublished: true,
            publishedAt: { $lte: new Date() },
            deleted: false,
        });
    }

    async unpublishPolicies(
        type: ENUM_TERMS_POLICY_TYPE,
        language: string
    ): Promise<UpdateResult> {
        return this.termsPolicyRepository.updateMany(
            { type, language, isPublished: true, deleted: false },
            { isPublished: false, publishedAt: null }
        );
    }

    /**
     * Return all versions for a specific type and language, sorted by createdAt descending.
     */
    async findAllVersions(
        type: ENUM_TERMS_POLICY_TYPE,
        language: string
    ): Promise<TermsPolicyDoc[]> {
        return this.termsPolicyRepository.findAll(
            {
                type,
                language,
                deleted: false,
            },
            {
                order: {
                    createdAt: ENUM_PAGINATION_ORDER_DIRECTION_TYPE.DESC,
                },
            }
        );
    }

    mapList(
        policies: TermsPolicyDoc[] | TermsPolicyEntity[],
        options?: ClassTransformOptions
    ): TermsPolicyListResponseDto[] {
        return plainToInstance(
            TermsPolicyListResponseDto,
            policies.map((e: TermsPolicyDoc | TermsPolicyEntity) =>
                e instanceof Document ? e.toObject() : e
            ),
            options
        );
    }
    mapGet(
        policy: TermsPolicyDoc,
        options?: ClassTransformOptions
    ): TermsPolicyGetResponseDto {
        return plainToInstance(
            TermsPolicyGetResponseDto,
            policy.toObject(),
            options
        );
    }
}