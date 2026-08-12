/**
 * Language Provider Registry — compile-time exhaustive provider table.
 *
 * To add a new language:
 * 1. Add enum member to SupportedLanguages
 * 2. Create `languages/<lang>.ts` exporting a LanguageProvider
 * 3. Add one line to the `providers` table below
 * 4. Run `tsc --noEmit` to verify
 */
import { SupportedLanguages } from 'gitnexus-shared';
import type { LanguageProvider } from '../language-provider.js';
export declare const providers: {
    [SupportedLanguages.JavaScript]: LanguageProvider;
    [SupportedLanguages.TypeScript]: LanguageProvider;
    [SupportedLanguages.Python]: LanguageProvider;
    [SupportedLanguages.Java]: LanguageProvider;
    [SupportedLanguages.Kotlin]: LanguageProvider;
    [SupportedLanguages.Go]: LanguageProvider;
    [SupportedLanguages.Rust]: LanguageProvider;
    [SupportedLanguages.CSharp]: LanguageProvider;
    [SupportedLanguages.C]: LanguageProvider;
    [SupportedLanguages.CPlusPlus]: LanguageProvider;
    [SupportedLanguages.PHP]: LanguageProvider;
    [SupportedLanguages.Ruby]: LanguageProvider;
    [SupportedLanguages.Swift]: LanguageProvider;
    [SupportedLanguages.Dart]: LanguageProvider;
    [SupportedLanguages.Vue]: LanguageProvider;
    [SupportedLanguages.Cobol]: LanguageProvider;
};
/** Get provider by language enum (always succeeds for SupportedLanguages). */
export declare function getProvider(language: SupportedLanguages): LanguageProvider;
/** Look up a language provider from a file path by extension.
 *  Returns null if the file extension is not recognized. */
export declare function getProviderForFile(filePath: string): LanguageProvider | null;
/** Pre-computed list of providers that have implicit import wiring (e.g., Swift).
 *  Built once at module load — avoids iterating all 13 providers per call. */
export declare const providersWithImplicitWiring: (LanguageProvider & {
    implicitImportWirer: NonNullable<LanguageProvider["implicitImportWirer"]>;
})[];
