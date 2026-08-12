# -*- coding: utf-8 -*-
"""Desktop Kernel Runtime 使用的私有 Execution Engine dispatcher。"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Type

from fastapi import APIRouter, FastAPI, HTTPException
from pydantic import BaseModel, Field, ValidationError

from py.kernel.audit import sanitize_payload
from py.routes import kernel as kernel_routes


KERNEL_RUNTIME_SCHEMA = "openxnet.kernel-runtime.v1"
KERNEL_ENGINE_PATHS = frozenset({"/v1/desktop/kernel/command"})
KernelOperation = Literal[
    "status",
    "runtime",
    "control-board",
    "action-queue",
    "event-status",
    "plan-control",
    "plan-timeline",
    "plan-runs",
    "plan-resume",
    "runtime-mode",
    "approvals-pending",
    "approvals-history",
    "approval-resolve",
    "audit",
    "traces",
    "trace-detail",
    "trace-recovery",
    "trace-retry",
    "world",
    "plan",
    "plans-recent",
    "plan-step-contract",
    "plan-step-recovery",
    "plan-step-execute",
    "skill-lifecycle",
    "skill-sleep-cycle",
    "skill-change-proposals",
    "skill-change-proposal-resolve",
    "skill-select",
    "skill-transition",
    "guidance-list",
    "guidance-add",
    "config-intent",
    "config-apply",
]


class StrictRequest(BaseModel):
    """为私有请求提供禁止额外字段的共同约束。"""

    model_config = {"extra": "forbid"}


class EmptyPayload(StrictRequest):
    """表示一个不接受任何字段的操作载荷。"""


class KernelCommandRequest(StrictRequest):
    """约束单个固定 Kernel 操作及其结构化载荷。"""

    operation: KernelOperation
    payload: Dict[str, Any]


class ControlBoardPayload(StrictRequest):
    """约束计划控制板筛选和自动执行范围。"""

    limit: int = Field(ge=1, le=50)
    status: str = Field(max_length=80)
    source: str = Field(max_length=80)
    allowLowRisk: bool
    maxSteps: int = Field(ge=1, le=10)


class ActionQueuePayload(ControlBoardPayload):
    """约束计划动作队列的附加筛选和排序字段。"""

    includeComplete: bool
    actionType: str = Field(max_length=80)
    queueStatus: str = Field(max_length=80)
    sort: str = Field(max_length=32)


class LimitPayload(StrictRequest):
    """约束只需要返回数量的读取操作。"""

    limit: int = Field(ge=1, le=200)


class LimitStatusPayload(LimitPayload):
    """约束带状态筛选的有界读取操作。"""

    status: str = Field(max_length=120)


class AuditPayload(LimitPayload):
    """约束审计事件类型和最大返回数量。"""

    eventType: str = Field(max_length=120)


class PlanControlPayload(StrictRequest):
    """约束一个计划控制摘要请求。"""

    planId: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$")
    allowLowRisk: bool
    maxSteps: int = Field(ge=1, le=10)


class PlanTimelinePayload(StrictRequest):
    """约束一个计划时间线读取请求。"""

    planId: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$")
    limit: int = Field(ge=1, le=200)
    status: str = Field(max_length=80)
    includePlan: bool


class PlanRunsPayload(StrictRequest):
    """约束一个计划运行历史读取请求。"""

    planId: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$")
    limit: int = Field(ge=1, le=100)


class PlanResumePayload(StrictRequest):
    """约束一个计划恢复命令及其治理参数。"""

    planId: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$")
    dryRun: bool
    allowLowRisk: bool
    maxSteps: int = Field(ge=1, le=10)
    reason: str = Field(max_length=256)
    runId: str = Field(max_length=192)


class RuntimeModePayload(StrictRequest):
    """约束 Kernel 运行模式切换及持久化确认。"""

    mode: Literal["off", "shadow", "dual_write", "kernel", "degraded"]
    reason: str = Field(max_length=256)
    persist: bool
    confirmed: bool
    applyProfile: bool


class ApprovalHistoryPayload(LimitPayload):
    """约束审批历史数量和状态筛选。"""

    status: str = Field(max_length=80)


class ApprovalResolvePayload(StrictRequest):
    """约束一个审批决议及消费策略。"""

    approvalId: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$")
    resolution: Literal["approved", "denied"]
    reason: str = Field(max_length=512)
    consume: bool


class TraceIdPayload(StrictRequest):
    """约束一个稳定追踪 ID。"""

    traceId: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$")


class TraceRetryPayload(TraceIdPayload):
    """约束追踪重试使用的工具、参数和审批信息。"""

    toolName: str = Field(max_length=256)
    toolParams: Dict[str, Any]
    approvalId: str = Field(max_length=192)
    reason: str = Field(max_length=256)


class WorldPayload(StrictRequest):
    """约束世界状态构建需要的会话上下文。"""

    messages: List[Dict[str, str]] = Field(max_length=200)
    model: str = Field(max_length=256)
    includeRecent: bool


class PlanPayload(WorldPayload):
    """约束计划生成目标、候选工具和世界状态开关。"""

    goal: str = Field(max_length=32000)
    candidateTools: List[Any] = Field(max_length=200)
    includeWorld: bool
    includeRecent: bool = Field(default=False, exclude=True)


class RecentPlansPayload(LimitStatusPayload):
    """约束最近计划的状态和来源筛选。"""

    source: str = Field(max_length=80)


class PlanStepPayload(StrictRequest):
    """约束一个计划步骤的稳定定位字段。"""

    planId: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$")
    stepId: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$")


class PlanStepExecutePayload(PlanStepPayload):
    """约束计划步骤执行的工具参数和治理确认。"""

    toolParams: Dict[str, Any]
    approvalId: str = Field(max_length=192)
    reason: str = Field(max_length=256)
    confirmed: bool


class SkillTransitionPayload(StrictRequest):
    """约束技能生命周期切换及同步策略。"""

    skillId: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$")
    status: str = Field(max_length=80)
    reason: str = Field(max_length=256)
    actor: str = Field(max_length=80)
    sync: bool


class SkillProposalResolvePayload(StrictRequest):
    """约束 Skill 变更提案审批所需的稳定字段。"""

    proposalId: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$")
    approved: bool
    actor: str = Field(max_length=80)
    reason: str = Field(max_length=512)


class SkillSelectPayload(StrictRequest):
    """约束分环境 Skill 选择上下文和能力白名单。"""

    query: str = Field(max_length=32_000)
    environmentScope: str = Field(max_length=32)
    environmentFingerprint: str = Field(max_length=256)
    availableCapabilities: List[str] = Field(max_length=200)
    topK: int = Field(ge=1, le=50)


class GuidanceListPayload(StrictRequest):
    """约束指导列表使用的可选会话 ID。"""

    conversationId: str = Field(max_length=256)


class GuidanceAddPayload(GuidanceListPayload):
    """约束新增实时指导的文本、关联 ID、模式和优先级。"""

    text: str = Field(max_length=16000)
    turnId: str = Field(max_length=256)
    traceId: str = Field(max_length=256)
    mode: str = Field(max_length=32)
    priority: int = Field(ge=-100, le=100)


class ConfigIntentPayload(StrictRequest):
    """约束自然语言配置意图文本。"""

    text: str = Field(max_length=16000)


class ConfigApplyPayload(StrictRequest):
    """约束已解析配置意图和显式确认文本。"""

    intent: Dict[str, Any]
    confirmed: bool
    confirmationText: str = Field(max_length=2000)


PAYLOAD_MODELS: Dict[str, Type[BaseModel]] = {
    "status": EmptyPayload,
    "runtime": EmptyPayload,
    "control-board": ControlBoardPayload,
    "action-queue": ActionQueuePayload,
    "event-status": LimitPayload,
    "plan-control": PlanControlPayload,
    "plan-timeline": PlanTimelinePayload,
    "plan-runs": PlanRunsPayload,
    "plan-resume": PlanResumePayload,
    "runtime-mode": RuntimeModePayload,
    "approvals-pending": LimitPayload,
    "approvals-history": ApprovalHistoryPayload,
    "approval-resolve": ApprovalResolvePayload,
    "audit": AuditPayload,
    "traces": LimitStatusPayload,
    "trace-detail": TraceIdPayload,
    "trace-recovery": TraceIdPayload,
    "trace-retry": TraceRetryPayload,
    "world": WorldPayload,
    "plan": PlanPayload,
    "plans-recent": RecentPlansPayload,
    "plan-step-contract": PlanStepPayload,
    "plan-step-recovery": PlanStepPayload,
    "plan-step-execute": PlanStepExecutePayload,
    "skill-lifecycle": LimitStatusPayload,
    "skill-sleep-cycle": EmptyPayload,
    "skill-change-proposals": LimitStatusPayload,
    "skill-change-proposal-resolve": SkillProposalResolvePayload,
    "skill-select": SkillSelectPayload,
    "skill-transition": SkillTransitionPayload,
    "guidance-list": GuidanceListPayload,
    "guidance-add": GuidanceAddPayload,
    "config-intent": ConfigIntentPayload,
    "config-apply": ConfigApplyPayload,
}


class KernelEngineApi:
    """通过一条认证 POST 路由公开固定 Kernel 操作。"""

    def create_router(self) -> APIRouter:
        """创建私有 Kernel Router；无输入，返回单路由对象，不执行 Kernel 操作。"""

        router = APIRouter()
        router.add_api_route(
            "/v1/desktop/kernel/command",
            self.command,
            methods=["POST"],
        )
        return router

    async def command(self, request: KernelCommandRequest) -> Dict[str, Any]:
        """执行固定 Kernel 命令；输入操作和载荷，返回脱敏结果；载荷不匹配时返回固定 422 且不调用 Kernel。"""

        try:
            payload_model = PAYLOAD_MODELS[request.operation].model_validate(
                request.payload,
            )
        except ValidationError as error:
            raise HTTPException(
                status_code=422,
                detail="Kernel operation payload is invalid.",
            ) from error
        data = await self._dispatch(request.operation, payload_model)
        return {
            "schema": KERNEL_RUNTIME_SCHEMA,
            "success": True,
            "operation": request.operation,
            "data": _public_kernel_payload(data),
        }

    async def _dispatch(self, operation: KernelOperation, payload: BaseModel) -> Any:
        """分派一个已验证操作；输入固定操作和对应模型，返回原始结果；未知内部操作会抛出 RuntimeError。"""

        values = payload.model_dump(exclude={"includeRecent"})
        if operation == "status":
            return await kernel_routes.kernel_status()
        if operation == "runtime":
            return await kernel_routes.kernel_runtime_status()
        if operation == "control-board":
            return await kernel_routes.kernel_plan_control_board(
                limit=values["limit"],
                status=values["status"],
                source=values["source"],
                allow_low_risk=values["allowLowRisk"],
                max_steps=values["maxSteps"],
            )
        if operation == "action-queue":
            return await kernel_routes.kernel_plan_action_queue(
                limit=values["limit"],
                status=values["status"],
                source=values["source"],
                allow_low_risk=values["allowLowRisk"],
                max_steps=values["maxSteps"],
                include_complete=values["includeComplete"],
                action_type=values["actionType"],
                queue_status=values["queueStatus"],
                sort=values["sort"],
            )
        if operation == "event-status":
            return await kernel_routes.kernel_event_status(limit=values["limit"])
        if operation == "plan-control":
            return await kernel_routes.kernel_plan_control(
                values["planId"],
                allow_low_risk=values["allowLowRisk"],
                max_steps=values["maxSteps"],
            )
        if operation == "plan-timeline":
            return await kernel_routes.kernel_plan_timeline(
                values["planId"],
                limit=values["limit"],
                status=values["status"],
                include_plan=values["includePlan"],
            )
        if operation == "plan-runs":
            return await kernel_routes.kernel_plan_runs(values["planId"], limit=values["limit"])
        if operation == "plan-resume":
            return await kernel_routes.kernel_plan_resume(
                values["planId"],
                kernel_routes.PlanResumeRequest(
                    dry_run=values["dryRun"],
                    allow_low_risk=values["allowLowRisk"],
                    max_steps=values["maxSteps"],
                    reason=values["reason"],
                    run_id=values["runId"],
                ),
            )
        if operation == "runtime-mode":
            return await kernel_routes.kernel_runtime_mode(kernel_routes.RuntimeModeRequest(
                mode=values["mode"],
                reason=values["reason"],
                persist=values["persist"],
                confirmed=values["confirmed"],
                apply_profile=values["applyProfile"],
            ))
        if operation == "approvals-pending":
            return await kernel_routes.kernel_pending_approvals(limit=values["limit"])
        if operation == "approvals-history":
            return await kernel_routes.kernel_approval_history(limit=values["limit"], status=values["status"])
        if operation == "approval-resolve":
            return await kernel_routes.kernel_resolve_approval(kernel_routes.ApprovalResolveRequest(
                approval_id=values["approvalId"],
                resolution=values["resolution"],
                reason=values["reason"],
                consume=values["consume"],
            ))
        if operation == "audit":
            return await kernel_routes.kernel_audit(limit=values["limit"], event_type=values["eventType"])
        if operation == "traces":
            return await kernel_routes.kernel_traces(limit=values["limit"], status=values["status"])
        if operation == "trace-detail":
            return await kernel_routes.kernel_trace_detail(values["traceId"])
        if operation == "trace-recovery":
            return await kernel_routes.kernel_trace_recovery(values["traceId"])
        if operation == "trace-retry":
            return await kernel_routes.kernel_trace_retry(
                values["traceId"],
                kernel_routes.TraceRetryRequest(
                    tool_name=values["toolName"],
                    tool_params=values["toolParams"],
                    approval_id=values["approvalId"],
                    reason=values["reason"],
                ),
            )
        if operation == "world":
            return await kernel_routes.kernel_world_state_with_context(kernel_routes.WorldStateRequest(
                messages=values["messages"],
                model=values["model"],
                include_recent=payload.includeRecent,
            ))
        if operation == "plan":
            return await kernel_routes.kernel_plan(kernel_routes.KernelPlanRequest(
                goal=values["goal"],
                messages=values["messages"],
                model=values["model"],
                candidate_tools=values["candidateTools"],
                include_world=values["includeWorld"],
            ))
        if operation == "plans-recent":
            return await kernel_routes.kernel_recent_plans(
                limit=values["limit"],
                status=values["status"],
                source=values["source"],
            )
        if operation == "plan-step-contract":
            return await kernel_routes.kernel_plan_step_contract(values["planId"], values["stepId"])
        if operation == "plan-step-recovery":
            return await kernel_routes.kernel_plan_step_recovery(values["planId"], values["stepId"])
        if operation == "plan-step-execute":
            return await kernel_routes.kernel_plan_step_execute(
                values["planId"],
                values["stepId"],
                kernel_routes.PlanStepExecuteRequest(
                    tool_params=values["toolParams"],
                    approval_id=values["approvalId"],
                    reason=values["reason"],
                    confirmed=values["confirmed"],
                ),
            )
        if operation == "skill-lifecycle":
            return await kernel_routes.kernel_skill_lifecycle(status=values["status"], limit=values["limit"])
        if operation == "skill-sleep-cycle":
            return await kernel_routes.kernel_skill_lifecycle_sleep_cycle()
        if operation == "skill-change-proposals":
            return await kernel_routes.kernel_skill_change_proposals(
                status=values["status"],
                limit=values["limit"],
            )
        if operation == "skill-change-proposal-resolve":
            return await kernel_routes.kernel_skill_change_proposal_resolve(
                values["proposalId"],
                kernel_routes.SkillChangeProposalResolveRequest(
                    approved=values["approved"],
                    actor=values["actor"],
                    reason=values["reason"],
                ),
            )
        if operation == "skill-select":
            return await kernel_routes.kernel_skill_select(kernel_routes.SkillSelectionRequest(
                query=values["query"],
                environment_scope=values["environmentScope"],
                environment_fingerprint=values["environmentFingerprint"],
                available_capabilities=values["availableCapabilities"],
                top_k=values["topK"],
            ))
        if operation == "skill-transition":
            return await kernel_routes.kernel_skill_lifecycle_transition(
                values["skillId"],
                kernel_routes.SkillLifecycleTransitionRequest(
                    status=values["status"],
                    reason=values["reason"],
                    actor=values["actor"],
                    sync=values["sync"],
                ),
            )
        if operation == "guidance-list":
            return await kernel_routes.list_live_guidance(conversation_id=values["conversationId"])
        if operation == "guidance-add":
            return await kernel_routes.add_live_guidance(kernel_routes.GuidanceRequest(
                text=values["text"],
                conversation_id=values["conversationId"],
                turn_id=values["turnId"],
                trace_id=values["traceId"],
                mode=values["mode"],
                priority=values["priority"],
            ))
        if operation == "config-intent":
            return await kernel_routes.create_config_intent(kernel_routes.ConfigIntentRequest(text=values["text"]))
        if operation == "config-apply":
            return await kernel_routes.apply_config(kernel_routes.ConfigApplyRequest(
                intent=values["intent"],
                confirmed=values["confirmed"],
                confirmation_text=values["confirmationText"],
            ))
        raise RuntimeError("Kernel operation dispatcher is incomplete.")


def _public_kernel_payload(value: Any, depth: int = 0) -> Any:
    """递归脱敏 Kernel 结果；输入任意内部值，返回有界 JSON；超深结构会被固定占位符截断。"""

    if depth > 16:
        return "[TRUNCATED]"
    if isinstance(value, dict):
        output: Dict[str, Any] = {}
        for key, item in list(value.items())[:2000]:
            key_text = str(key)[:256]
            probe = sanitize_payload({key_text: "openxnet-probe"})
            if probe.get(key_text) == "[REDACTED]":
                output[key_text] = "[REDACTED]"
            else:
                output[key_text] = _public_kernel_payload(item, depth + 1)
        return output
    if isinstance(value, (list, tuple)):
        return [_public_kernel_payload(item, depth + 1) for item in list(value)[:2000]]
    return sanitize_payload(value, max_string=128000)


def register_kernel_engine_api(application: FastAPI) -> KernelEngineApi:
    """注册私有 Kernel dispatcher；输入 FastAPI，返回 API 实例，不注册任何旧 `/v1/kernel/*` 路由。"""

    api = KernelEngineApi()
    application.include_router(api.create_router())
    return api
