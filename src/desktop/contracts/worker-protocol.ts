import { randomUUID } from "node:crypto";

import type { CapabilityId } from "./capability";
import { isCapabilityId } from "./capability";

/** Stable protocol version used between Desktop Core and capability workers. */
export const WORKER_PROTOCOL_VERSION = "1.0";

/** Kinds of messages supported by the newline-delimited worker protocol. */
export type WorkerMessageKind = "request" | "response" | "event" | "error";

/** Serializable error returned by a capability worker. */
export interface WorkerProtocolError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

/** Versioned message exchanged with a capability worker. */
export interface WorkerEnvelope {
  readonly protocolVersion: string;
  readonly messageId: string;
  readonly traceId: string;
  readonly kind: WorkerMessageKind;
  readonly capability: CapabilityId;
  readonly method: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly error?: WorkerProtocolError;
}

/** Inputs used to create a protocol envelope with generated identifiers. */
export interface CreateWorkerEnvelopeInput {
  readonly kind: WorkerMessageKind;
  readonly capability: CapabilityId;
  readonly method: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly messageId?: string;
  readonly traceId?: string;
  readonly error?: WorkerProtocolError;
}

/**
 * Create a normalized worker message with protocol and correlation identifiers.
 *
 * @param input Message fields supplied by Desktop Core or a worker adapter.
 * @returns A serializable worker protocol envelope.
 */
export function createWorkerEnvelope(input: CreateWorkerEnvelopeInput): WorkerEnvelope {
  const messageId = input.messageId ?? randomUUID();
  const traceId = input.traceId ?? messageId;
  const baseEnvelope: WorkerEnvelope = {
    protocolVersion: WORKER_PROTOCOL_VERSION,
    messageId,
    traceId,
    kind: input.kind,
    capability: input.capability,
    method: input.method,
    payload: input.payload ?? {},
  };

  if (input.error === undefined) {
    return baseEnvelope;
  }

  return { ...baseEnvelope, error: input.error };
}

/**
 * Parse and validate one newline-delimited worker protocol message.
 *
 * @param line UTF-8 JSON line received from a worker process.
 * @returns Validated worker protocol envelope.
 */
export function parseWorkerEnvelope(line: string): WorkerEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid worker JSON: ${message}`);
  }
  if (!isRecord(value)) {
    throw new Error("Worker protocol messages must be JSON objects.");
  }

  const protocolVersion = requireText(value, "protocolVersion");
  if (protocolVersion !== WORKER_PROTOCOL_VERSION) {
    throw new Error(
      `Unsupported worker protocol version '${protocolVersion}'; expected '${WORKER_PROTOCOL_VERSION}'.`,
    );
  }
  const kind = requireText(value, "kind");
  if (!isWorkerMessageKind(kind)) {
    throw new Error(`Unsupported worker message kind '${kind}'.`);
  }
  const capability = requireText(value, "capability");
  if (!isCapabilityId(capability)) {
    throw new Error(`Unsupported worker capability '${capability}'.`);
  }
  const payload = value.payload === undefined ? {} : requireRecord(value.payload, "payload");
  const rawError = value.error;
  const parsedError = rawError === undefined ? undefined : parseWorkerError(rawError);
  if (kind === "error" && parsedError === undefined) {
    throw new Error("Worker error envelopes require an error object.");
  }

  const envelope: WorkerEnvelope = {
    protocolVersion,
    messageId: requireText(value, "messageId"),
    traceId: requireText(value, "traceId"),
    kind,
    capability,
    method: requireText(value, "method"),
    payload,
  };
  return parsedError === undefined ? envelope : { ...envelope, error: parsedError };
}

/**
 * Determine whether an unknown value is a supported worker message kind.
 *
 * @param value Value decoded from a process boundary.
 * @returns True when the value is a worker message kind.
 */
function isWorkerMessageKind(value: unknown): value is WorkerMessageKind {
  return value === "request" || value === "response" || value === "event" || value === "error";
}

/**
 * Parse a structured worker error from an untrusted JSON value.
 *
 * @param value Error value decoded from a process boundary.
 * @returns Validated worker protocol error.
 */
function parseWorkerError(value: unknown): WorkerProtocolError {
  const record = requireRecord(value, "error");
  const details = record.details === undefined ? undefined : requireRecord(record.details, "error.details");
  const error: WorkerProtocolError = {
    code: requireText(record, "code"),
    message: requireText(record, "message"),
    retryable: record.retryable === true,
  };
  return details === undefined ? error : { ...error, details };
}

/**
 * Validate an unknown value as a plain JSON object.
 *
 * @param value Value to validate.
 * @returns True when the value is a non-null, non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate an unknown value as a JSON object or throw a field-specific error.
 *
 * @param value Value to validate.
 * @param fieldName Field name used by diagnostics.
 * @returns Validated JSON object.
 */
function requireRecord(value: unknown, fieldName: string): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) {
    throw new Error(`Worker envelope field '${fieldName}' must be an object.`);
  }
  return value;
}

/**
 * Read a required non-empty text field from a JSON object.
 *
 * @param value Object containing the field.
 * @param fieldName Required field name.
 * @returns Trimmed field value.
 */
function requireText(value: Readonly<Record<string, unknown>>, fieldName: string): string {
  const fieldValue = value[fieldName];
  if (typeof fieldValue !== "string" || fieldValue.trim().length === 0) {
    throw new Error(`Worker envelope field '${fieldName}' must be non-empty text.`);
  }
  return fieldValue.trim();
}
