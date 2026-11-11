import { EnumMessageLanguage } from '@common/message/enums/message.enum';
import type { IStoredAsset } from '@common/storage/interfaces/storage.interface';
import { ObjectStorageService } from '@common/storage/services/storage.object.service';
import {
    TermPolicyContentType,
    TermPolicyTemplateFilenames,
} from '@modules/term-policy/constants/term-policy.constant';
import { TermPolicyUtil } from '@modules/term-policy/utils/term-policy.util';
import { Injectable } from '@nestjs/common';
import {
    EnumStorageVisibility,
    EnumTermPolicyType,
} from '@generated/prisma-client/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

@Injectable()
export class TermPolicyTemplateDomain {
    private readonly templatesDir = join(
        process.cwd(),
        'src/modules/term-policy/templates'
    );
    private readonly templateVersion = 1;

    constructor(
        private readonly termPolicyUtil: TermPolicyUtil,
        private readonly objectStorageService: ObjectStorageService
    ) {}

    /** Writes the English initial-data template of a policy type onto the public disk, as published version 1 content. */
    async importTemplate(type: EnumTermPolicyType): Promise<IStoredAsset> {
        const templatePath = join(
            this.templatesDir,
            TermPolicyTemplateFilenames[type]
        );
        const body = readFileSync(templatePath);
        const scopePrefix = this.termPolicyUtil.getContentScopePrefix(
            type,
            this.templateVersion,
            EnumMessageLanguage.en
        );

        return this.objectStorageService.store(
            { visibility: EnumStorageVisibility.public, scopePrefix },
            { body, contentType: TermPolicyContentType }
        );
    }
}
