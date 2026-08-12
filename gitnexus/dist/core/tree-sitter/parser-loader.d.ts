import Parser from 'tree-sitter';
import { SupportedLanguages } from 'gitnexus-shared';
export declare const isLanguageAvailable: (language: SupportedLanguages) => boolean;
export declare const resolveLanguageKey: (language: SupportedLanguages, filePath?: string) => string;
export declare const getLanguageGrammar: (language: SupportedLanguages, filePath?: string) => any;
export declare const loadParser: () => Promise<Parser>;
export declare const loadLanguage: (language: SupportedLanguages, filePath?: string) => Promise<void>;
export declare const createParserForLanguage: (language: SupportedLanguages, filePath?: string) => Promise<Parser>;
