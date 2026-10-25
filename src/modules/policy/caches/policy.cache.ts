import { CacheMainProvider } from '@common/cache/constants/cache.constant';
import { HelperStringService } from '@common/helper/services/helper.string.service';
import type {
    IPolicyRoleReference,
    IPolicyRule,
} from '@modules/policy/interfaces/policy.interface';
import { PolicyRepository } from '@modules/policy/repositories/policy.repository';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';

/**
 * Read-through cache, keyed by role revision, over the raw policy rows of a role. The key embeds
 * `Role.policyRevision`, so a policy writer bumps the revision and the next request reads a new
 * key; nothing is deleted and old revision keys expire by TTL.
 */
@Injectable()
export class PolicyCache {
    private readonly logger = new Logger(PolicyCache.name);
    private readonly keyPattern: string;
    private readonly cacheTtlInMs: number;
    private readonly inFlight = new Map<string, Promise<IPolicyRule[]>>();

    constructor(
        @Inject(CacheMainProvider) private readonly cacheManager: Cache,
        private readonly policyRepository: PolicyRepository,
        private readonly configService: ConfigService,
        private readonly helperStringService: HelperStringService
    ) {
        this.keyPattern = this.configService.get<string>('policy.keyPattern')!;
        this.cacheTtlInMs = this.configService.get<number>(
            'policy.cacheTtlInMs'
        )!;
    }

    private toKey(reference: IPolicyRoleReference): string {
        return this.helperStringService.fillPattern(this.keyPattern, {
            roleId: reference.roleId,
            policyRevision: String(reference.policyRevision),
        });
    }

    /** One cache read for every reference; a read failure is logged and reads as all misses. */
    private async getCacheByReferences(
        references: IPolicyRoleReference[]
    ): Promise<Map<string, IPolicyRule[]>> {
        const keys = references.map(reference => this.toKey(reference));

        try {
            const cached = await this.cacheManager.mget<IPolicyRule[]>(keys);

            return new Map(
                keys.flatMap((key, index) => {
                    const rules = cached[index];

                    return Array.isArray(rules) ? [[key, rules]] : [];
                })
            );
        } catch (error: unknown) {
            this.logger.error(error, 'Policy cache read failed');

            return new Map();
        }
    }

    /** One cache write with the TTL; a write failure is logged and the loaded rows are still returned. */
    private async setCacheByReferences(
        rulesByKey: Map<string, IPolicyRule[]>
    ): Promise<void> {
        try {
            await this.cacheManager.mset(
                [...rulesByKey].map(([key, rules]) => ({
                    key,
                    value: rules,
                    ttl: this.cacheTtlInMs,
                }))
            );
        } catch (error: unknown) {
            this.logger.error(error, 'Policy cache write failed');
        }
    }

    /**
     * Loads the references in one query and caches them. A role with no rows maps to an empty
     * list. A load failure propagates and caches nothing.
     */
    private async loadByRoleIds(
        references: IPolicyRoleReference[]
    ): Promise<Map<string, IPolicyRule[]>> {
        const roleIds = references.map(reference => reference.roleId);
        const rows = await this.policyRepository.findManyByRoleIds(roleIds);
        const byRoleId = Map.groupBy(rows, row => row.roleId);
        const loaded = new Map<string, IPolicyRule[]>(
            references.map(reference => {
                const key = this.toKey(reference);

                return [key, byRoleId.get(reference.roleId) ?? []];
            })
        );

        await this.setCacheByReferences(loaded);

        return loaded;
    }

    /** The slice of one load that belongs to `key`; the in-flight entry leaves the map when it settles. */
    private async takeSlice(
        key: string,
        loading: Promise<Map<string, IPolicyRule[]>>
    ): Promise<IPolicyRule[]> {
        try {
            const loaded = await loading;

            return loaded.get(key)!;
        } finally {
            this.inFlight.delete(key);
        }
    }

    /**
     * Returns the rules of every referenced role revision, in request order, deduplicated by key.
     * One cache read for all keys; the misses share one repository query, and a concurrent miss
     * on the same key awaits the load already running instead of starting its own.
     */
    async getByRoleReferences(
        references: IPolicyRoleReference[]
    ): Promise<IPolicyRule[]> {
        const referenceByKey = new Map<string, IPolicyRoleReference>();
        for (const reference of references) {
            const key = this.toKey(reference);
            referenceByKey.set(key, reference);
        }

        const uniqueReferences = [...referenceByKey.values()];
        const keys = [...referenceByKey.keys()];
        const hits = await this.getCacheByReferences(uniqueReferences);
        const missedKeys = keys.filter(key => !hits.has(key));

        if (missedKeys.length === 0) {
            return keys.flatMap(key => hits.get(key)!);
        }

        const pending = new Map<string, Promise<IPolicyRule[]>>();
        const toLoad: IPolicyRoleReference[] = [];
        for (const key of missedKeys) {
            const running = this.inFlight.get(key);
            if (running) {
                pending.set(key, running);
            } else {
                toLoad.push(referenceByKey.get(key)!);
            }
        }

        if (toLoad.length > 0) {
            const loading = this.loadByRoleIds(toLoad);
            for (const reference of toLoad) {
                const key = this.toKey(reference);
                const slice = this.takeSlice(key, loading);
                this.inFlight.set(key, slice);
                pending.set(key, slice);
            }
        }

        const loadedRules = await Promise.all(
            missedKeys.map(key => pending.get(key)!)
        );
        const loadedByKey = new Map(
            missedKeys.map((key, index) => [key, loadedRules[index]])
        );

        return keys.flatMap(key => hits.get(key) ?? loadedByKey.get(key)!);
    }
}
