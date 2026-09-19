#!/usr/bin/env node
// Copyright (C) 2026 Synapxnet. All rights reserved.
// This file is Synapxnet Proprietary and Confidential. It is strictly
// forbidden to copy, distribute, or use without explicit authorization.
/**
 * 读取安装包真实计划与质量门 / Read the installed plan and actual quality gates.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-18 | Version: 1.3.0
 * Security Level: INTERNAL | Maintainer: maoyo | Email: synapxnet@gmail.com
 */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const asar = require('@electron/asar');
const ts = require('typescript');
const archive = process.env.OPENXNET_CONTRACT_ASAR || 'E:/Test/OpenXnet/resources/app.asar';
const cache = new Map();

/** 仅从已安装归档读取内部模块 / Read internal modules only from the installed archive. */
function content(file) { return asar.extractFile(archive, path.win32.normalize(file)).toString('utf8'); }

/** 加载固定本地归档模块，不连接应用进程 / Load fixed local archive modules without connecting to the app process. */
function load(file) {
  file = path.posix.normalize(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const text = content(file);
  /** 只解析当前归档内的相对依赖 / Resolve only relative dependencies within this archive. */
  const localRequire = name => {
    if (!name.startsWith('.')) return require(name);
    return load(path.posix.join(path.posix.dirname(file), name) + '.js');
  };
  vm.runInThisContext('(function(require,module,exports){' + text + '\n})', { filename: file })(localRequire, module, module.exports);
  return module.exports;
}

const source = content('build-ts/desktop/competition/application-competition-runtime.js');
const ast = ts.createSourceFile('installed-runtime.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let initializer;
const methods = {};

/** 查找实际场景常量与判定方法 / Find the actual scenario constant and decision methods. */
function inspect(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'ENTERPRISE_TASK_SCENARIOS') initializer = node.initializer.getText(ast);
  if (ts.isMethodDeclaration(node) && ['assertVerificationPassed', 'assertExecutionGatePassed'].includes(node.name.getText(ast))) methods[node.name.getText(ast)] = node;
  ts.forEachChild(node, inspect);
}
inspect(ast);
if (!initializer || !methods.assertVerificationPassed || !methods.assertExecutionGatePassed) throw new Error('Installed contract was not found');
const scenario = vm.runInNewContext(initializer)['feature-drift'].scenario;
const profile = load('build-ts/desktop/competition/competition-scenario-registry.js').getCompetitionScenarioProfile(scenario);
const mode = process.argv[2];
const input = ['check', 'bind'].includes(mode) ? JSON.parse(fs.readFileSync(0, 'utf8')) : null;
if (mode === 'bind') {
  // 使用安装版真实调查聚合与版本绑定，覆盖 Live 计划冻结路径。
  // Use the installed investigation collector and binder to cover the Live plan-freezing path.
  const versions = load('build-ts/desktop/competition/competition-resource-versions.js').collectCompetitionResourceVersions(input.evidence);
  const governedScenario = { ...scenario, governedResourceVersions: versions };
  const governedProfile = load('build-ts/desktop/competition/competition-scenario-registry.js').getCompetitionScenarioProfile(governedScenario);
  process.stdout.write(JSON.stringify({ archive, archiveSha256: crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'), scenario: governedScenario, profile: governedProfile }));
} else if (input) {
  const name = input.kind === 'gate' ? 'assertExecutionGatePassed' : 'assertVerificationPassed';
  const node = methods[name];
  const parameters = node.parameters.map(parameter => parameter.name.getText(ast)).join(',');
  class ApplicationCompetitionRuntimeError extends Error {
    /** 保留安装版错误代码 / Preserve the installed error code. */
    constructor(code, message) { super(message); this.code = code; }
  }
  const run = vm.runInNewContext('(function(' + parameters + ')' + node.body.getText(ast) + ')', { ApplicationCompetitionRuntimeError });
  try {
    if (input.kind === 'gate') run(input.step, { data: input.data });
    else run(input.results, { scenario });
    process.stdout.write(JSON.stringify({ passed: true }));
  } catch (error) { process.stdout.write(JSON.stringify({ passed: false, code: error.code, error: error.message })); }
} else {
  process.stdout.write(JSON.stringify({ archive, archiveSha256: crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'), scenario, profile }));
}
