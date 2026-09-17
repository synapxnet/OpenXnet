/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 会话活动、身份与只读投影 / Conversation activity, identity and read-only projection.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */

/** 发布无宿主副作用的共享模型。 / Publish the shared model without host side effects. */
(function publishConversationModel(root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  if (root) root.OpenXnetConversationModel = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createConversationModel() {
  'use strict';

  const statusLabels = {
    running: ['运行中', 'Running'], pending: ['等待中', 'Pending'],
    done: ['已完成', 'Completed'], error: ['失败', 'Failed'],
    cancelled: ['已取消', 'Cancelled'], interrupted: ['已中断', 'Interrupted'],
    awaiting_approval: ['等待确认', 'Awaiting approval'], unknown: ['状态未知', 'Unknown'],
  };
  const statusAliases = {
    success: 'done', completed: 'done', complete: 'done', succeeded: 'done',
    failed: 'error', failure: 'error', canceled: 'cancelled', stopped: 'interrupted',
    queued: 'pending', waiting: 'pending', in_progress: 'running',
    approval_required: 'awaiting_approval', waiting_approval: 'awaiting_approval',
  };

  /** 截取完整 Unicode 字符。 / Bound text without splitting Unicode code points. */
  function boundedText(value, limit = 280) {
    return Array.from(String(value ?? '')).slice(0, limit).join('');
  }

  /** 读取有限非负数，缺失仍未知。 / Read finite nonnegative numbers while retaining unknown values. */
  function nonnegativeNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  /** 分类实际连接故障，只公开白名单原因而非原始响应。 / Classify actual connection failures and expose allowlisted reasons rather than raw responses. */
  function classifyConnectionFailure(error, options = {}) {
    const code = String(error?.code || error?.errorCode || '').toLowerCase();
    const raw = String(error?.message || '');
    const supplied = Number(error?.statusCode ?? error?.status ?? error?.httpStatus);
    const match = /(?:http[ _:]*(?:error[!: ]*status[ :]*|status[ :]*|)|status[ :=]+)([45]\d{2})\b/i.exec(`${code} ${raw}`);
    const httpStatus = Number.isInteger(supplied) && supplied >= 400 && supplied <= 599 ? supplied : match ? Number(match[1]) : null;
    let kind;
    if (options.userCanceled || error?.cancelled === true || ['cancelled', 'canceled', 'request_cancelled', 'abort_err'].includes(code) || (error?.name === 'AbortError' && !/timeout|timedout|timed_out/.test(code))) kind = 'canceled';
    else if (httpStatus === 401 || httpStatus === 403 || /^(?:unauthorized|forbidden|authentication_error|invalid_api_key)$/.test(code)) kind = 'auth';
    else if (/insufficient_quota|quota_exceeded|credit_balance|billing_hard_limit/.test(code) || /insufficient[_ ]quota|quota exceeded|credit balance|余额不足|额度不足/i.test(raw)) kind = 'quota';
    else if (httpStatus) kind = 'http';
    else if (/timeout|timedout|timed_out/.test(code) || error?.name === 'TimeoutError' || /timed?\s*out|timeout|超时/i.test(raw)) kind = 'timeout';
    else if (options.online === false) kind = 'offline';
    else if (options.beforeRequest) kind = 'application';
    else if (code === 'stream_interrupted' || options.streamStarted) kind = 'stream';
    else kind = 'transport';
    const retryable = ['offline', 'timeout', 'stream', 'transport'].includes(kind) || (kind === 'http' && [408, 429, 500, 502, 503, 504].includes(httpStatus));
    const reasons = { canceled: 'user_cancelled', auth: 'authentication_required', quota: 'quota_or_billing', http: 'service_response', timeout: 'request_timeout', offline: 'device_offline', application: 'request_not_started', stream: 'response_stream_interrupted', transport: 'transport_unavailable' };
    return { kind, httpStatus, retryable, detail: `${httpStatus ? `HTTP ${httpStatus} · ` : ''}${reasons[kind]}` };
  }

  /** 从有限状态生成准确提示，不把探测成功写成模型已恢复。 / Generate truthful feedback without equating a successful probe with model recovery. */
  function connectionFeedbackMessage(record, isZh = true) {
    if (!record || record.state === 'idle') return '';
    if (record.state === 'checking') return isZh ? `正在检查会话状态 ${record.attempt}/${record.maxAttempts}，当前进度已保留。` : `Checking conversation status ${record.attempt}/${record.maxAttempts}. Your progress is preserved.`;
    if (record.state === 'offline') return isZh ? '当前设备已离线，已有内容已保留。网络恢复后可检查会话状态。' : 'This device is offline. Existing content is preserved; check conversation status when the network returns.';
    if (record.state === 'reachable') {
      if (record.runtimeState === 'running') return isZh ? '应用服务可达，原回复仍在执行。暂未启动新的生成。' : 'The application is reachable; the original reply is still running. No new generation was started.';
      if (record.runtimeState !== 'idle') return isZh ? '应用服务可达，原回复状态仍无法确认，请稍后再次检查。' : 'The application is reachable, but the original reply state remains unverified. Check again later.';
      return isZh ? '应用服务可达，原响应流无法直接续接。可继续核对并续写，已有内容已保留。' : 'The application is reachable; the original response stream cannot reconnect. Continue to verify and resume from the preserved content.';
    }
    const labels = {
      offline: ['网络信号已恢复，原会话尚未恢复。请检查会话状态。', 'The device network signal has returned; the conversation is still interrupted. Check its status.'],
      auth: ['登录或服务授权失效，请更新授权后再继续。', 'Authentication is required. Update authorization before continuing.'],
      quota: ['服务额度或余额不足，请处理后再继续。', 'Service quota or balance is insufficient. Resolve it before continuing.'],
      timeout: ['请求超时，当前进度已保留。', 'The request timed out. Your progress is preserved.'],
      stream: ['响应流意外中断，当前进度已保留。', 'The response stream was interrupted. Your progress is preserved.'],
      application: ['请求未能启动，请先检查会话保存状态。', 'The request could not start. Check conversation saving first.'],
      transport: ['连接中断，当前进度已保留。', 'The connection was interrupted. Your progress is preserved.'],
      http: [record.httpStatus === 429 ? '服务请求频率受限，请稍后检查。' : `服务暂时无法完成请求${record.httpStatus ? `（HTTP ${record.httpStatus}）` : ''}，当前进度已保留。`, record.httpStatus === 429 ? 'The service rate limit was reached. Check again later.' : `The service could not complete the request${record.httpStatus ? ` (HTTP ${record.httpStatus})` : ''}. Your progress is preserved.`],
    };
    const base = (labels[record.kind] || labels.transport)[isZh ? 0 : 1];
    return record.state === 'failed' && record.attempt >= record.maxAttempts ? `${base} ${isZh ? `已完成 ${record.attempt} 次状态检查，仍无法确认恢复。` : `All ${record.attempt} status checks finished without verifying recovery.`}` : base;
  }

  /** 规范状态，不将缺失结果当作成功。 / Normalize status without treating missing results as success. */
  function normalizeActivityStatus(value) {
    const raw = String(value || '').toLowerCase().replace(/[ -]+/g, '_');
    const status = statusAliases[raw] || raw;
    return Object.prototype.hasOwnProperty.call(statusLabels, status) ? status : 'unknown';
  }

  /** 为状态提供可读中英文。 / Provide readable localized status labels. */
  function getActivityStatusLabel(status, isZh = true) {
    return statusLabels[normalizeActivityStatus(status)][isZh ? 0 : 1];
  }

  /** 拦截可执行或超大图片地址。 / Reject executable or oversized image addresses. */
  function safeImageUrl(value, maxLength = 3000000) {
    const url = String(value || '').trim();
    if (!url || url.length > maxLength || /[\u0000-\u001f]/.test(url)) return '';
    if (/^data:/i.test(url)) return /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=]+$/i.test(url) ? url : '';
    if (/^(?:https?:|blob:|file:)/i.test(url)) return url;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^[a-z]:[\\/]/i.test(url)) return '';
    return url.startsWith('//') ? '' : url;
  }

  /** 使用消息自己的身份，不读取全局当前角色。 / Use message identity without reading the currently selected role. */
  function normalizeIdentity(value, options = {}) {
    const identity = value && typeof value === 'object' ? value : {};
    const name = boundedText(identity.name || options.fallbackName || '', 160);
    return {
      id: boundedText(identity.id || '', 160), name,
      image: safeImageUrl(identity.image),
      text: boundedText(identity.text || name || '?', 2),
      kind: boundedText(identity.kind || options.fallbackKind || 'assistant', 40),
      source: boundedText(identity.source || 'unknown', 160),
    };
  }

  /** 格式化详情为惰性文本，不生成 HTML。 / Format details as inert text without generating HTML. */
  function formatDetail(value, limit = 100000) {
    if (value === null || value === undefined || value === '') return '';
    let text;
    try { text = typeof value === 'string' ? value : JSON.stringify(value, null, 2); }
    catch { text = '[Unserializable detail / 无法序列化的详情]'; }
    return text.length > limit ? `${boundedText(text, limit)}\n… [内容已截断 / Truncated]` : text;
  }

  /** 保留注入回执状态，不从设置猜测注入成功。 / Preserve receipt status without inferring injection from settings. */
  function normalizeMemoryContext(receipts) {
    if (!Array.isArray(receipts)) return [];
    return receipts.filter(function validReceipt(receipt) {
      // 仅接收对象回执。 / Accept object receipts only.
      return receipt && typeof receipt === 'object';
    }).map(function normalizeReceipt(receipt, index) {
      // 显式列出展示字段，排除私密正文。 / Allowlist display fields and exclude private memory bodies.
      return {
        id: boundedText(receipt.id || `receipt-${index}`, 180),
        source: boundedText(receipt.source || 'unknown', 180),
        type: boundedText(receipt.type || receipt.kind || 'unknown', 80),
        status: boundedText(receipt.status || 'unknown', 80),
        count: nonnegativeNumber(receipt.count),
        characters: nonnegativeNumber(receipt.characters ?? receipt.characterCount),
        detail: formatDetail(receipt.detail), reason: formatDetail(receipt.reason),
        conversationId: boundedText(receipt.conversationId || receipt.conversation_id || '', 180),
        items: Array.isArray(receipt.items) ? receipt.items.filter(function validMemoryItem(item) {
          // 仅接收真实来源元数据。 / Accept actual source metadata only.
          return item && typeof item === 'object';
        }).map(function memoryItemMetadata(item) {
          // 显式保留版本与指纹，排除记忆原文。 / Retain explicit versions and digests while excluding memory text.
          return {
            memoryId: boundedText(item.memoryId, 180), version: boundedText(item.version, 100),
            title: boundedText(item.title, 400), ownerAgent: boundedText(item.ownerAgent, 180),
            taskId: boundedText(item.taskId, 180), characters: nonnegativeNumber(item.characters),
            recordSha256: boundedText(item.recordSha256, 64),
            injectedContentSha256: boundedText(item.injectedContentSha256, 64),
          };
        }) : [],
      };
    });
  }

  /** 显示由实际时间戳计算的耗时。 / Display duration derived from actual timestamps. */
  function formatDuration(milliseconds, isZh = true) {
    if (milliseconds === null) return '';
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    return seconds < 60 ? `${seconds}${isZh ? '秒' : 's'}` : `${Math.floor(seconds / 60)}${isZh ? '分' : 'm'} ${seconds % 60}${isZh ? '秒' : 's'}`;
  }

  /** 读取有界工具对象，不执行内容或展开未知字段。 / Read bounded tool records without executing content or expanding unknown fields. */
  function fileChangeRecord(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string' || value.length > 300000 || !value.trimStart().startsWith('{')) return {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  }

  /** 路径仅作文本标识，拒绝被截断或含控制字符的标识。 / Treat paths as text identifiers and reject truncated or control-character paths. */
  function fileChangePath(value) {
    return typeof value === 'string' && value.trim() && value.length <= 4096 && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim() : '';
  }

  /** 规范明确文件操作，不从路径或内容猜测新建。 / Normalize explicit file operations without guessing creation from paths or content. */
  function fileChangeOperation(value) {
    const raw = String(value && typeof value === 'object' ? value.type || '' : value || '').toLowerCase();
    return ({ add: 'create', added: 'create', created: 'create', create: 'create', edit: 'modify', update: 'modify', modified: 'modify', modify: 'modify', remove: 'delete', deleted: 'delete', delete: 'delete', move: 'rename', renamed: 'rename', rename: 'rename', write: 'write' })[raw] || '';
  }

  /** 只接收真实非负整数计数，零值仍有效。 / Accept only actual nonnegative integer counts, including zero. */
  function fileChangeCount(value) { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null; }

  /** 用原创几何路径与稳定组合区分智能体，不依赖外部图片。 / Distinguish agents using original geometric paths and stable combinations without external images. */
  function agentGlyph(seed) {
    const paths = [
      'M12 3 20 12 12 21 4 12Z M12 7V17 M7 12H17',
      'M5 5H19V19H5Z M5 12H19 M12 5V19 M8 8H16V16H8Z',
      'M12 3 21 18H3Z M12 9 16 16H8Z',
      'M12 3V8 M12 16V21 M3 12H8 M16 12H21 M7 7 17 17 M17 7 7 17',
      'M4 8 12 3 20 8V16L12 21 4 16Z M4 8 12 13 20 8 M12 13V21',
      'M4 4H10V10H4Z M14 4H20V10H14Z M4 14H10V20H4Z M14 14H20V20H14Z',
      'M12 3C21 3 21 21 12 21S3 3 12 3Z M3 12H21 M12 3C5 9 5 15 12 21C19 15 19 9 12 3Z',
      'M3 7 7 3 12 8 17 3 21 7 16 12 21 17 17 21 12 16 7 21 3 17 8 12Z',
      'M4 5H20L12 12Z M4 19H20L12 12Z M4 5V19 M20 5V19',
      'M12 3 15 8 21 9 17 14 18 21 12 18 6 21 7 14 3 9 9 8Z',
      'M4 4 20 20 M20 4 4 20 M4 12 12 4 20 12 12 20Z',
      'M3 12 8 4H16L21 12 16 20H8Z M8 4 16 20 M16 4 8 20 M3 12H21',
    ];
    let hash = 2166136261;
    for (const char of String(seed || 'agent')) hash = Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0;
    return { path: paths[hash % paths.length], rotation: Math.floor(hash / paths.length) % 4 * 90, tone: hash % 3 };
  }

  /** 只保留公开的父子协作消息，丢弃系统、隐藏推理和无效记录。 / Retain only public parent-child collaboration messages, excluding system and hidden reasoning records. */
  function normalizeSubagentTranscript(record) {
    const messages = Array.isArray(record) ? record : Array.isArray(record?.messages) ? record.messages : [];
    return messages.slice(-200).flatMap(function visibleAgentMessage(row, index) {
      // 仅按已知发送者映射身份，不从正文猜测消息来源。 / Map identity only from known senders without guessing from message text.
      if (!row || typeof row !== 'object' || ['system', 'developer', 'analysis', 'reasoning'].includes(String(row.role || row.kind || '').toLowerCase())) return [];
      const role = ({ parent: 'parent', user: 'parent', child: 'subagent', assistant: 'subagent', subagent: 'subagent', tool: 'tool', runtime: 'runtime' })[row.role || row.sender];
      if (!role || typeof row.content !== 'string') return [];
      const content = plainPreview(row.content, 60000, true);
      if (!content) return [];
      return [{ id: boundedText(row.id || `transcript-${index}`, 240), role, content, timestamp: row.timestamp ?? row.created_at ?? null, status: normalizeActivityStatus(row.status), kind: boundedText(row.kind || '', 80), toolName: boundedText(row.tool_name || row.toolName || '', 160) }];
    });
  }

  /** 验证单文件完整 unified diff 后统计实际差异行。 / Count changed lines only after validating a complete single-file unified diff. */
  function countFileDiffLines(value) {
    if (typeof value !== 'string' || !value || value.length > 100000) return null;
    const lines = value.replace(/\r\n/g, '\n').split('\n');
    let oldHeader = 0; let newHeader = 0; let hunks = 0; let active = null; let additions = 0; let deletions = 0;
    let oldEnd = 0; let newEnd = 0;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (active && active.old === active.expectedOld && active.next === active.expectedNew) active = null;
      if (line === '\\ No newline at end of file') continue;
      if (line.startsWith('@@ ')) {
        if (active || oldHeader !== 1 || newHeader !== 1) return null;
        const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:.*)$/.exec(line);
        if (!match) return null;
        active = { old: 0, next: 0, expectedOld: Number(match[2] ?? 1), expectedNew: Number(match[4] ?? 1) };
        if (Number(match[1]) < oldEnd || Number(match[3]) < newEnd) return null;
        oldEnd = Number(match[1]) + active.expectedOld;
        newEnd = Number(match[3]) + active.expectedNew;
        hunks += 1; continue;
      }
      if (active) {
        if (line.startsWith('+')) { active.next += 1; additions += 1; }
        else if (line.startsWith('-')) { active.old += 1; deletions += 1; }
        else if (line.startsWith(' ')) { active.old += 1; active.next += 1; }
        else return null;
        if (active.old > active.expectedOld || active.next > active.expectedNew) return null;
        continue;
      }
      if (line.startsWith('--- ')) { oldHeader += 1; if (oldHeader > 1 || newHeader) return null; }
      else if (line.startsWith('+++ ')) { newHeader += 1; if (newHeader > 1 || oldHeader !== 1) return null; }
      else if (line === '' && index === lines.length - 1) continue;
      else if (!hunks && /^(?:diff --git |index |new file mode |deleted file mode |old mode |new mode |similarity index |rename from |rename to )/.test(line)) continue;
      else return null;
    }
    if (active && (active.old !== active.expectedOld || active.next !== active.expectedNew)) return null;
    return hunks > 0 && oldHeader === 1 && newHeader === 1 ? { additions, deletions } : null;
  }

  /** 从明确状态与布尔执行结果读取文件回执状态。 / Read file receipt state from explicit status and boolean execution results. */
  function fileReceiptStatus(record) {
    if (record.success === false || record.ok === false) return 'error';
    const status = normalizeActivityStatus(record.status || record.phase);
    return status !== 'unknown' ? status : record.success === true || record.ok === true ? 'done' : 'unknown';
  }

  /** 由真实回执生成可展开文件记录，申请内容不证明写入完成。 / Project expandable file records from actual receipts; requested content never proves a completed write. */
  function projectFileChanges(step) {
    if (!step || typeof step !== 'object') return [];
    const input = fileChangeRecord(step.input);
    const output = fileChangeRecord(step.output);
    const nestedOutput = fileChangeRecord(output.result);
    const outerStatus = normalizeActivityStatus(step.status);
    const directOutputStatus = fileReceiptStatus(output);
    const outputStatus = directOutputStatus !== 'unknown' ? directOutputStatus : fileReceiptStatus(nestedOutput);
    const outputText = typeof step.output === 'string' ? step.output.trim() : '';
    const failed = outputStatus === 'error' || /^\[error\]|^error(?: calling tool|:)/i.test(outputText);
    const event = fileChangeRecord(step.executionEvent || step.execution_event);
    const nestedEvent = fileChangeRecord(event.item);
    const fileEvent = event.type === 'file_change' ? event : nestedEvent.type === 'file_change' ? nestedEvent : {};
    let eventStatus = fileReceiptStatus(fileEvent);
    if (eventStatus === 'unknown' && fileEvent === nestedEvent && event.type === 'item.completed') eventStatus = 'done';
    if (event.type === 'item.failed') eventStatus = 'error';
    const candidates = [step.fileChanges, step.file_changes, output.fileChanges, output.file_changes, nestedOutput.fileChanges, nestedOutput.file_changes, fileEvent.fileChanges, fileEvent.file_changes, fileEvent.changes];
    let rows = candidates.find(function actualFileRows(value) {
      // 仅从显式回执数组读取，绝不扫描命令文本。 / Read explicit receipt arrays and never scan command text.
      return Array.isArray(value) && value.length > 0;
    });
    if (!rows && fileChangePath(fileEvent.path)) rows = [fileEvent];
    let requested = false; let successfulTool = false;
    if (!rows) {
      const toolName = String(step.toolName || step.tool_name || step.name || step.title || '').toLowerCase();
      const patchTool = ['edit_file_patch_tool', 'edit_file_patch_tool_local'].includes(toolName);
      const writeTool = ['edit_file_tool', 'edit_file_tool_local'].includes(toolName);
      if (!patchTool && !writeTool) return [];
      const target = fileChangePath(input.path);
      if (!target) return [];
      successfulTool = patchTool
        ? /^Patched successfully \((?:Exact match|Normalized line endings match|Fuzzy match: ignored whitespace\/indentation differences)\)\.$/.test(outputText) || /^\[Success\] Patched '.+'\.$/.test(outputText)
        : /^Saved successfully(?: \(Backup created: [^\r\n]+\))?\.$/.test(outputText) || /^\[Success\] Saved [^\r\n]+$/.test(outputText);
      rows = [{ path: target, operation: patchTool ? 'modify' : 'write', before: patchTool ? input.old_string : undefined, after: patchTool ? input.new_string : input.content }];
      requested = true;
    }
    const result = [];
    for (let index = 0; index < Math.min(rows.length, 200); index += 1) {
      const row = fileChangeRecord(rows[index]);
      const path = fileChangePath(row.path || row.filePath || row.file_path);
      const operation = fileChangeOperation(row.operation || row.kind || row.action || row.changeType);
      if (!path || !operation) continue;
      const ownStatus = fileReceiptStatus(row);
      let status = ownStatus !== 'unknown' ? ownStatus : eventStatus !== 'unknown' ? eventStatus : outputStatus !== 'unknown' ? outputStatus : outerStatus;
      if (requested && successfulTool && !['error', 'pending', 'running', 'awaiting_approval', 'cancelled', 'interrupted'].includes(status)) status = 'done';
      if (['error', 'pending', 'running', 'awaiting_approval', 'cancelled', 'interrupted'].includes(outerStatus)) status = outerStatus;
      if (failed || ownStatus === 'error' || eventStatus === 'error') status = 'error';
      const confirmed = status === 'done' && row.confirmed !== false && (!requested || successfulTool);
      if (status === 'done' && !confirmed) status = 'unknown';
      const item = {
        id: boundedText(row.id || `${step.toolCallId || step.id || 'tool'}:file:${index}`, 320), path, operation, status, confirmed,
        contentSource: requested || row.contentSource === 'request' ? 'request' : 'receipt',
        additions: null, deletions: null, truncated: row.truncated === true,
      };
      const previousPath = fileChangePath(row.previousPath || row.oldPath || row.old_path);
      if (previousPath) item.previousPath = previousPath;
      const fields = { diff: row.diff ?? row.unified_diff ?? row.patch, before: row.before ?? row.oldContent ?? row.before_content, after: row.after ?? row.newContent ?? row.after_content };
      for (const [field, text] of Object.entries(fields)) {
        if (typeof text !== 'string') continue;
        const bounded = text.slice(0, 100000).replace(/[\uD800-\uDBFF]$/, '');
        item[field] = bounded;
        if (bounded.length !== text.length) item.truncated = true;
      }
      if (confirmed && item.contentSource === 'receipt') {
        item.additions = fileChangeCount(row.additions ?? row.addedLines ?? row.lines_added);
        item.deletions = fileChangeCount(row.deletions ?? row.deletedLines ?? row.lines_deleted);
        const counts = !item.truncated ? countFileDiffLines(item.diff) : null;
        if (counts) {
          if ((item.additions !== null && item.additions !== counts.additions) || (item.deletions !== null && item.deletions !== counts.deletions)) {
            item.additions = null; item.deletions = null;
          } else {
            item.additions = item.additions ?? counts.additions;
            item.deletions = item.deletions ?? counts.deletions;
          }
        }
      }
      result.push(item);
    }
    if (rows.length > 200 && result.length) result[result.length - 1].truncated = true;
    return result;
  }

  /** 提取活动并保留真实工具与智能体字段。 / Project activity while preserving actual tool and agent fields. */
  function projectMessageActivity(message, options = {}) {
    const source = message && typeof message === 'object' ? message : {};
    const isZh = options.isZh !== false;
    const current = source.activity && typeof source.activity === 'object' ? source.activity : {};
    const log = Array.isArray(current.steps) ? current.steps : Array.isArray(source.activityLog) ? source.activityLog : [];
    const now = nonnegativeNumber(options.now) ?? Date.now();
    const generationFinished = !!source.generationFinished;
    const steps = log.filter(function validStep(step) {
      // 忽略损坏的空记录。 / Ignore malformed empty records.
      return step && typeof step === 'object';
    }).map(function projectStep(step, index) {
      // 依据结构关系识别子智能体，名称不影响分类。 / Identify subagents from structural relations rather than names.
      const status = normalizeActivityStatus(step.status);
      const agentId = boundedText(step.agentId || step.agent_id || '', 180);
      const taskId = boundedText(step.taskId || step.task_id || '', 180);
      const rawKind = String(step.kind || 'status').toLowerCase();
      const kind = agentId || ['subagent', 'sub_agent', 'agent'].includes(rawKind) ? 'subagent' : rawKind;
      const startedAt = nonnegativeNumber(step.startedAt);
      const endedAt = nonnegativeNumber(step.endedAt);
      const updatedAt = nonnegativeNumber(step.updatedAt);
      const running = status === 'running' && !generationFinished;
      const end = running ? now : endedAt ?? updatedAt;
      const elapsed = startedAt !== null && end !== null ? Math.max(0, end - startedAt) : null;
      const projected = {
        id: boundedText(step.id || `activity-${index}`, 220), kind, status,
        label: status === 'unknown' ? getActivityStatusLabel(status, isZh) : boundedText(step.label || getActivityStatusLabel(status, isZh), 80),
        title: boundedText(step.title || (kind === 'subagent' ? (isZh ? '子智能体' : 'Subagent') : kind === 'tool' ? (isZh ? '工具调用' : 'Tool call') : (isZh ? '活动' : 'Activity')), 400),
        detail: formatDetail(step.detail),
        duration: String(step.duration || formatDuration(elapsed, isZh)),
        running, startedAt, endedAt, updatedAt,
      };
      for (const field of ['input', 'output', 'error', 'cmd', 'command', 'toolName', 'toolCallId']) {
        if (step[field] !== undefined && step[field] !== null) projected[field] = step[field];
      }
      if (agentId) projected.agentId = agentId;
      if (taskId) projected.taskId = taskId;
      const transcript = normalizeSubagentTranscript(step.transcript || step.agentTranscript);
      if (transcript.length) projected.transcript = transcript;
      const fileChanges = projectFileChanges(step);
      if (fileChanges.length) projected.fileChanges = fileChanges;
      return projected;
    });
    const hasRunningStep = steps.some(function isRunningStep(step) {
      // 仅运行态产生运行指示。 / Only running steps contribute running indicators.
      return step.running;
    });
    // 明确未结束的回复在工具间隙仍活动，旧历史不能仅凭过时提示复活。 / Explicitly unfinished replies remain active between tools; stale hints cannot revive legacy history.
    const active = !generationFinished && (hasRunningStep || (!!options.active && (!steps.length || source.generationFinished === false)));
    const startedAt = nonnegativeNumber(source.activityStartedAt ?? current.startedAt);
    let endedAt = nonnegativeNumber(source.activityEndedAt ?? current.endedAt);
    if (endedAt === null && !active) {
      const endTimes = steps.map(function readStepEnd(step) {
        // 结束活动不会继续借用墙钟。 / Finished activity never keeps borrowing wall clock time.
        return step.endedAt ?? step.updatedAt;
      }).filter(function knownTime(value) {
        // 保留有效时间戳。 / Retain known timestamps.
        return value !== null;
      });
      if (endTimes.length) endedAt = Math.max(...endTimes);
    }
    const end = active ? now : endedAt;
    const elapsedMs = startedAt !== null && end !== null ? Math.max(0, end - startedAt) : nonnegativeNumber(current.elapsedMs);
    const elapsedLabel = elapsedMs !== null ? formatDuration(elapsedMs, isZh) : String(current.elapsedLabel || '');
    return {
      visible: steps.length > 0 || active, active, elapsedMs, elapsedLabel, steps,
      signature: formatDetail({ active, elapsedLabel, steps }, 2000000),
    };
  }

  /** 排除隐藏推理和工具容器，保留正文代码中的字面标签。 / Exclude hidden reasoning and tool containers while preserving literal tags in visible code. */
  function plainPreview(value, limit = 280, preserveWhitespace = false) {
    const raw = String(value || '');
    const tokens = /```[^\n]*\n[\s\S]*?(?:```|$)|~~~[^\n]*\n[\s\S]*?(?:~~~|$)|`[^`\n]+`|<!--[\s\S]*?(?:-->|$)|<\/?[a-z][a-z0-9-]*(?=[\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
    const stack = [];
    let hiddenCount = 0;
    let offset = 0;
    let result = '';
    for (const match of raw.matchAll(tokens)) {
      if (!hiddenCount) result += raw.slice(offset, match.index);
      const token = match[0];
      offset = match.index + token.length;
      if (!token.startsWith('<')) {
        if (!hiddenCount) result += token;
        continue;
      }
      if (token.startsWith('<!--')) continue;
      const tag = /^<\/?([a-z][a-z0-9-]*)/i.exec(token)?.[1]?.toLowerCase() || '';
      if (token.startsWith('</')) {
        /** 寻找同名关闭标签并丢弃其嵌套状态。 / Locate the matching closing tag and discard its nested state. */
        const index = stack.map((entry) => entry.tag).lastIndexOf(tag);
        if (index >= 0) for (const entry of stack.splice(index)) if (entry.hidden) hiddenCount -= 1;
        if (!hiddenCount && /^(?:p|li|pre|h[1-6]|blockquote|tr)$/.test(tag)) result += ' ';
        continue;
      }
      const classMatch = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(token);
      const classes = String(classMatch?.[1] || classMatch?.[2] || classMatch?.[3] || '').split(/\s+/);
      /** 识别既有工具类，不从正文词语猜测隐藏内容。 / Recognize existing tool classes without inferring hidden content from prose. */
      const hidden = /^(?:think|thought|analysis|reasoning|script|style|template)$/.test(tag)
        || classes.some((name) => /^(?:highlight-block(?:-[\w-]+)?|approval-card)$/.test(name))
        || /\shidden(?:\s|=|\/?>)/i.test(token)
        || /\baria-hidden\s*=\s*["']?true(?:["'\s>])/i.test(token)
        || /\bstyle\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(token);
      const selfClosing = /\/\s*>$/.test(token) || /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag);
      if (!hiddenCount && !hidden && /^(?:br|hr)$/.test(tag)) result += ' ';
      if (!selfClosing) {
        stack.push({ tag, hidden });
        if (hidden) hiddenCount += 1;
      }
    }
    if (!hiddenCount) result += raw.slice(offset);
    return boundedText((preserveWhitespace ? result : result.replace(/\s+/g, ' ')).trim(), limit);
  }

  /** 按用户消息建立稳定导航，附件消息同样可定位。 / Build stable navigation for user turns including attachment-only messages. */
  function buildMessageNavigation(messages, options = {}) {
    if (!Array.isArray(messages)) return [];
    const isZh = options.isZh !== false;
    const seen = new Set();
    const turns = [];
    let current = null;
    let currentMessage = null;
    for (const message of messages) {
      if (!message || typeof message !== 'object') continue;
      if (message.role !== 'user') {
        if (!current || message.role !== 'assistant' || message.hidden === true || /^(?:analysis|reasoning|tool)$/.test(String(message.channel || ''))) continue;
        /** 明确指定不同会话或工作区时不拼接回复。 / Do not attach replies explicitly belonging to another conversation or workspace. */
        const differentScope = ['conversationId', 'workspaceId', 'projectId'].some((field) => {
          const snake = field.replace('Id', '_id');
          const expected = currentMessage[field] ?? currentMessage[snake] ?? currentMessage.scope?.[field];
          const actual = message[field] ?? message[snake] ?? message.scope?.[field];
          return expected != null && expected !== '' && actual != null && actual !== '' && String(expected) !== String(actual);
        });
        if (differentScope) continue;
        const reply = plainPreview(message.text, 280);
        if (reply) current.replyPreview = boundedText([current.replyPreview, reply].filter(Boolean).join(' · '), 280);
        continue;
      }
      current = null;
      currentMessage = null;
      if (!message.id || seen.has(String(message.id))) continue;
      const id = String(message.id);
      seen.add(id);
      const attachmentCount = Array.isArray(message.attachments) ? message.attachments.length : 0;
      const summary = plainPreview(message.text, 140) || (attachmentCount ? (isZh ? `${attachmentCount} 个附件` : `${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'}`) : (isZh ? '空消息' : 'Empty message'));
      current = { id, summary, ordinal: turns.length + 1, replyPreview: '' };
      currentMessage = message;
      turns.push(current);
    }
    return turns;
  }

  /** 检查显式作用域，避免投影混入其他会话。 / Check explicit scope so projections exclude unrelated conversations. */
  function matchesScope(message, scope) {
    for (const field of ['conversationId', 'workspaceId', 'projectId']) {
      const snake = field.replace('Id', '_id');
      const explicit = message[field] ?? message[snake] ?? message.scope?.[field];
      if (explicit !== undefined && explicit !== null && explicit !== '' && String(explicit) !== scope[field]) return false;
    }
    return true;
  }

  /** 创建默认不含正文和调用参数的有界只读投影。 / Create a bounded read-only projection without text or tool payloads by default. */
  function buildConversationProjection(options = {}) {
    const scope = {
      conversationId: boundedText(options.conversationId, 180),
      workspaceId: boundedText(options.workspaceId, 180),
      projectId: boundedText(options.projectId, 180),
    };
    const source = Array.isArray(options.messages) ? options.messages : [];
    const scoped = source.filter(function currentScope(message) {
      // 调用方必须提供当前已授权消息。 / Callers must supply currently authorized messages.
      return message && typeof message === 'object' && matchesScope(message, scope);
    });
    const limit = Math.max(1, Math.min(80, Math.floor(nonnegativeNumber(options.maxMessages) ?? 80)));
    const messages = scoped.slice(-limit).map(function projectMessage(message, index) {
      // 仅逐字段转交元数据，不展开原消息对象。 / Forward allowlisted metadata without spreading original messages.
      const activity = projectMessageActivity(message);
      const identity = normalizeIdentity(message.identity, { fallbackKind: message.role });
      identity.image = safeImageUrl(identity.image, 2048);
      const receipts = normalizeMemoryContext(message.memoryContext).filter(function currentReceipt(receipt) {
        // 回执具有明确会话时必须匹配。 / Explicit receipt conversations must match.
        return !receipt.conversationId || receipt.conversationId === scope.conversationId;
      });
      const projected = {
        id: boundedText(message.id || `${scope.conversationId}:message-${Math.max(0, scoped.length - limit) + index}`, 220),
        role: boundedText(message.role || 'unknown', 40), identity,
        activity: {
          visible: activity.visible, active: activity.active,
          steps: activity.steps.slice(-24).map(function projectStepMetadata(step) {
            // 不转发工具标题、详情或输入输出中的机密参数。 / Exclude sensitive arguments embedded in tool titles or details.
            const row = { id: step.id, kind: step.kind, status: step.status, label: getActivityStatusLabel(step.status), title: step.kind === 'subagent' ? 'Subagent' : step.kind === 'tool' ? 'Tool call' : 'Activity', duration: boundedText(step.duration, 40) };
            if (step.agentId) row.agentId = step.agentId;
            if (step.taskId) row.taskId = step.taskId;
            return row;
          }),
        },
        attachmentCount: Array.isArray(message.attachments) ? message.attachments.length : 0,
        memory: { receiptCount: receipts.length, statuses: [...new Set(receipts.map(function receiptStatus(receipt) {
          // 仅共享回执状态，不共享来源详情。 / Share receipt statuses without source details.
          return boundedText(receipt.status, 80);
        }))].slice(0, 16) },
      };
      if (options.includeTextPreview === true) projected.textPreview = plainPreview(message.text, 280);
      return projected;
    });
    return { schemaVersion: '1.0.0', scope, messages, truncated: scoped.length > messages.length };
  }

  return Object.freeze({
    classifyConnectionFailure, connectionFeedbackMessage,
    normalizeActivityStatus, getActivityStatusLabel, normalizeIdentity, normalizeMemoryContext,
    projectMessageActivity, projectFileChanges, agentGlyph, normalizeSubagentTranscript, buildConversationProjection, buildMessageNavigation, formatDetail, safeImageUrl,
  });
});
