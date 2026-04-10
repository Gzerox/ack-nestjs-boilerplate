import {
    Injectable,
    PipeTransform,
    Type,
    UnsupportedMediaTypeException,
    mixin,
} from '@nestjs/common';
import { EnumFileStatusCodeError } from '@common/file/enums/file.status-code.enum';
import { IFile } from '@common/file/interfaces/file.interface';
import { EnumFileExtension } from '@common/file/enums/file.enum';
import { FileService } from '@common/file/services/file.service';

export function FileExtensionMultiplePipe(
    allowedExtensions: EnumFileExtension[]
): Type<PipeTransform> {
    @Injectable()
    class MixinFileExtensionMultiplePipe implements PipeTransform {
        private readonly extensions: ReadonlySet<string> = new Set(
            allowedExtensions
        );

        constructor(private readonly fileService: FileService) {}

        async transform(value: IFile[]): Promise<IFile[]> {
            if (!value || value.length === 0) {
                return value;
            }

            for (const file of value) {
                if (!file?.originalname) {
                    throw new UnsupportedMediaTypeException({
                        statusCode: EnumFileStatusCodeError.extensionInvalid,
                        message: 'file.error.extensionInvalid',
                    });
                }
                const extension =
                    this.fileService.extractExtensionFromFilename(
                        file.originalname
                    );
                if (!this.extensions.has(extension)) {
                    throw new UnsupportedMediaTypeException({
                        statusCode: EnumFileStatusCodeError.extensionInvalid,
                        message: 'file.error.extensionInvalid',
                    });
                }
            }

            return value;
        }
    }

    return mixin(MixinFileExtensionMultiplePipe);
}
