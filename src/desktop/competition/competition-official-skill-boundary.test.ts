import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  CompetitionOfficialSkillError,
  CompetitionPaiEasOfficialSkillBoundary,
  type CompetitionPaiEasReadOnlyInvocation,
} from "./competition-official-skill-boundary";

const assetDirectory = path.resolve(".agent", "skills", "alibabacloud-pai-eas-service-diagnose");

test("PAI EAS official Skill verifies its pinned read-only supply chain", async () => {
  const boundary = new CompetitionPaiEasOfficialSkillBoundary({ assetDirectory });
  const snapshot = await boundary.inspect();
  assert.equal(snapshot.skillId, "alibabacloud-pai-eas-service-diagnose");
  assert.equal(snapshot.supplyChainVerified, true);
  assert.equal(snapshot.executionStatus, "NOT_CONFIGURED");
  assert.equal(snapshot.allowMutation, false);
  assert.equal(snapshot.allowCredentialReadback, false);
  assert.equal(snapshot.allowedOperations.every((operation) => /^(?:Describe|List)/u.test(operation)), true);
  await assert.rejects(
    boundary.diagnose({ region: "cn-hangzhou", serviceName: "recommendation-service" }),
    (error) => error instanceof CompetitionOfficialSkillError && error.code === "OFFICIAL_SKILL_NOT_CONFIGURED",
  );
});

test("PAI EAS official Skill reuses one session identity and denies mutation operations", async () => {
  const invocations: CompetitionPaiEasReadOnlyInvocation[] = [];
  const boundary = new CompetitionPaiEasOfficialSkillBoundary({
    assetDirectory,
    invokeReadOnly: async (request) => {
      invocations.push(request);
      return { status: "Running" };
    },
  });
  const result = await boundary.diagnose({
    region: "cn-hangzhou",
    serviceName: "recommendation-service",
    operations: ["DescribeService", "DescribeServiceEvent", "DescribeServiceDiagnosis"],
  });
  assert.match(result.sessionId, /^[a-f0-9]{32}$/u);
  assert.equal(result.observations.length, 3);
  assert.equal(new Set(invocations.map((item) => item.userAgent)).size, 1);
  assert.equal(String(invocations[0]?.userAgent).endsWith(result.sessionId), true);
  await assert.rejects(
    boundary.diagnose({
      region: "cn-hangzhou",
      serviceName: "recommendation-service",
      operations: ["ScaleService"],
    }),
    (error) => error instanceof CompetitionOfficialSkillError && error.code === "OFFICIAL_SKILL_OPERATION_DENIED",
  );
});
