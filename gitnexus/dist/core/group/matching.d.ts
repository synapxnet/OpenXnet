import type { StoredContract, CrossLink } from './types.js';
export interface MatchResult {
    matched: CrossLink[];
    unmatched: StoredContract[];
}
export interface WildcardMatchResult {
    matched: CrossLink[];
    remaining: StoredContract[];
}
export declare function normalizeContractId(id: string): string;
export declare function buildProviderIndex(contracts: StoredContract[]): Map<string, StoredContract[]>;
export declare function runExactMatch(contracts: StoredContract[], providerIndex?: Map<string, StoredContract[]>): MatchResult;
export declare function runWildcardMatch(unmatched: StoredContract[], providerIndex: Map<string, StoredContract[]>): WildcardMatchResult;
