import { FeatureFlag, FeatureFlagUser } from '@generated/prisma-client';

export type IFeatureFlagMetadataValue =
    | string
    | number
    | boolean
    | string[]
    | number[];

export type IFeatureFlagMetadata = Record<string, IFeatureFlagMetadataValue>;

export interface IFeatureFlagWithTargetUsers extends FeatureFlag {
    targetUsers: FeatureFlagUser[];
}
