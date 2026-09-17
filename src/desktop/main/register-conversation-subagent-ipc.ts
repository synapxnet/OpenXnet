/*
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
子智能体会话记录的桌面读取边界 / Desktop read boundary for subagent conversation records.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
*/
import { realpath } from "node:fs/promises";
import type { ApplicationTask, ApplicationTaskDetail, ApplicationTaskSnapshot } from "../contracts/application-tasks";
import type { IpcMainLike } from "./register-core-ipc";

export const CONVERSATION_SUBAGENT_CHANNEL = "openxnet:conversation-subagent:read";
const TRANSCRIPT_SCHEMA = "openxnet.agent-transcript.v1";
const DENIED = "该子智能体记录不属于当前会话或工作区 / Subagent records are unavailable in this conversation or workspace.";
export interface ConversationSubagentOptions {
  readonly ipcMain: IpcMainLike;
  readonly authorizeEvent: (event: unknown) => void;
  readonly getWorkspacePath: () => unknown;
  readonly listTasks: (request: { workspacePath: string }) => Promise<ApplicationTaskSnapshot>;
  readonly getTask: (request: { taskId: string }) => Promise<ApplicationTaskDetail>;
  readonly refreshTask: (request: { taskId: string }) => Promise<{ readonly task: ApplicationTask }>;
}

/** 只接受可检查的普通对象。 / Accept inspectable record objects only. */
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** 验证必需的有限身份，不接受控制字符或空白变体。 / Validate bounded identities without control characters or whitespace aliases. */
function identifier(value: unknown, maximum = 512): string {
  if (typeof value !== "string" || !value || value !== value.trim() || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(DENIED);
  return value;
}

/** 规范Windows路径别名，保持其他平台大小写语义。 / Canonicalize Windows path aliases while retaining case sensitivity elsewhere. */
async function canonicalWorkspace(value: unknown): Promise<string> {
  const resolved = await realpath(identifier(value, 32_768));
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/** 去除隐藏区、执行控制字符与常见凭据后再输出公开正文。 / Remove hidden blocks, control characters, and common credentials before returning visible text. */
function visibleText(value: unknown, maximum = 16_384): string {
  if (typeof value !== "string") return "";
  let output = ""; let offset = 0; let stack: string[] = [];
  const pattern = /```[^\n]*\n[\s\S]*?(?:```|$)|~~~[^\n]*\n[\s\S]*?(?:~~~|$)|`[^`\n]+`|<\s*(\/?)\s*(think|thought|thinking|analysis|reasoning|system|script|style)\b[^>]*>/gi;
  for (const match of value.matchAll(pattern)) {
    if (!stack.length) output += value.slice(offset, match.index);
    if (match[0].startsWith("`") || match[0].startsWith("~~~")) {
      if (!stack.length) output += match[0]; offset = match.index! + match[0].length; continue;
    }
    const tag = match[2]!.toLowerCase();
    if (match[1]) { const index = stack.lastIndexOf(tag); if (index >= 0) stack = stack.slice(0, index); }
    else if (!match[0].trimEnd().endsWith("/>")) stack.push(tag);
    offset = match.index! + match[0].length;
  }
  if (!stack.length) output += value.slice(offset).replace(/<\s*(?:think|thought|thinking|analysis|reasoning|system|script|style)\b[^>]*$/gi, "");
  const cleaned = output.replace(/(["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret|authorization)["']?\s*[:=]\s*)(?:["'][^"'\r\n]*["']|[^\s,;\r\n}]+)/gi, "$1[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{16,})\b/g, "[redacted]")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  const bounded = cleaned.slice(0, maximum);
  return /[\ud800-\udbff]$/.test(bounded) ? bounded.slice(0, -1) : bounded;
}

/** 将已授权任务记录投影为有限白名单，不返回原始上下文。 / Project an authorized task into a bounded allowlist without returning raw context. */
function publicTranscript(task: ApplicationTask): Record<string, unknown> | null {
  const raw = record(record(task.details.context).agent_transcript);
  if (raw.schema !== TRANSCRIPT_SCHEMA || raw.task_id !== task.legacyTaskId || !Array.isArray(raw.messages)) return null;
  const messages: Record<string, unknown>[] = [];
  let truncated = raw.truncated === true || raw.messages.length > 128;
  for (const item of raw.messages.slice(-128)) {
    const row = record(item); const kind = String(row.kind ?? "");
    if (!["delegation", "continuation", "assistant", "tool_receipt"].includes(kind) || row.hidden === true
      || ["system", "developer", "analysis", "reasoning"].includes(String(row.role ?? ""))
      || ["system", "developer", "analysis", "reasoning"].includes(String(row.channel ?? ""))) continue;
    const content = visibleText(row.content); if (!content) continue;
    const role = kind === "assistant" ? "subagent" : kind === "tool_receipt" ? "tool" : "parent";
    const result: Record<string, unknown> = {
      id: visibleText(row.id, 256), kind, role,
      sender: role === "subagent" ? "child" : role === "tool" ? "tool" : kind === "continuation" ? "runtime" : "parent",
      recipient: role === "subagent" ? "parent" : "child", content,
      created_at: visibleText(row.created_at, 64), session_id: visibleText(row.session_id, 128),
    };
    if (["done", "error", "running", "cancelled", "interrupted", "unknown"].includes(String(row.status))) result.status = row.status;
    if (kind === "tool_receipt") result.tool_name = visibleText(row.tool_name, 512);
    if (row.truncated === true || typeof row.content === "string" && row.content.length > 16_384) { result.truncated = true; truncated = true; }
    messages.push(result);
  }
  while (Buffer.byteLength(JSON.stringify(messages), "utf8") > 90 * 1024) { messages.shift(); truncated = true; }
  return { schema: TRANSCRIPT_SCHEMA, task_id: task.legacyTaskId, parent_task_id: visibleText(raw.parent_task_id, 128),
    session_id: visibleText(raw.session_id, 128), messages, truncated };
}

/** 注册仅供可信主窗口读取当前会话子任务记录的入口。 / Register a read-only entry for the trusted main window's current-conversation subtask records. */
export function registerConversationSubagentIpc(options: ConversationSubagentOptions): () => void {
  /** 校验任务来源、工作区与持久身份，拒绝跨会话拼接。 / Validate task origin, workspace, and durable identity to reject cross-conversation references. */
  async function assertTask(task: ApplicationTask, workspace: string, conversationId: string, coreId: string, legacyId: string): Promise<void> {
    if (task.id !== coreId || task.legacyTaskId !== legacyId || task.deletedAt || record(task.details.context).origin_conversation_id !== conversationId
      || await canonicalWorkspace(task.workspacePath) !== workspace || await canonicalWorkspace(options.getWorkspacePath()) !== workspace) throw new Error(DENIED);
  }

  /** 先检查已持久化归属，再读取Worker详情并重新检查后返回公开字段。 / Check durable ownership before reading Worker details, then recheck before returning public fields. */
  async function read(event: unknown, value: unknown): Promise<Record<string, unknown>> {
    options.authorizeEvent(event);
    const request = record(value);
    if (Object.keys(request).length !== 2 || !Object.hasOwn(request, "taskId") || !Object.hasOwn(request, "conversationId")) throw new Error(DENIED);
    const taskId = identifier(request.taskId, 128); const conversationId = identifier(request.conversationId);
    const workspace = await canonicalWorkspace(options.getWorkspacePath());
    const listed = await options.listTasks({ workspacePath: workspace });
    const matches = listed.tasks.filter(/** 仅匹配真实Core或旧任务身份。 / Match actual Core or legacy task identities only. */ task => task.id === taskId || task.legacyTaskId === taskId);
    if (matches.length !== 1) throw new Error(DENIED);
    const candidate = matches[0]!;
    const stored = await options.getTask({ taskId: candidate.id });
    await assertTask(stored.task, workspace, conversationId, candidate.id, candidate.legacyTaskId);
    const refreshed = await options.refreshTask({ taskId: candidate.id });
    await assertTask(refreshed.task, workspace, conversationId, candidate.id, candidate.legacyTaskId);
    return { taskId: candidate.legacyTaskId, conversationId, transcript: publicTranscript(refreshed.task) };
  }

  options.ipcMain.removeHandler(CONVERSATION_SUBAGENT_CHANNEL);
  options.ipcMain.handle(CONVERSATION_SUBAGENT_CHANNEL, read);
  /** 移除本模块的只读处理器。 / Remove this module's read-only handler. */
  return function cleanup(): void { options.ipcMain.removeHandler(CONVERSATION_SUBAGENT_CHANNEL); };
}
