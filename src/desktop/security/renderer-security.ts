import { fileURLToPath } from "node:url";
import path from "node:path";

/** Maximum URL length accepted from a Renderer boundary. */
export const MAX_RENDERER_URL_LENGTH = 4_096;

/** Maximum filename length accepted for a Renderer-initiated download. */
export const MAX_DOWNLOAD_FILENAME_LENGTH = 180;

/** Stable failure returned when Renderer input violates a desktop security policy. */
export class RendererSecurityError extends Error {
  /**
   * Create a structured Renderer security failure.
   *
   * @param code Stable policy failure code.
   * @param message Non-sensitive diagnostic message.
   */
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RendererSecurityError";
  }
}

/** Sanitized extension window request accepted by Electron Main. */
export interface ExtensionWindowRequest {
  readonly url: string;
  readonly id: string;
  readonly name: string;
  readonly transparent: boolean;
  readonly width: number;
  readonly height: number;
}

/** Sanitized Renderer-initiated download request. */
export interface RendererDownloadRequest {
  readonly url: string;
  readonly filename: string;
}

/** Options controlling the one privileged Electron webview capability. */
export interface SecureWebPreferencesOptions {
  readonly allowWebviewTag?: boolean;
}

/** Security-critical fields guaranteed for every application BrowserWindow. */
export interface SecureWebPreferences extends Readonly<Record<string, unknown>> {
  readonly allowRunningInsecureContent: false;
  readonly contextIsolation: true;
  readonly enableRemoteModule: false;
  readonly nodeIntegration: false;
  readonly nodeIntegrationInSubFrames: false;
  readonly sandbox: true;
  readonly webSecurity: true;
  readonly webviewTag: boolean;
}

/**
 * Merge non-security BrowserWindow preferences under an immutable security baseline.
 *
 * @param overrides Window-specific non-security preferences.
 * @param options Explicit capability switches reviewed by Electron Main.
 * @returns Preferences whose critical fields cannot be weakened by overrides.
 */
export function createSecureWebPreferences(
  overrides: Readonly<Record<string, unknown>> = {},
  options: SecureWebPreferencesOptions = {},
): SecureWebPreferences {
  return {
    ...overrides,
    allowRunningInsecureContent: false,
    contextIsolation: true,
    enableRemoteModule: false,
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    sandbox: true,
    webSecurity: true,
    webviewTag: options.allowWebviewTag === true,
  };
}

/**
 * Parse an untrusted URL while enforcing length and credential restrictions.
 *
 * @param value Unknown Renderer value.
 * @returns Parsed credential-free URL.
 */
function parseRendererUrl(value: unknown): URL {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_RENDERER_URL_LENGTH) {
    throw new RendererSecurityError("INVALID_URL", "A bounded URL string is required.");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RendererSecurityError("INVALID_URL", "URL is invalid.");
  }
  if (url.username !== "" || url.password !== "") {
    throw new RendererSecurityError("URL_CREDENTIALS_FORBIDDEN", "URL credentials are not allowed.");
  }
  return url;
}

/**
 * Validate a URL that will be opened by the operating system.
 *
 * @param value Unknown Renderer URL.
 * @returns Normalized HTTP, HTTPS, or mailto URL.
 */
export function assertSafeExternalUrl(value: unknown): string {
  const url = parseRendererUrl(value);
  if (!new Set(["https:", "http:", "mailto:"]).has(url.protocol)) {
    throw new RendererSecurityError("UNSAFE_URL_PROTOCOL", "External URL protocol is not allowed.");
  }
  if ((url.protocol === "https:" || url.protocol === "http:") && url.hostname === "") {
    throw new RendererSecurityError("INVALID_URL", "External URL hostname is required.");
  }
  return url.href;
}

/**
 * Validate a network URL used by the bounded desktop download helper.
 *
 * @param value Unknown Renderer URL.
 * @returns Normalized HTTP or HTTPS URL.
 */
export function assertSafeDownloadUrl(value: unknown): string {
  const url = parseRendererUrl(value);
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.hostname === "") {
    throw new RendererSecurityError("UNSAFE_URL_PROTOCOL", "Download URL must use HTTP or HTTPS.");
  }
  return url.href;
}

/**
 * Determine whether a navigation remains inside a trusted application origin or file root.
 *
 * @param value Candidate navigation URL.
 * @param allowedOrigins Exact trusted HTTP origins.
 * @param allowedFileRoots Application-owned roots allowed for file URLs.
 * @returns True when navigation may proceed in an application BrowserWindow.
 */
export function isAllowedApplicationNavigation(
  value: unknown,
  allowedOrigins: readonly string[],
  allowedFileRoots: readonly string[] = [],
): boolean {
  let url: URL;
  try {
    url = parseRendererUrl(value);
  } catch {
    return false;
  }
  if (url.protocol === "http:" || url.protocol === "https:") {
    return allowedOrigins.some((origin) => origin === url.origin);
  }
  if (url.protocol === "file:") {
    try {
      return isPathWithinRoots(fileURLToPath(url), allowedFileRoots);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Determine whether a canonical path is equal to or below an allow-listed root.
 *
 * @param candidatePath Candidate filesystem path.
 * @param allowedRoots Allowed filesystem roots.
 * @returns True when the path remains inside one root.
 */
export function isPathWithinRoots(
  candidatePath: unknown,
  allowedRoots: readonly string[],
): boolean {
  if (typeof candidatePath !== "string" || candidatePath.trim() === "" || candidatePath.length > 32_768) {
    return false;
  }
  const candidate = path.resolve(candidatePath);
  return allowedRoots.some((root) => {
    const relative = path.relative(path.resolve(root), candidate);
    return relative === "" || (
      relative !== ".."
      && !relative.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relative)
    );
  });
}

/**
 * Determine whether a path is application-owned or explicitly granted by a file dialog.
 *
 * @param candidatePath Canonical candidate path.
 * @param allowedRoots Permanent application-owned roots.
 * @param grantedFiles Exact user-selected files.
 * @param grantedDirectories User-selected directory roots.
 * @returns True when filesystem access is authorized.
 */
export function isAuthorizedRendererPath(
  candidatePath: unknown,
  allowedRoots: readonly string[],
  grantedFiles: ReadonlySet<string>,
  grantedDirectories: readonly string[],
): boolean {
  if (typeof candidatePath !== "string") {
    return false;
  }
  const candidate = path.resolve(candidatePath);
  return grantedFiles.has(candidate)
    || isPathWithinRoots(candidate, allowedRoots)
    || isPathWithinRoots(candidate, grantedDirectories);
}

/**
 * Validate a download filename without permitting directory traversal.
 *
 * @param value Unknown Renderer filename.
 * @returns Safe basename.
 */
export function assertSafeDownloadFilename(value: unknown): string {
  if (
    typeof value !== "string"
    || value.trim() === ""
    || value.length > MAX_DOWNLOAD_FILENAME_LENGTH
    || value !== path.basename(value)
    || /[<>:"/\\|?*\u0000-\u001F]/.test(value)
    || /[. ]$/.test(value)
    || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)
    || value === "."
    || value === ".."
  ) {
    throw new RendererSecurityError("INVALID_DOWNLOAD_FILENAME", "Download filename is invalid.");
  }
  return value;
}

/**
 * Clamp an untrusted numeric window dimension to a safe work-area range.
 *
 * @param value Unknown requested dimension.
 * @param fallback Default dimension.
 * @param minimum Minimum dimension.
 * @param maximum Maximum dimension.
 * @returns Safe integer dimension.
 */
function clampWindowDimension(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const candidate = typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : fallback;
  return Math.max(minimum, Math.min(maximum, candidate));
}

/**
 * Validate a local extension window request against the active application origin.
 *
 * @param value Unknown Renderer request object.
 * @param localOrigin Exact local UI origin.
 * @param workArea Screen work-area dimensions.
 * @returns Sanitized extension request.
 */
export function sanitizeExtensionWindowRequest(
  value: unknown,
  localOrigin: string,
  workArea: Readonly<{ width: number; height: number }>,
): ExtensionWindowRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RendererSecurityError("INVALID_EXTENSION_REQUEST", "Extension window request is invalid.");
  }
  const record = value as Record<string, unknown>;
  const url = parseRendererUrl(record.url);
  if (url.origin !== localOrigin || (url.protocol !== "http:" && url.protocol !== "https:")) {
    throw new RendererSecurityError("UNTRUSTED_EXTENSION_URL", "Extension window URL is not trusted.");
  }
  const extension = typeof record.extension === "object"
    && record.extension !== null
    && !Array.isArray(record.extension)
    ? record.extension as Record<string, unknown>
    : {};
  const id = typeof extension.id === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(extension.id)
    ? extension.id
    : "extension";
  const name = typeof extension.name === "string"
    ? extension.name.trim().slice(0, 128)
    : "Extension";
  return {
    url: url.href,
    id,
    name: name || "Extension",
    transparent: extension.transparent === true,
    width: clampWindowDimension(extension.width, 800, 320, Math.max(320, workArea.width)),
    height: clampWindowDimension(extension.height, 600, 240, Math.max(240, workArea.height)),
  };
}

/**
 * Validate a Renderer download request before invoking electron-dl.
 *
 * @param value Unknown Renderer request object.
 * @returns Sanitized URL and filename.
 */
export function sanitizeRendererDownloadRequest(value: unknown): RendererDownloadRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RendererSecurityError("INVALID_DOWNLOAD_REQUEST", "Download request is invalid.");
  }
  const record = value as Record<string, unknown>;
  return {
    url: assertSafeDownloadUrl(record.url),
    filename: assertSafeDownloadFilename(record.filename),
  };
}
