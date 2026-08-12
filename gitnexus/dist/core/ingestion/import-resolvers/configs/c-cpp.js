/**
 * C / C++ import resolution configs.
 * Both use standard resolution for #include directives.
 */
import { SupportedLanguages } from 'gitnexus-shared';
import { createStandardStrategy } from '../standard.js';
export const cImportConfig = {
    language: SupportedLanguages.C,
    strategies: [createStandardStrategy(SupportedLanguages.C)],
};
export const cppImportConfig = {
    language: SupportedLanguages.CPlusPlus,
    strategies: [createStandardStrategy(SupportedLanguages.CPlusPlus)],
};
