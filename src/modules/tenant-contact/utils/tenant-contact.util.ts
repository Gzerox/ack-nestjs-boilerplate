import { plainToInstance } from 'class-transformer';
import { TenantContact } from '@generated/prisma-client';
import { TenantContactResponseDto } from '@modules/tenant-contact/dtos/response/tenant-contact.response.dto';

export function mapTenantContactToResponseDto(contact: TenantContact): TenantContactResponseDto {
    return plainToInstance(TenantContactResponseDto, contact);
}
