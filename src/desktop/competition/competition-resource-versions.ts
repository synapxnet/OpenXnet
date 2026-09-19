// Copyright (C) 2026 Synapxnet. All rights reserved.
// This file is Synapxnet Proprietary and Confidential. It is strictly
// forbidden to copy, distribute, or use without explicit authorization.
/**
 * 逐资源证据与计划版本绑定 / Bind per-resource evidence to plan versions.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-15 | Version: 1.0.0
 * Security Level: INTERNAL | Maintainer: maoyo | Email: synapxnet@gmail.com
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 */
import type { ApplicationCompetitionResourceVersions } from "../contracts/application-competition-runtime";
import type { CompetitionScenarioExecutionStep, CompetitionScenarioProfile } from "./competition-scenario-registry";
import type { CompetitionToolAdapterResponse } from "./competition-tool-adapter";
import { getCompetitionToolDescriptor, type CompetitionToolName } from "./competition-tool-registry";

/** 拒绝非法或无法安全推进的版本文本。 / Reject malformed version text or unsafe progression. */
function versionNumber(value: unknown): number {
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
export function assertCompetitionWriteVersion(expected: string, actual: unknown): void {
  if (actual !== String(versionNumber(expected) + 1)) {
    throw new TypeError("Write response version does not match the approved transition.");
  }
}

/** 从已完成的本轮调查响应聚合版本；平台身份来自实际工具描述符。 / Collect current completed investigation versions using the actual tool descriptor's platform. */
export function collectCompetitionResourceVersions(
  results: readonly { readonly toolName: CompetitionToolName; readonly response: CompetitionToolAdapterResponse }[],
): ApplicationCompetitionResourceVersions {
  const versions: Partial<Record<"aiops" | "dataops" | "mlops", Record<string, string>>> = {};
  let entries = 0;
  for (const result of results) {
    const descriptor = getCompetitionToolDescriptor(result.toolName);
    const raw = result.response.data?.resourceVersions;
    if (raw === undefined) continue;
    if (!result.response.success || raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new TypeError("Resource version evidence is invalid.");
    }
    const platformVersions = versions[descriptor.platform] ??= Object.create(null) as Record<string, string>;
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
      platformVersions[resourceId] = value as string;
    }
  }
  return versions;
}

/** 用每个目标的真实基线与前序写次数生成固定计划，不消耗只读门版本。 / Build a fixed plan from each target's actual baseline and preceding writes; read gates do not advance versions. */
export function bindCompetitionResourceVersions(
  profile: CompetitionScenarioProfile,
  versions: ApplicationCompetitionResourceVersions | undefined,
): CompetitionScenarioProfile {
  if (versions === undefined) return profile;
  const writes = new Map<string, number>();
  /** 固定单步目标版本，并仅在写操作后推进该平台目标。 / Fix one step's target version and advance only that platform target after writes. */
  const bindStep = (step: CompetitionScenarioExecutionStep): CompetitionScenarioExecutionStep => {
    const platform = getCompetitionToolDescriptor(step.toolName).platform;
    const platformVersions = versions[platform];
    if (platformVersions === undefined || !Object.hasOwn(platformVersions, step.resourceId)) {
      throw new TypeError(`Current investigation is missing a required ${platform} resource version.`);
    }
    const base = versionNumber(platformVersions[step.resourceId]);
    const key = JSON.stringify([platform, step.resourceId]);
    const count = writes.get(key) ?? 0;
    const bound = { ...step, expectedResourceVersion: String(base + count) };
    if (step.kind === "WRITE") {
      writes.set(key, count + 1);
      // 灰度和提升同时推进父部署；补偿须绑定发布后的真实版本。
      // Canary and promotion also advance the parent deployment; compensation binds its post-release version.
      if (step.toolName === "mlops.deployment.canary.apply" || step.toolName === "mlops.deployment.promote") {
        const deploymentUid = step.arguments.deploymentUid;
        if (typeof deploymentUid !== "string" || step.resourceId !== `${deploymentUid}/traffic`
          || !Object.hasOwn(platformVersions, deploymentUid)) {
          throw new TypeError("Deployment traffic writes require matching parent resource version evidence.");
        }
        versionNumber(platformVersions[deploymentUid]);
        const parentKey = JSON.stringify([platform, deploymentUid]);
        writes.set(parentKey, (writes.get(parentKey) ?? 0) + 1);
      }
    }
    return bound;
  };
  const steps = profile.executionPlan.steps.map(bindStep);
  const compensationSteps = profile.executionPlan.compensationSteps.map(bindStep);
  return { ...profile, executionPlan: { ...profile.executionPlan, steps, compensationSteps } };
}
