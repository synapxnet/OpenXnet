/** IPC channels owned by the Desktop Telegram credential boundary. */
export const APPLICATION_TELEGRAM_CREDENTIAL_CHANNELS = Object.freeze({
  getSnapshot: "openxnet:application-telegram-credentials:get-snapshot",
  save: "openxnet:application-telegram-credentials:save",
});

/** Stable schema returned for redacted Telegram credential snapshots. */
export const APPLICATION_TELEGRAM_CREDENTIAL_SCHEMA = "openxnet.telegram-credentials.v1" as const;

/** Maximum length accepted for one Telegram Bot token. */
export const MAX_APPLICATION_TELEGRAM_BOT_TOKEN_LENGTH = 64 * 1024;

/** Main-owned Telegram credentials stored outside compatibility settings. */
export interface ApplicationTelegramCredentials {
  readonly botToken?: string;
}

/** Redacted Telegram credential state returned through authorized IPC. */
export interface ApplicationTelegramCredentialSnapshot {
  readonly schema: typeof APPLICATION_TELEGRAM_CREDENTIAL_SCHEMA;
  readonly configured: boolean;
  readonly secureStorage: "desktop-safe-storage" | "unavailable";
}

/** Exact Telegram credential mutation accepted from an authorized Renderer. */
export interface SaveApplicationTelegramCredentialsRequest {
  readonly botToken?: string;
  readonly clear?: boolean;
}

/** Determine whether an unknown value exposes inspectable object fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse one bounded single-line Telegram Bot token. */
export function parseApplicationTelegramBotToken(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("Telegram Bot token is invalid.");
  }
  const token = value.trim();
  if (
    token.length < 4
    || token.length > MAX_APPLICATION_TELEGRAM_BOT_TOKEN_LENGTH
    || /[\u0000-\u001F\u007F]/.test(token)
  ) {
    throw new TypeError("Telegram Bot token is invalid.");
  }
  return token;
}

/** Parse one exact Telegram credential object from encrypted storage. */
export function parseApplicationTelegramCredentials(
  value: unknown,
): ApplicationTelegramCredentials {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== "botToken")) {
    throw new TypeError("Telegram credentials are invalid.");
  }
  if (value.botToken === undefined) return {};
  return { botToken: parseApplicationTelegramBotToken(value.botToken) };
}

/** Parse one exact Telegram credential update or explicit clear operation. */
export function parseSaveApplicationTelegramCredentialsRequest(
  value: unknown,
): SaveApplicationTelegramCredentialsRequest {
  if (
    !isRecord(value)
    || Object.keys(value).some((key) => !["botToken", "clear"].includes(key))
    || (value.clear !== undefined && typeof value.clear !== "boolean")
  ) {
    throw new TypeError("Telegram credential save request is invalid.");
  }
  if (value.botToken !== undefined && value.clear === true) {
    throw new TypeError("Telegram credential cannot be saved and cleared together.");
  }
  return {
    ...(value.botToken !== undefined
      ? { botToken: parseApplicationTelegramBotToken(value.botToken) }
      : {}),
    ...(value.clear === true ? { clear: true } : {}),
  };
}
