/**
 * Framework Detection
 *
 * Detects frameworks from:
 * 1) file path patterns
 * 2) AST definition text (decorators/annotations/attributes)
 * and provides entry point multipliers for process scoring.
 *
 * DESIGN: Returns null for unknown frameworks, which causes a 1.0 multiplier
 * (no bonus, no penalty) - same behavior as before this feature.
 */
import { SupportedLanguages } from 'gitnexus-shared';
export interface FrameworkHint {
    framework: string;
    entryPointMultiplier: number;
    reason: string;
}
/**
 * Detect framework from file path patterns
 *
 * This provides entry point multipliers based on well-known framework conventions.
 * Returns null if no framework pattern is detected (falls back to 1.0 multiplier).
 */
export declare function detectFrameworkFromPath(filePath: string): FrameworkHint | null;
/**
 * Patterns that indicate framework entry points within code definitions.
 * These are matched against AST node text (class/method/function declaration text).
 */
export declare const FRAMEWORK_AST_PATTERNS: {
    nestjs: string[];
    'expo-router': string[];
    express: string[];
    fastapi: string[];
    flask: string[];
    spring: string[];
    jaxrs: string[];
    aspnet: string[];
    signalr: string[];
    blazor: string[];
    efcore: string[];
    'go-http': string[];
    gin: string[];
    echo: string[];
    fiber: string[];
    'go-grpc': string[];
    prisma: string[];
    supabase: string[];
    laravel: string[];
    actix: string[];
    axum: string[];
    rocket: string[];
    tokio: string[];
    qt: string[];
    uikit: string[];
    swiftui: string[];
    vapor: string[];
    rails: string[];
    sinatra: string[];
    flutter: string[];
    riverpod: string[];
};
export declare const AST_FRAMEWORK_PATTERNS_BY_LANGUAGE: {
    [SupportedLanguages.JavaScript]: {
        framework: string;
        entryPointMultiplier: number;
        reason: string;
        patterns: string[];
    }[];
    [SupportedLanguages.TypeScript]: {
        framework: string;
        entryPointMultiplier: number;
        reason: string;
        patterns: string[];
    }[];
    [SupportedLanguages.Python]: {
        framework: string;
        entryPointMultiplier: number;
        reason: string;
        patterns: string[];
    }[];
    [SupportedLanguages.Java]: {
        framework: string;
        entryPointMultiplier: number;
        reason: string;
        patterns: string[];
    }[];
    [SupportedLanguages.Kotlin]: {
        framework: string;
        entryPointMultiplier: number;
        reason: string;
        patterns: string[];
    }[];
    [SupportedLanguages.CSharp]: {
        framework: string;
        entryPointMultiplier: number;
        reason: string;
        patterns: string[];
    }[];
    [SupportedLanguages.PHP]: {
        framework: string;
        entryPointMultiplier: number;
        reason: string;
        patterns: string[];
    }[];
    [SupportedLanguages.Go]: {
        framework: string;
        entryPointMultiplier: number;
        reason: string;
        patterns: string[];
    }[];
    [SupportedLanguages.Rust]: {
        framework: string;
        entryPointMultiplier: number;
        reason: string;
        patterns: string[];
    }[];
    [SupportedLanguages.C]: undefined[];
    [SupportedLanguages.CPlusPlus]: {
        framework: string;
        entryPointMultiplier: number;
        reason: string;
        patterns: string[];
    }[];
    [SupportedLanguages.Swift]: {
        framework: string;
        entryPointMultiplier: number;
        reason: string;
        patterns: string[];
    }[];
    [SupportedLanguages.Ruby]: {
        framework: string;
        entryPointMultiplier: number;
        reason: string;
        patterns: string[];
    }[];
    [SupportedLanguages.Dart]: {
        framework: string;
        entryPointMultiplier: number;
        reason: string;
        patterns: string[];
    }[];
    [SupportedLanguages.Vue]: undefined[];
    [SupportedLanguages.Cobol]: undefined[];
};
/**
 * Detect framework entry points from AST definition text (decorators/annotations/attributes).
 * Returns null if no known pattern is found.
 * Note: callers should slice definitionText to ~300 chars since annotations appear at the start.
 */
export declare function detectFrameworkFromAST(language: SupportedLanguages, definitionText: string): FrameworkHint | null;
