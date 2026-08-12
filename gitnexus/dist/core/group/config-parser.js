import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
const yaml = _require('js-yaml');
const VALID_CONTRACT_TYPES = ['http', 'grpc', 'topic', 'lib', 'custom'];
const VALID_ROLES = ['provider', 'consumer'];
const DEFAULT_DETECT = {
    http: true,
    grpc: true,
    topics: true,
    shared_libs: true,
    embedding_fallback: true,
};
const DEFAULT_MATCHING = {
    bm25_threshold: 0.7,
    embedding_threshold: 0.65,
    max_candidates_per_step: 3,
};
export function parseGroupConfig(yamlContent) {
    const raw = yaml.load(yamlContent, { schema: yaml.JSON_SCHEMA });
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('Invalid YAML: expected an object');
    }
    if (raw.version === undefined)
        throw new Error('version is required in group.yaml');
    if (raw.version !== 1) {
        throw new Error(`Unsupported group.yaml version: ${raw.version}. Expected 1.`);
    }
    if (!raw.name || typeof raw.name !== 'string')
        throw new Error('name is required in group.yaml');
    if (!raw.repos || typeof raw.repos !== 'object' || Array.isArray(raw.repos)) {
        throw new Error('repos is required in group.yaml (must be a mapping)');
    }
    const repos = raw.repos;
    const repoPaths = new Set(Object.keys(repos));
    const rawLinks = raw.links || [];
    const links = rawLinks.map((l, i) => {
        const link = l;
        if (!link.from || !repoPaths.has(link.from)) {
            throw new Error(`links[${i}].from "${link.from}" does not match any repo path in group`);
        }
        if (!link.to || !repoPaths.has(link.to)) {
            throw new Error(`links[${i}].to "${link.to}" does not match any repo path in group`);
        }
        if (!VALID_CONTRACT_TYPES.includes(link.type)) {
            throw new Error(`links[${i}].type "${link.type}" is invalid. Expected: ${VALID_CONTRACT_TYPES.join(', ')}`);
        }
        if (!VALID_ROLES.includes(link.role)) {
            throw new Error(`links[${i}].role "${link.role}" is invalid. Expected: provider | consumer`);
        }
        if (link.contract === undefined ||
            link.contract === null ||
            String(link.contract).trim() === '') {
            throw new Error(`links[${i}].contract is required`);
        }
        return {
            from: link.from,
            to: link.to,
            type: link.type,
            contract: String(link.contract),
            role: link.role,
        };
    });
    const detect = { ...DEFAULT_DETECT, ...(raw.detect || {}) };
    const matching = { ...DEFAULT_MATCHING, ...(raw.matching || {}) };
    const packages = raw.packages || {};
    return {
        version: 1,
        name: raw.name,
        description: raw.description || '',
        repos,
        links,
        packages,
        detect,
        matching,
    };
}
export async function loadGroupConfig(groupDir) {
    const fsp = await import('node:fs/promises');
    const path = await import('node:path');
    const yamlPath = path.join(groupDir, 'group.yaml');
    const content = await fsp.readFile(yamlPath, 'utf-8');
    return parseGroupConfig(content);
}
