/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * Skill 认证只读对接 / Read-only Skill certification integration.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { lstat, readFile } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";

/** 外部认证摘要与当前两文件制品摘要。 / External certification digest and current two-file artifact digest. */
export interface CompetitionSkillCertificationBinding {
  readonly environmentFingerprint: string;
  readonly artifactDigest: string;
  readonly currentArtifactDigest: string;
}

/** 共用只读制品解析输入，不包含凭据。 / Shared read-only artifact resolver input without credentials. */
export interface CompetitionSkillCertificationInput {
  readonly skillsDirectory: string;
  readonly skillId: string;
  readonly sourceIncidentId: string | null;
  readonly receiptPath: string | undefined;
}

type Platform = "aiops" | "dataops" | "mlops";

/** 当前平台环境解析依赖，与 Skill 自身认证分离。 / Current platform environment dependencies, separate from a Skill's own certification. */
export interface CompetitionEnvironmentFingerprintInput {
  readonly fingerprint: string | undefined;
  readonly expectedEndpoints: Readonly<Record<Platform, string | undefined>>;
  readonly resolveEndpoint: (platform: Platform) => Promise<string>;
  readonly resolveAddresses?: (hostname: string) => Promise<readonly string[]>;
}

/** 判断普通 JSON 对象。 / Narrow an unknown JSON value to a plain record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** 读取有界普通文件并拒绝路径链接。 / Read a bounded regular file and reject symlink ancestors. */
async function readArtifactBytes(filename: string): Promise<Buffer> {
  let current = path.resolve(filename);
  while (true) {
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error("Skill certification path is a symbolic link.");
    if (current === path.resolve(filename) && (!info.isFile() || info.size > 1024 * 1024)) {
      throw new Error("Skill certification file is invalid.");
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return readFile(filename);
}

/** 从外部回执绑定实际字节；缺失或不一致时返回 null，不创建任何文件。 / Bind actual bytes to an external receipt; return null for missing or inconsistent proof without writing files. */
export async function readCompetitionSkillCertification(
  input: CompetitionSkillCertificationInput,
): Promise<CompetitionSkillCertificationBinding | null> {
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(input.skillId) || !input.sourceIncidentId?.trim()
    || !input.receiptPath || !path.isAbsolute(input.receiptPath) || !path.isAbsolute(input.skillsDirectory)) return null;
  try {
    const directory = path.join(input.skillsDirectory, input.skillId);
    const [markdown, manifestBytes, receiptBytes] = await Promise.all([
      readArtifactBytes(path.join(directory, "SKILL.md")),
      readArtifactBytes(path.join(directory, "openxnet.skill.json")),
      readArtifactBytes(input.receiptPath),
    ]);
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const manifest: unknown = JSON.parse(decoder.decode(manifestBytes));
    const receipt: unknown = JSON.parse(decoder.decode(receiptBytes));
    if (!isRecord(manifest) || !isRecord(receipt) || manifest.schema !== "openxnet.skill-engineering.v2"
      || manifest.skill_id !== input.skillId || receipt.schema !== "openxnet.skill-certification-receipt.v1"
      || !Array.isArray(receipt.certifications) || !Array.isArray(manifest.certifications)) return null;
    const records = receipt.certifications.filter((item: unknown) => isRecord(item)
      && item.skillId === input.skillId && item.sourceIncidentId === input.sourceIncidentId);
    if (records.length !== 1 || !isRecord(records[0])) return null;
    const certification = records[0];
    if (typeof certification.environmentFingerprint !== "string" || !certification.environmentFingerprint.trim()
      || typeof certification.artifactDigest !== "string" || !/^[a-f0-9]{64}$/u.test(certification.artifactDigest)
      || !["verified", "active"].includes(String(certification.lifecycleStatus))
      || manifest.lifecycle_status !== certification.lifecycleStatus
      || manifest.environment_scope !== certification.environmentScope
      || manifest.environment_fingerprint !== certification.environmentFingerprint
      || !manifest.certifications.some((item: unknown) => isRecord(item)
        && ["verified", "active"].includes(String(item.status))
        && item.scope === certification.environmentScope
        && item.environment_fingerprint === certification.environmentFingerprint
        && Array.isArray(item.evidence_event_ids) && item.evidence_event_ids.includes(input.sourceIncidentId))) return null;
    const currentArtifactDigest = createHash("sha256").update(markdown).update(Buffer.from([0])).update(manifestBytes).digest("hex");
    return { environmentFingerprint: certification.environmentFingerprint, artifactDigest: certification.artifactDigest, currentArtifactDigest };
  } catch {
    return null;
  }
}

/** 在有限时间内读取 DNS 地址，不关闭 TLS 或重写目标 URL。 / Resolve DNS within a bounded time without disabling TLS or rewriting URLs. */
async function resolvePlatformAddresses(hostname: string): Promise<readonly string[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      lookup(hostname, { all: true }).then((records) => records.map((record) => record.address)),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("Environment address lookup timed out.")), 3000); }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** 从显式指纹、当前 HTTPS 配置和解析地址确认环境，不从 Skill 倒推环境。 / Confirm the environment from explicit fingerprint, current HTTPS configuration, and resolved addresses rather than the Skill itself. */
export async function resolveCompetitionEnvironmentFingerprint(
  input: CompetitionEnvironmentFingerprintInput,
): Promise<string | null> {
  const match = /^goai-staging@([a-zA-Z0-9.-]+):agentteams-v\d+\.\d+\.\d+$/u.exec(input.fingerprint ?? "");
  const address = match?.[1];
  if (!address || isIP(address) === 0) return null;
  try {
    const statuses = await Promise.all((["aiops", "dataops", "mlops"] as const).map(async (platform) => {
      const expected = new URL(input.expectedEndpoints[platform] ?? "");
      const actual = new URL(await input.resolveEndpoint(platform));
      if (actual.protocol !== "https:" || actual.username || actual.password || actual.search || actual.hash || actual.href !== expected.href) return false;
      const addresses = await (input.resolveAddresses ?? resolvePlatformAddresses)(actual.hostname);
      return addresses.length > 0 && addresses.every((value) => value === address);
    }));
    return statuses.every(Boolean) ? input.fingerprint! : null;
  } catch {
    return null;
  }
}
