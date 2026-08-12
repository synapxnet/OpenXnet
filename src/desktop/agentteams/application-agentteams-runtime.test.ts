import assert from "node:assert/strict";
import test from "node:test";

import type { CapabilitySnapshot, CapabilityState } from "../contracts/capability";
import { ApplicationAgentTeamsRuntimeService } from "./application-agentteams-runtime";

/** 记录 AgentTeams capability 激活的 Core 测试替身。 */
class TestCore {
  public state: CapabilityState = "stopped";
  public ensureCount = 0;

  /** 返回当前 AgentTeams 快照；无输入，返回固定对象。 */
  public getCapability(): CapabilitySnapshot {
    return {
      id: "agentteams",
      displayName: "AgentTeams",
      runtime: "python",
      optional: true,
      dependencies: ["core"],
      state: this.state,
      changedAt: new Date(0).toISOString(),
    };
  }

  /** 记录激活并返回 ready 快照；无输入，返回 Promise。 */
  public async ensureCapability(): Promise<CapabilitySnapshot> {
    this.ensureCount += 1;
    this.state = "ready";
    return this.getCapability();
  }
}

/** 记录 AgentTeams Worker 请求并返回确定性载荷。 */
class TestSupervisor {
  public readonly requests: Array<{ method: string; payload: Readonly<Record<string, unknown>> }> = [];

  /** 记录请求；输入 capability、方法和载荷，返回匹配的安全结果。 */
  public async request(
    _capability: "agentteams",
    method: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<Record<string, unknown>>> {
    this.requests.push({ method, payload });
    if (method === "agentteams.status") {
      return {
        schema: "openxnet.agentteams.status.v1",
        cli_available: true,
        controller_reachable: true,
        controller_version: "v1.2.0",
        kube_mode: "embedded",
        total_workers: 3,
        total_teams: 1,
        total_humans: 1,
        error_code: null,
        retryable: false,
      };
    }
    return {
      schema: "openxnet.agentteams.team.v1",
      operation: method.endsWith("apply") ? "apply" : "get",
      success: true,
      workspace_id: "workspace-goai",
      team_name: "goai-incident-team",
      phase: "Active",
      leader_name: "incident-leader",
      ready_workers: 2,
      total_workers: 2,
      team_room_id: "!team:agentteams.local",
      leader_dm_room_id: "!leader:agentteams.local",
      worker_names: ["diagnosis-worker", "verification-worker"],
      message: "",
      error_code: null,
      retryable: false,
    };
  }
}

/** 创建合法的三成员 Team 请求；无输入，返回测试对象。 */
function createRequest(): Record<string, unknown> {
  return {
    workspaceId: "workspace-goai",
    team: {
      name: "goai-incident-team",
      description: "AI 推理服务异常处置团队",
      heartbeatEvery: "30m",
      members: [
        {
          name: "incident-leader",
          role: "team_leader",
          model: "qwen3.5-plus",
          runtime: "copaw",
          identity: "事件指挥 Agent",
          instructions: "拆解任务并汇总证据。",
          skills: ["incident.normalize"],
        },
        {
          name: "diagnosis-worker",
          role: "worker",
          model: "qwen3.5-plus",
          runtime: "copaw",
          identity: "诊断分析 Agent",
          instructions: "收集证据并分析根因。",
          skills: ["evidence.collect"],
        },
        {
          name: "verification-worker",
          role: "worker",
          model: "qwen3.5-plus",
          runtime: "copaw",
          identity: "验证审计 Agent",
          instructions: "独立验证恢复结果。",
          skills: ["service.verify"],
        },
      ],
    },
  };
}

test("AgentTeams status activates only an available optional Worker", async () => {
  const core = new TestCore();
  const supervisor = new TestSupervisor();
  const service = new ApplicationAgentTeamsRuntimeService({ core, supervisor });
  const result = await service.status();

  assert.equal(result.state, "ready");
  assert.equal(result.controllerVersion, "v1.2.0");
  assert.equal(core.ensureCount, 1);
  assert.equal(supervisor.requests[0]?.method, "agentteams.status");
});

test("AgentTeams apply validates metadata and sends no command or credential fields", async () => {
  const core = new TestCore();
  const supervisor = new TestSupervisor();
  const service = new ApplicationAgentTeamsRuntimeService({ core, supervisor });
  const result = await service.applyTeam(createRequest());

  assert.equal(result.success, true);
  assert.equal(result.phase, "Active");
  assert.equal(supervisor.requests[0]?.method, "agentteams.team.apply");
  assert.doesNotMatch(JSON.stringify(supervisor.requests[0]), /command|token|credential|environment|path/i);
  await assert.rejects(
    service.applyTeam({ ...createRequest(), command: "curl" }),
    /fields/i,
  );
});

test("AgentTeams unavailable status does not start a missing Feature Pack", async () => {
  const core = new TestCore();
  core.state = "unavailable";
  const supervisor = new TestSupervisor();
  const service = new ApplicationAgentTeamsRuntimeService({ core, supervisor });
  const result = await service.status();

  assert.equal(result.state, "unavailable");
  assert.equal(core.ensureCount, 0);
  assert.deepEqual(supervisor.requests, []);
});
