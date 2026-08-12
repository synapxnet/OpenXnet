// gitnexus/src/core/ingestion/class-extractors/configs/ruby.ts
import { SupportedLanguages } from 'gitnexus-shared';
export const rubyClassConfig = {
    language: SupportedLanguages.Ruby,
    typeDeclarationNodes: ['class'],
    ancestorScopeNodeTypes: ['module', 'class'],
};
