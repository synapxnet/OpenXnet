#!/usr/bin/env node
/*
 * -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 内置 npm 安装资源验收 / Bundled npm installation-resource acceptance.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-16
 * Version: 1.3.0 | Security Level: INTERNAL
 * __version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const { execFile } = require("node:child_process");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const test = require("node:test");
const { getFileMatchers, copyFiles } = require("app-builder-lib/out/fileMatcher");

const ROOT = path.resolve(__dirname, "..");
const PACKAGE = require("../package.json");
const executeFile = promisify(execFile);

/** 读取 npm 子树的相对文件路径，不执行来源代码。 / Read relative npm subtree file paths without executing source code. */
async function listFiles(directory) {
  const result = [];
  const pending = [directory];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of await fsp.readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(absolute);
      else result.push(path.relative(directory, absolute));
    }
  }
  return result.sort();
}

/** 使用当前正式发行配置生成真实 npm 资源匹配器。 / Generate real npm resource matchers from the current release configuration. */
function npmMatchers(destination) {
  const config = structuredClone(PACKAGE.build);
  const matchers = getFileMatchers(config, "extraResources", destination, {
    macroExpander: /** 本测试不改变任何发行宏。 / Keep release macros unchanged in this test. */ value => value,
    customBuildOptions: config.win,
    globalOutDir: path.join(ROOT, config.directories.output),
    defaultSrc: ROOT,
  });
  return matchers.filter(/** 仅生成 npm 两层资源，避免触碰后端和 Memory。 / Generate only npm resource layers without touching backend or Memory. */ matcher => {
    const source = path.relative(ROOT, matcher.from).replaceAll("\\", "/");
    return source === "node_modules/npm" || source === "node_modules/npm/node_modules";
  });
}

test("packaged npm resource mappings retain their complete dependency tree and run independently", { timeout: 60_000 }, /** 验收实际生成资源的依赖完整性与启动，不从源码目录借用模块。 / Verify generated-resource completeness and startup without borrowing source modules. */ async () => {
  const tempRoot = path.resolve(os.tmpdir());
  const temporary = await fsp.mkdtemp(path.join(tempRoot, "openxnet-packaged-npm-"));
  assert.equal(path.dirname(temporary), tempRoot);
  try {
    const resources = path.join(temporary, "resources");
    const matchers = npmMatchers(resources);
    assert.equal(matchers.length, 2, "Both npm source and its dedicated dependency mapping are required");
    const rootMatcher = matchers.find(/** 获取 npm 根来源匹配器。 / Get the npm root-source matcher. */ matcher => matcher.from === path.join(ROOT, "node_modules", "npm"));
    const nested = path.join(ROOT, "node_modules", "npm", "node_modules");
    assert.equal(rootMatcher.createFilter()(nested, fs.lstatSync(nested)), false,
      "The builder excludes root-level node_modules, so one mapping is insufficient");

    await copyFiles(matchers, null, false);
    const copiedNpm = path.join(resources, "npm");
    const copiedDependencies = path.join(copiedNpm, "node_modules");
    assert.deepEqual(await listFiles(copiedDependencies), await listFiles(nested),
      "Every dependency file, including nested packages and licenses, must survive actual builder copying");
    const copiedRequire = createRequire(path.join(copiedNpm, "lib", "cli", "entry.js"));
    for (const dependency of ["graceful-fs", "semver/functions/satisfies", "proc-log"]) {
      const resolved = await fsp.realpath(copiedRequire.resolve(dependency));
      const relative = path.relative(copiedDependencies, resolved);
      assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative),
        `${dependency} must resolve inside generated npm resources`);
    }

    const emptyConfig = path.join(temporary, "empty.npmrc");
    await fsp.writeFile(emptyConfig, "", "utf8");
    const environment = {
      PATH: path.dirname(process.execPath),
      NPM_CONFIG_USERCONFIG: emptyConfig,
      NPM_CONFIG_GLOBALCONFIG: path.join(temporary, "global.npmrc"),
      NPM_CONFIG_CACHE: path.join(temporary, "cache"),
      NPM_CONFIG_UPDATE_NOTIFIER: "false",
      NPM_CONFIG_AUDIT: "false",
      NPM_CONFIG_FUND: "false",
      NODE_DISABLE_COMPILE_CACHE: "1",
      TEMP: temporary,
      TMP: temporary,
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    };
    const { stdout } = await executeFile(process.execPath, [path.join(copiedNpm, "bin", "npm-cli.js"), "--version"], {
      cwd: temporary, env: environment, timeout: 20_000, windowsHide: true, maxBuffer: 64 * 1024,
    });
    assert.equal(stdout.trim(), JSON.parse(await fsp.readFile(path.join(copiedNpm, "package.json"), "utf8")).version);
  } finally {
    assert.equal(path.dirname(temporary), tempRoot, "Cleanup stays within this test's temporary parent");
    await fsp.rm(temporary, { recursive: true, force: true });
  }
});
