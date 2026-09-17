// -*- coding: utf-8 -*-
// Copyright (C) 2026 Synapxnet. All rights reserved.
// This file is Synapxnet Proprietary and Confidential. It is strictly
// forbidden to copy, distribute, or use without explicit authorization.
// 驻场服务契约构建 / Resident service contract build
// Author: maoyo
// Department: 研发部
// Date: 2026-09-16
// Version: 1.3.0
// Security Level: INTERNAL
// __version__ = "1.3.0"; __author__ = "maoyo"; __copyright__ = "Copyright 2026 Synapxnet"
// __maintainer__ = "maoyo"; __email__ = "synapxnet@gmail.com"
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertCompetitionWriteVersion = assertCompetitionWriteVersion;
exports.collectCompetitionResourceVersions = collectCompetitionResourceVersions;
exports.bindCompetitionResourceVersions = bindCompetitionResourceVersions;
const competition_tool_registry_1 = require("./competition-tool-registry");
/** 拒绝非法或无法安全推进的版本文本。 / Reject malformed version text or unsafe progression. */
function versionNumber(value) {
    if (typeof value !== "string" || !/^[1-9][0-9]{0,15}$/u.test(value)) {
        throw new TypeError("Resource version must be a positive integer string.");
    }
    const numeric = Number(value);
    if (!Number.isSafeInteger(numeric) || numeric > Number.MAX_SAFE_INTEGER - 1024) {
        throw new TypeError("Resource version exceeds the safe plan budget.");
    }
    return numeric;
}
/** 写回执必须确认批准基线的一次推进，不能倒退或跳版。 / A write receipt must confirm exactly one transition from the approved baseline without regression or jumps. */
function assertCompetitionWriteVersion(expected, actual) {
    if (actual !== String(versionNumber(expected) + 1)) {
        throw new TypeError("Write response version does not match the approved transition.");
    }
}
/** 从已完成的本轮调查响应聚合版本；平台身份来自实际工具描述符。 / Collect current completed investigation versions using the actual tool descriptor's platform. */
function collectCompetitionResourceVersions(results) {
    const versions = {};
    let entries = 0;
    for (const result of results) {
        const descriptor = (0, competition_tool_registry_1.getCompetitionToolDescriptor)(result.toolName);
        const raw = result.response.data?.resourceVersions;
        if (raw === undefined)
            continue;
        if (!result.response.success || raw === null || typeof raw !== "object" || Array.isArray(raw)) {
            throw new TypeError("Resource version evidence is invalid.");
        }
        const platformVersions = versions[descriptor.platform] ??= Object.create(null);
        for (const [resourceId, value] of Object.entries(raw)) {
            entries += 1;
            if (entries > 512 || resourceId.length > 512 || !/^[a-zA-Z0-9][a-zA-Z0-9_./:-]*$/u.test(resourceId)
                || ["constructor", "prototype", "__proto__"].includes(resourceId)) {
                throw new TypeError("Resource version scope is invalid.");
            }
            versionNumber(value);
            if (Object.hasOwn(platformVersions, resourceId) && platformVersions[resourceId] !== value) {
                throw new TypeError("Current investigation contains conflicting resource versions.");
            }
            platformVersions[resourceId] = value;
        }
    }
    return versions;
}
/** 用每个目标的真实基线与前序写次数生成固定计划，不消耗只读门版本。 / Build a fixed plan from each target's actual baseline and preceding writes; read gates do not advance versions. */
function bindCompetitionResourceVersions(profile, versions) {
    if (versions === undefined)
        return profile;
    const writes = new Map();
    /** 固定单步目标版本，并仅在写操作后推进该平台目标。 / Fix one step's target version and advance only that platform target after writes. */
    const bindStep = (step) => {
        const platform = (0, competition_tool_registry_1.getCompetitionToolDescriptor)(step.toolName).platform;
        const platformVersions = versions[platform];
        if (platformVersions === undefined || !Object.hasOwn(platformVersions, step.resourceId)) {
            throw new TypeError(`Current investigation is missing a required ${platform} resource version.`);
        }
        const base = versionNumber(platformVersions[step.resourceId]);
        const key = JSON.stringify([platform, step.resourceId]);
        const count = writes.get(key) ?? 0;
        const bound = { ...step, expectedResourceVersion: String(base + count) };
        if (step.kind === "WRITE")
            writes.set(key, count + 1);
        return bound;
    };
    const steps = profile.executionPlan.steps.map(bindStep);
    const compensationSteps = profile.executionPlan.compensationSteps.map(bindStep);
    return { ...profile, executionPlan: { ...profile.executionPlan, steps, compensationSteps } };
}
//# sourceMappingURL=competition-resource-versions.js.map