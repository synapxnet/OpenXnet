#!/usr/bin/env node
/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 上游同步后的生命周期恢复 / Lifecycle restoration after upstream synchronization.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-15
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const FILES = ["lifecycle-worker.sh", "worker-lifecycle-cli.js", "worker-activity-store.js", "worker-activity-client.js", "contracts.js"];

/** 使用固定代码报告启动恢复失败。 / Report startup restoration failure with a fixed code. */
function fail(code) { const error = new Error(code); error.code = code; throw error; }

/** 在写入前阻止路径本身或其已有父目录为符号链接。 / Block a symbolic link at the path or any existing parent before writing. */
function assertOrdinaryPath(target, requireFile = false, expectedKind = null) {
  let current = path.resolve(target);
  while (true) {
    let info;
    try { info = fs.lstatSync(current); } catch (error) { if (error.code !== "ENOENT" || (current === path.resolve(target) && requireFile)) fail("LIFECYCLE_BOOTSTRAP_SOURCE_MISSING"); }
    if (info?.isSymbolicLink()) fail("LIFECYCLE_BOOTSTRAP_SYMLINK");
    if (current === path.resolve(target) && requireFile && !info?.isFile()) fail("LIFECYCLE_BOOTSTRAP_SOURCE_INVALID");
    if (current === path.resolve(target) && info && ((expectedKind === "file" && !info.isFile()) || (expectedKind === "directory" && !info.isDirectory()))) fail("LIFECYCLE_BOOTSTRAP_TARGET_INVALID");
    const parent = path.dirname(current); if (parent === current) break; current = parent;
  }
}

/** 只恢复五个生命周期文件，先检查全部来源和目标再写入。 / Restore only five lifecycle files after validating all sources and destinations before writing. */
function restoreLifecycleScripts(options = {}) {
  const sourceRoot = path.resolve(options.sourceRoot || "/opt/agentteams/agent/skills/worker-management/scripts");
  const destinations = (options.destinations || ["/root/manager-workspace/skills/worker-management/scripts", "/root/manager-workspace/.copaw/workspaces/default/active_skills/worker-management/scripts"]).map(/** 固定绝对目标目录。 / Resolve absolute target directories. */ directory => path.resolve(directory));
  if (!destinations.length || new Set(destinations).size !== destinations.length || destinations.includes(sourceRoot)) fail("LIFECYCLE_BOOTSTRAP_TARGET_INVALID");
  const sources = FILES.map(/** 在任何目标写入前读取全部已校验来源。 / Read every validated source before any destination write. */ name => {
    const source = path.join(sourceRoot, name); assertOrdinaryPath(source, true);
    const data = fs.readFileSync(source); if (!data.length || data.length > 512 * 1024) fail("LIFECYCLE_BOOTSTRAP_SOURCE_INVALID");
    return { name, source, data, sha256: createHash("sha256").update(data).digest("hex") };
  });
  for (const directory of destinations) { assertOrdinaryPath(directory, false, "directory"); for (const name of FILES) assertOrdinaryPath(path.join(directory, name), false, "file"); }
  for (const directory of destinations) fs.mkdirSync(directory, { recursive: true, mode: 0o755 });
  const files = [];
  for (const entry of sources) {
    const targets = [];
    for (const directory of destinations) {
      const target = path.join(directory, entry.name); const temporary = `${target}.${randomUUID()}.tmp`;
      const descriptor = fs.openSync(temporary, "wx", entry.name.endsWith(".sh") ? 0o555 : 0o444);
      try { fs.writeFileSync(descriptor, entry.data); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
      fs.renameSync(temporary, target); targets.push(target);
    }
    files.push({ source: entry.source, targets, sha256: entry.sha256 });
  }
  return { status: "RESTORED", files };
}

if (require.main === module) {
  try { console.log(JSON.stringify(restoreLifecycleScripts())); }
  catch (error) { console.error(JSON.stringify({ code: error.code || "LIFECYCLE_BOOTSTRAP_FAILED" })); process.exitCode = 1; }
}
module.exports = { restoreLifecycleScripts };
