import { EnumFileExtensionTemplate } from '@common/file/enums/file.enum';
import { HelperArrayService } from '@common/helper/services/helper.array.service';
import { HelperStringService } from '@common/helper/services/helper.string.service';
import { EnumMessageLanguage } from '@common/message/enums/message.enum';
import type { IActivityLogMetadata } from '@modules/activity-log/interfaces/activity-log.interface';
import { TermPolicyContentType } from '@modules/term-policy/constants/term-policy.constant';
import type { TermPolicyContentRequestDto } from '@modules/term-policy/dtos/request/term-policy.content.request.dto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnumTermPolicyType } from '@generated/prisma-client/client';
import type {
    TermPolicy,
    TermPolicyContent,
} from '@generated/prisma-client/client';

@Injectable()
export class TermPolicyUtil {
    private readonly draftPrefixPattern: string;
    private readonly contentScopePrefixPattern: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly helperArrayService: HelperArrayService,
        private readonly helperStringService: HelperStringService
    ) {
        this.draftPrefixPattern = this.configService.get<string>(
            'termPolicy.draftPrefixPattern'
        )!;
        this.contentScopePrefixPattern = this.configService.get<string>(
            'termPolicy.contentScopePrefixPattern'
        )!;
    }

    validateUniqueLanguages(contents: TermPolicyContentRequestDto[]): boolean {
        const languages = contents.map(content => content.language);
        const uniqueLanguages = this.helperArrayService.unique(languages);
        return uniqueLanguages.length === languages.length;
    }

    getDraftPrefix({
        type,
        version,
    }: Pick<TermPolicy, 'type' | 'version'>): string {
        return this.helperStringService.fillPattern(this.draftPrefixPattern, {
            type,
            version: version.toString(),
        });
    }

    getContentScopePrefix(
        type: EnumTermPolicyType,
        version: number,
        language: TermPolicyContent['language']
    ): string {
        return this.helperStringService.fillPattern(
            this.contentScopePrefixPattern,
            { type, version: version.toString(), language }
        );
    }

    createContentFilename(
        type: EnumTermPolicyType,
        version: number,
        language: TermPolicyContent['language']
    ): string {
        return `${type}-v${version}-${language}.${EnumFileExtensionTemplate.hbs}`;
    }

    /** Recognizes a UTF-8 template from its leading bytes: no NUL byte and a valid encoding; a sequence cut by the sample end passes. */
    detectTemplateContentType(head: Uint8Array): string | null {
        if (head.includes(0)) {
            return null;
        }

        try {
            new TextDecoder('utf-8', { fatal: true }).decode(head, {
                stream: true,
            });
        } catch {
            return null;
        }

        return TermPolicyContentType;
    }

    mapActivityLogMetadata(
        termPolicy: Pick<TermPolicy, 'id' | 'type' | 'version'>,
        timestamp: Date
    ): IActivityLogMetadata {
        return {
            termPolicyId: termPolicy.id,
            termPolicyType: termPolicy.type,
            termPolicyVersion: termPolicy.version,
            timestamp,
        };
    }

    getContentByLanguage(
        contents: TermPolicyContent[],
        language: EnumMessageLanguage
    ): TermPolicyContent | null {
        return contents.find(c => c.language === language) ?? null;
    }
}
