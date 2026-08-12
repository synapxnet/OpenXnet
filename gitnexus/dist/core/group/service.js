/**
 * Group orchestration shared by MCP (LocalBackend) and CLI.
 * DB access is injected via GroupToolPort so this module stays free of LocalBackend private API.
 */
import { checkStaleness } from '../git-staleness.js';
import { loadGroupConfig } from './config-parser.js';
import { getDefaultGitnexusDir, getGroupDir, listGroups, readContractRegistry } from './storage.js';
import { syncGroup } from './sync.js';
function repoInSubgroup(repoPath, subgroup) {
    if (!subgroup?.trim())
        return true;
    const s = subgroup.replace(/\/+$/, '');
    return repoPath === s || repoPath.startsWith(`${s}/`);
}
export class GroupService {
    port;
    constructor(port) {
        this.port = port;
    }
    async groupList(params) {
        const name = typeof params.name === 'string' ? params.name.trim() : '';
        if (!name) {
            const groups = await listGroups();
            return { groups };
        }
        const groupDir = getGroupDir(getDefaultGitnexusDir(), name);
        const config = await loadGroupConfig(groupDir);
        return {
            name: config.name,
            description: config.description,
            repos: config.repos,
            links: config.links,
        };
    }
    async groupSync(params) {
        const name = String(params.name ?? '').trim();
        if (!name)
            return { error: 'name is required' };
        const groupDir = getGroupDir(getDefaultGitnexusDir(), name);
        const config = await loadGroupConfig(groupDir);
        const result = await syncGroup(config, {
            groupDir,
            exactOnly: Boolean(params.exactOnly),
            skipEmbeddings: Boolean(params.skipEmbeddings),
            allowStale: Boolean(params.allowStale),
            verbose: Boolean(params.verbose),
        });
        return {
            contracts: result.contracts.length,
            crossLinks: result.crossLinks.length,
            unmatched: result.unmatched.length,
            missingRepos: result.missingRepos,
        };
    }
    async groupContracts(params) {
        const name = String(params.name ?? '').trim();
        if (!name)
            return { error: 'name is required' };
        const groupDir = getGroupDir(getDefaultGitnexusDir(), name);
        const registry = await readContractRegistry(groupDir);
        if (!registry) {
            return { error: `No contracts.json for group "${name}". Run group_sync first.` };
        }
        let contracts = registry.contracts;
        if (params.type)
            contracts = contracts.filter((c) => c.type === params.type);
        if (params.repo)
            contracts = contracts.filter((c) => c.repo === params.repo);
        if (params.unmatchedOnly) {
            const matchedIds = new Set(registry.crossLinks.flatMap((l) => [
                `${l.from.repo}::${l.contractId}`,
                `${l.to.repo}::${l.contractId}`,
            ]));
            contracts = contracts.filter((c) => !matchedIds.has(`${c.repo}::${c.contractId}`));
        }
        return { contracts, crossLinks: registry.crossLinks };
    }
    async groupQuery(params) {
        const name = String(params.name ?? '').trim();
        const queryText = String(params.query ?? '').trim();
        if (!name || !queryText)
            return { error: 'name and query are required' };
        const limit = typeof params.limit === 'number' && params.limit > 0 ? params.limit : 5;
        const subgroup = typeof params.subgroup === 'string' ? params.subgroup : undefined;
        const groupDir = getGroupDir(getDefaultGitnexusDir(), name);
        const config = await loadGroupConfig(groupDir);
        const perRepo = [];
        for (const [repoPath, registryName] of Object.entries(config.repos)) {
            if (!repoInSubgroup(repoPath, subgroup))
                continue;
            try {
                const repoObj = await this.port.resolveRepo(registryName);
                const queryResult = (await this.port.query(repoObj, {
                    query: queryText,
                    limit,
                    max_symbols: 10,
                    include_content: false,
                }));
                const processes = queryResult.processes || [];
                const scored = processes.map((p, idx) => ({
                    ...p,
                    _rrf_score: 1 / (idx + 1 + 60),
                    _repo: repoPath,
                }));
                perRepo.push({ repo: repoPath, score: 0, processes: scored });
            }
            catch {
                perRepo.push({ repo: repoPath, score: 0, processes: [] });
            }
        }
        const allProcesses = perRepo.flatMap((r) => r.processes);
        allProcesses.sort((a, b) => b._rrf_score - a._rrf_score);
        const topN = allProcesses.slice(0, limit);
        return {
            group: name,
            query: queryText,
            results: topN,
            per_repo: perRepo.map((r) => ({ repo: r.repo, count: r.processes.length })),
        };
    }
    async groupStatus(params) {
        const name = String(params.name ?? '').trim();
        if (!name)
            return { error: 'name is required' };
        const groupDir = getGroupDir(getDefaultGitnexusDir(), name);
        const config = await loadGroupConfig(groupDir);
        const registry = await readContractRegistry(groupDir);
        const repoStatuses = {};
        const fsp = await import('node:fs/promises');
        const pathMod = await import('node:path');
        for (const [repoPath, registryName] of Object.entries(config.repos)) {
            try {
                const repoObj = await this.port.resolveRepo(registryName);
                const metaPath = pathMod.join(repoObj.storagePath, 'meta.json');
                const metaRaw = await fsp.readFile(metaPath, 'utf-8').catch(() => '{}');
                const meta = JSON.parse(metaRaw);
                const staleness = meta.lastCommit
                    ? checkStaleness(repoObj.repoPath, meta.lastCommit)
                    : { isStale: true, commitsBehind: -1 };
                const snapshot = registry?.repoSnapshots[repoPath];
                const contractsStale = snapshot && meta.indexedAt ? snapshot.indexedAt !== meta.indexedAt : !snapshot;
                repoStatuses[repoPath] = {
                    indexStale: staleness.isStale,
                    contractsStale: Boolean(contractsStale),
                    missing: false,
                    commitsBehind: staleness.commitsBehind,
                };
            }
            catch {
                repoStatuses[repoPath] = { indexStale: false, contractsStale: false, missing: true };
            }
        }
        return {
            group: name,
            lastSync: registry?.generatedAt || null,
            missingRepos: registry?.missingRepos || [],
            repos: repoStatuses,
        };
    }
}
