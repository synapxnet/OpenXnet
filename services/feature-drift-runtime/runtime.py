#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
"""真实特征漂移演练执行器 / Actual isolated feature-drift staging executor.

Author: maoyo
Department: 研发部
Date: 2026-09-18
Version: 1.3.0
Security Level: INTERNAL
"""

from __future__ import annotations

import copy
import csv
import hashlib
import hmac
import io
import json
import math
import os
import re
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
import numpy as np
import lightgbm as lgb

__version__ = "1.3.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

SOURCE = "REAL_CPU_SYNTHETIC_STAGING"
IDENTIFIER = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
WRITE_ACTIONS = {"fallback", "backfill", "feature-publish", "train", "register", "canary", "promote", "fallback-remove", "rollback"}
ROLE_ACTIONS = {"initializer": {"initialize"}, "dataops": {"backfill"}, "mlops": WRITE_ACTIONS - {"backfill"} | {"evaluate"}, "aiops": set(), "resident": set()}
TOOLS = {"fallback": "mlops.feature.fallback.apply", "backfill": "dataops.feature.backfill.start", "train": "mlops.training.search.start", "evaluate": "mlops.model.evaluation.run", "register": "mlops.model.register", "canary": "mlops.deployment.canary.apply", "promote": "mlops.deployment.promote", "fallback-remove": "mlops.feature.fallback.remove", "rollback": "mlops.deployment.rollback", "feature-publish": "mlops.feature.pipeline.publish"}
ARGUMENT_KEYS = {"fallback": {"deploymentUid", "featureSetUid", "reasonCode"}, "backfill": {"assetUid", "workflowInstanceUid", "historyMonths", "targetSchemaVersion", "outputDatasetUid"}, "train": {"deploymentUid", "datasetUid", "experimentUid", "targetRevision", "trialCount", "architectures", "mode"}, "evaluate": {"deploymentUid", "experimentUid", "targetRevision", "testDatasetRef", "minimumSharpeImprovement", "maximumDrawdownIncrease"}, "register": {"deploymentUid", "experimentUid", "targetRevision", "modelCardUid"}, "canary": {"deploymentUid", "targetRevision", "trafficPercent", "environment", "observationMinutes"}, "promote": {"deploymentUid", "targetRevision", "trafficPercent", "environment"}, "fallback-remove": {"deploymentUid", "featureSetUid", "targetRevision"}, "rollback": {"deploymentUid", "targetRevision", "verificationPolicy"}}


class RuntimeErrorResponse(Exception):
    """携带安全HTTP错误码 / Carry a safe HTTP error code."""

    def __init__(self, status: int, code: str, message: str):
        """保存公开错误信息 / Store public error details."""
        super().__init__(message)
        self.status, self.code = status, code


def require(condition: bool, code: str, message: str, status: int = 412) -> None:
    """失败时返回明确领域错误 / Fail with an explicit domain error."""
    if not condition:
        raise RuntimeErrorResponse(status, code, message)


def utc_now() -> str:
    """返回UTC时间戳 / Return a UTC timestamp."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def canonical(value: object) -> bytes:
    """生成稳定参数JSON / Produce canonical parameter JSON."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def digest(value: object) -> str:
    """计算对象的SHA256 / Hash a structured value with SHA256."""
    return hashlib.sha256(canonical(value)).hexdigest()


def file_digest(path: Path) -> str:
    """读取真实制品摘要 / Hash actual artifact bytes."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def atomic_write(path: Path, content: bytes) -> None:
    """持久化制品后原子替换 / Persist an artifact before atomic replacement."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp-" + uuid.uuid4().hex)
    with temporary.open("wb") as stream:
        stream.write(content)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


def bounded_id(value: object, label: str) -> str:
    """限制租户事件标识并拒绝路径输入 / Bound identifiers and reject path input."""
    require(isinstance(value, str) and IDENTIFIER.fullmatch(value) is not None, "INVALID_ID", label + " is invalid", 400)
    return value


def sigmoid(value: np.ndarray) -> np.ndarray:
    """稳定计算二分类概率 / Compute numerically stable binary probabilities."""
    return 1.0 / (1.0 + np.exp(-np.clip(value, -30, 30)))


def features(raw: np.ndarray) -> np.ndarray:
    """从真实源行重算缺失八维 / Recompute eight missing features from source rows."""
    score = raw[:, 0] + 0.65 * raw[:, 1] - 0.3 * raw[:, 2]
    recovered = np.column_stack([score, raw[:, 0], raw[:, 1], raw[:, 2], raw[:, 0] * raw[:, 1], raw[:, 0] ** 2, raw[:, 1] ** 2, np.tanh(score)])
    return np.column_stack([raw, recovered])


def fit_model(architecture: str, matrix: np.ndarray, labels: np.ndarray, trial: int) -> dict:
    """真实训练受批算法，不用替身模型 / Actually train the approved algorithm without substitutes."""
    if architecture == "LightGBM":
        parameters = {"objective": "binary", "verbosity": -1, "num_threads": 1, "seed": 7300 + trial, "num_leaves": 7 + 4 * (trial % 3), "learning_rate": 0.07 + 0.01 * (trial % 3), "min_data_in_leaf": 12, "force_col_wise": True, "deterministic": True}
        model = lgb.train(parameters, lgb.Dataset(matrix, label=labels), num_boost_round=60 + 10 * (trial % 3))
        return {"architecture": architecture, "parameters": parameters | {"num_boost_round": 60 + 10 * (trial % 3)}, "featureDimension": 128, "modelText": model.model_to_string()}
    require(architecture == "WideAndDeep", "UNSUPPORTED_ARCHITECTURE", "Only LightGBM and WideAndDeep are approved", 400)
    rng = np.random.default_rng(7300 + trial)
    mean, scale = matrix.mean(axis=0), matrix.std(axis=0) + 1e-6
    x = (matrix - mean) / scale
    width = 8 + 4 * (trial % 3)
    weights = rng.normal(0, 0.05, (128, width))
    bias, deep, wide = np.zeros(width), rng.normal(0, 0.05, width), np.zeros(128)
    intercept, rate = 0.0, 0.10 + 0.02 * (trial % 3)
    for _ in range(180):
        hidden = np.maximum(x @ weights + bias, 0)
        error = (sigmoid(x @ wide + hidden @ deep + intercept) - labels) / len(labels)
        gradient_hidden = error[:, None] * deep[None, :] * (hidden > 0)
        weights -= rate * (x.T @ gradient_hidden + 0.0003 * weights)
        bias -= rate * gradient_hidden.sum(axis=0)
        deep -= rate * (hidden.T @ error + 0.0003 * deep)
        wide -= rate * (x.T @ error + 0.0003 * wide)
        intercept -= rate * float(error.sum())
    return {"architecture": architecture, "featureDimension": 128, "parameters": {"hiddenUnits": width, "epochs": 180, "learningRate": rate, "seed": 7300 + trial, "wideBranch": "linear", "deepActivation": "ReLU", "output": "sigmoid"}, "mean": mean.tolist(), "scale": scale.tolist(), "weights": weights.tolist(), "bias": bias.tolist(), "deep": deep.tolist(), "wide": wide.tolist(), "intercept": intercept}


def compile_model(model: dict) -> dict:
    """加载无可执行代码模型制品 / Load model artifacts without executable pickle payloads."""
    if model["architecture"] == "LightGBM":
        return {"architecture": "LightGBM", "booster": lgb.Booster(model_str=model["modelText"])}
    return {key: np.asarray(value) if isinstance(value, list) else value for key, value in model.items()}


def predict(model: dict, matrix: np.ndarray) -> np.ndarray:
    """执行真实模型推理并校验维数 / Run actual model inference and validate dimensions."""
    require(matrix.ndim == 2 and matrix.shape[1] == 128, "FEATURE_CONTRACT_MISMATCH", "Model requires 128 features; observed " + str(matrix.shape[-1]))
    if model["architecture"] == "LightGBM":
        return model["booster"].predict(matrix, num_threads=1)
    x = (matrix - model["mean"]) / model["scale"]
    return sigmoid(x @ model["wide"] + np.maximum(x @ model["weights"] + model["bias"], 0) @ model["deep"] + model["intercept"])


def scores(probabilities: np.ndarray, labels: np.ndarray) -> dict:
    """从真实预测计算分类质量 / Compute classification quality from actual predictions."""
    clipped = np.clip(probabilities, 1e-7, 1 - 1e-7)
    return {"accuracy": float(np.mean((probabilities >= 0.5) == labels)), "logLoss": float(-np.mean(labels * np.log(clipped) + (1 - labels) * np.log(1 - clipped))), "approvalRate": float(np.mean(probabilities >= 0.5)), "referenceApprovalRate": float(labels.mean())}


class FeatureDriftRuntime:
    """隔离真实制品、治理版本和测量 / Isolate actual artifacts, governed versions, and measurements."""

    def __init__(self, root: Path):
        """打开持久化台账并标记中断动作 / Open the durable ledger and mark interrupted actions."""
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.db = sqlite3.connect(self.root / "runtime.sqlite3", check_same_thread=False)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA synchronous=FULL")
        self.db.execute("CREATE TABLE IF NOT EXISTS runs (workspace TEXT NOT NULL, incident TEXT NOT NULL, state TEXT NOT NULL, PRIMARY KEY(workspace,incident))")
        self.db.execute("CREATE TABLE IF NOT EXISTS actions (workspace TEXT NOT NULL, incident TEXT NOT NULL, idem TEXT NOT NULL, fingerprint TEXT NOT NULL, receipt TEXT NOT NULL, response TEXT, status TEXT NOT NULL, PRIMARY KEY(workspace,incident,idem))")
        self.db.execute("UPDATE actions SET status='INTERRUPTED' WHERE status='RUNNING'")
        self.db.commit()
        self.model_cache = {}

    def close(self) -> None:
        """关闭持久化连接 / Close the durable connection."""
        self.db.close()

    def directory(self, workspace: str, incident: str) -> Path:
        """返回固定根目录下的隔离目录 / Return the isolated directory under a fixed root."""
        return self.root / bounded_id(workspace, "workspaceId") / bounded_id(incident, "incidentId")

    def load(self, workspace: str, incident: str) -> dict:
        """读取现存事件，禁止GET创建 / Read an existing incident without implicit creation."""
        bounded_id(workspace, "workspaceId")
        bounded_id(incident, "incidentId")
        row = self.db.execute("SELECT state FROM runs WHERE workspace=? AND incident=?", (workspace, incident)).fetchone()
        require(row is not None, "INCIDENT_NOT_PREPARED", "The isolated incident must be explicitly initialized", 404)
        return json.loads(row[0])

    def save(self, state: dict) -> None:
        """在当前事务保存领域状态 / Save domain state within the current transaction."""
        self.db.execute("INSERT INTO runs(workspace,incident,state) VALUES(?,?,?) ON CONFLICT(workspace,incident) DO UPDATE SET state=excluded.state", (state["workspaceId"], state["incidentId"], canonical(state).decode()))

    def source_rows(self, state: dict) -> tuple:
        """每次从源文件读取真实行 / Read actual rows from the source artifact."""
        path = self.directory(state["workspaceId"], state["incidentId"]) / "source.csv"
        require(file_digest(path) == state["dataset"]["sourceDigest"], "SOURCE_CHANGED", "Source artifact digest changed")
        with path.open(encoding="utf-8", newline="") as stream:
            records = list(csv.DictReader(stream))
        raw = np.asarray([[float(row["f" + str(index)]) for index in range(120)] for row in records])
        return records, raw, np.asarray([int(row["label"]) for row in records])

    def model(self, state: dict, revision: int) -> dict:
        """按内容摘要加载指定真实模型 / Load a revision's actual model by content digest."""
        ref = state["models"].get(str(revision))
        require(ref is not None, "MODEL_NOT_FOUND", "Model revision is unavailable")
        path = self.directory(state["workspaceId"], state["incidentId"]) / ref["file"]
        require(file_digest(path) == ref["digest"], "MODEL_CHANGED", "Model artifact digest changed")
        if ref["digest"] not in self.model_cache:
            self.model_cache[ref["digest"]] = compile_model(json.loads(path.read_text(encoding="utf-8")))
        return self.model_cache[ref["digest"]]

    def initialize(self, body: dict) -> dict:
        """显式生成独立合成源与冻结基线 / Explicitly generate synthetic input and a frozen baseline."""
        args = body.get("arguments", {})
        allowed = {"failureMode", "fixtureFault", "initialResourceVersion", "initialResourceVersions", "deploymentUid", "assetUid", "targetRevision", "baselineRevision", "rollbackRevision"}
        require(set(args) <= allowed, "INVALID_ARGUMENT", "Unsupported initialization arguments", 400)
        baseline, target = int(args.get("baselineRevision", 18)), int(args.get("targetRevision", 19))
        require(baseline == 18 and target == 19 and args.get("rollbackRevision", 17) == 17, "UNSUPPORTED_REVISION", "This staging contract binds stable 17, failing 18 and candidate 19", 400)
        deployment, asset = args.get("deploymentUid", "deploy_risk_prod"), args.get("assetUid", "asset_risk_features_prod")
        require(deployment == "deploy_risk_prod" and asset == "asset_risk_features_prod", "RESOURCE_NOT_ALLOWED", "Only fixed isolated risk resources are supported", 400)
        failure = args.get("failureMode", args.get("fixtureFault", "none"))
        require(failure in {"none", "post_release_contract"}, "INVALID_FAULT", "Unknown controlled fault", 400)
        workspace, incident = body["workspaceId"], body["incidentId"]
        require(self.db.execute("SELECT 1 FROM runs WHERE workspace=? AND incident=?", (workspace, incident)).fetchone() is None, "ALREADY_INITIALIZED", "An incident cannot be reset or change its fixed fault", 409)
        resources = [deployment, deployment + "/traffic", deployment + "/feature-set", deployment + "/revisions/19", "experiment_risk_19", asset + "/backfill"]
        initial = args.get("initialResourceVersions", {})
        require(isinstance(initial, dict) and set(initial) <= set(resources), "RESOURCE_NOT_ALLOWED", "Unknown resource in initial versions", 400)
        versions = {resource: str(initial.get(resource, args.get("initialResourceVersion", 42))) for resource in resources}
        require(all(re.fullmatch(r"[1-9][0-9]{0,8}", x) for x in versions.values()), "INVALID_VERSION", "Resource versions must be positive bounded integers", 400)
        directory = self.directory(workspace, incident)
        rng = np.random.default_rng(20260918)
        raw = rng.normal(0, 1, (1152, 120))
        labels = (raw[:, 0] + 0.65 * raw[:, 1] - 0.3 * raw[:, 2] >= 0).astype(int)
        buffer = io.StringIO(newline="")
        writer = csv.writer(buffer, lineterminator="\n")
        writer.writerow(["rowId", "month", "split", *["f" + str(i) for i in range(120)], "label"])
        for row in range(1152):
            month = row // 32
            year, month_index = 2023 + (9 + month) // 12, (9 + month) % 12 + 1
            split = "train" if month < 25 else "validation" if month < 30 else "held-out"
            writer.writerow(["synthetic-" + str(row), f"{year:04d}-{month_index:02d}", split, *[f"{x:.8f}" for x in raw[row]], int(labels[row])])
        atomic_write(directory / "source.csv", buffer.getvalue().encode())
        raw = np.round(raw, 8)
        baseline_model = fit_model("LightGBM", features(raw[:800]), labels[:800], 0)
        baseline_model["revision"] = 18
        atomic_write(directory / "baseline-18.json", canonical(baseline_model))
        base_digest = file_digest(directory / "baseline-18.json")
        stable_model = fit_model("LightGBM", features(raw[:800]), labels[:800], 1)
        stable_model["revision"] = 17
        atomic_write(directory / "stable-17.json", canonical(stable_model))
        now = utc_now()
        state = {"schemaVersion": "openxnet.feature-drift-runtime.v1", "sourceMode": SOURCE, "synthetic": True, "workspaceId": workspace, "incidentId": incident, "traceId": body.get("traceId"), "createdAt": now, "updatedAt": now, "phase": "FAULT_OBSERVED", "failureMode": failure, "resourceVersions": versions, "resources": {"deploymentUid": deployment, "assetUid": asset, "experimentUid": "experiment_risk_19"}, "dataset": {"datasetUid": None, "status": "CONTRACT_MISMATCH", "inputRows": 1152, "outputRows": 0, "featureDimension": 120, "expectedDimension": 128, "historyMonths": 36, "timeCoverageMonths": 36, "timeRange": {"from": "2023-10", "to": "2026-09"}, "splits": {"train": 800, "validation": 160, "heldOut": 192}, "sourceDigest": file_digest(directory / "source.csv"), "datasetDigest": None, "qualityScore": 120 / 128, "missingValues": 1152 * 8, "lineage": ["synthetic.raw_transactions", "isolated.risk_features", "isolated.risk_predictions"]}, "training": None, "deployment": {"deploymentUid": deployment, "baselineRevision": 18, "activeRevision": 18, "targetRevision": 19, "activeModelDigest": base_digest, "candidateModelDigest": None, "trafficPercent": 0, "fallbackFeatureActive": False, "featureDimension": 120, "routeVersion": 1, "canary": None, "promoted": False, "registered": False, "evaluationPassed": False}, "latestProbe": None, "measurements": [], "compensation": None, "models": {"18": {"file": "baseline-18.json", "digest": base_digest, "architecture": "LightGBM"}}}
        state["latestProbe"] = self.measure(state, 192)
        state["deployment"]["rollbackRevision"] = 17
        state["models"]["17"] = {"file": "stable-17.json", "digest": file_digest(directory / "stable-17.json"), "architecture": "LightGBM"}
        state["baselineProbe"] = state["latestProbe"] | {"stage": "baseline"}
        state["measurements"].append(state["baselineProbe"])
        return state

    def resource_for(self, action: str) -> str:
        """将动作固定绑定允许资源 / Bind actions to fixed permitted resources."""
        return {"fallback": "deploy_risk_prod/feature-set", "fallback-remove": "deploy_risk_prod/feature-set", "backfill": "asset_risk_features_prod/backfill", "feature-publish": "deploy_risk_prod/feature-set", "train": "experiment_risk_19", "evaluate": "experiment_risk_19", "register": "deploy_risk_prod/revisions/19", "canary": "deploy_risk_prod/traffic", "promote": "deploy_risk_prod/traffic", "rollback": "deploy_risk_prod"}[action]

    def validate_request(self, action: str, body: dict, state: dict | None) -> None:
        """二次校验审批上下文、参数摘要和版本 / Recheck approval context, argument digest, and resource version."""
        require(isinstance(body.get("arguments", {}), dict), "INVALID_ARGUMENT", "arguments must be an object", 400)
        bounded_id(body.get("workspaceId"), "workspaceId")
        bounded_id(body.get("incidentId"), "incidentId")
        require(isinstance(body.get("traceId"), str) and 1 <= len(body["traceId"]) <= 160, "INVALID_TRACE", "traceId is required", 400)
        if state is not None:
            require(body["traceId"] == state["traceId"], "TRACE_MISMATCH", "Incident trace scope differs", 403)
        if action in WRITE_ACTIONS:
            for field in ["approvalId", "planId", "planDigest", "stepId", "actorId", "argumentsDigest", "idempotencyKey"]:
                require(isinstance(body.get(field), str) and 0 < len(body[field]) <= 512, "GOVERNANCE_REQUIRED", field + " is required", 403)
            require(body.get("toolName") == TOOLS[action], "TOOL_NOT_ALLOWED", "Tool does not match action", 403)
            require(body["planId"] == "feature-drift-full-recovery-v2" and re.fullmatch(r"[a-f0-9]{64}", body["planDigest"]) is not None, "PLAN_NOT_ALLOWED", "Only the fixed digest-bound feature drift plan is supported", 403)
            require(body.get("resourceId") == self.resource_for(action), "RESOURCE_NOT_ALLOWED", "Resource does not match action", 403)
            expected_digest = str(body["argumentsDigest"]).removeprefix("sha256:")
            require(hmac.compare_digest(expected_digest, digest(body["arguments"])), "ARGUMENT_DIGEST_MISMATCH", "Approved argument digest differs", 412)
            require(str(body.get("expectedResourceVersion")) == state["resourceVersions"][self.resource_for(action)], "STALE_RESOURCE_VERSION", "Expected resource version differs", 412)
            require(action != "rollback" or body.get("compensation") is True, "COMPENSATION_REQUIRED", "Rollback requires the approved compensation step", 403)
            expected_revision = 17 if action == "rollback" else 18 if action == "fallback" and not body.get("compensation") else 19
            require(body.get("targetRevision") == expected_revision, "REVISION_NOT_ALLOWED", "Action target differs from the approved revision", 412)
        if action in ARGUMENT_KEYS:
            require(set(body["arguments"]) == ARGUMENT_KEYS[action], "INVALID_ARGUMENT", "Action arguments must exactly match the fixed schema", 400)
        require(action != "feature-publish", "ACTION_NOT_IN_PLAN", "The feature-drift plan publishes the repaired transformation through backfill", 400)
        if action not in {"initialize", "evaluate"}:
            require(body.get("dryRun") in (None, True, False), "INVALID_ARGUMENT", "dryRun must be boolean", 400)

    def action(self, action: str, body: dict) -> dict:
        """执行幂等事务并保存真实回执 / Execute an idempotent transaction and save the actual receipt."""
        require(action in WRITE_ACTIONS | {"initialize", "evaluate"}, "UNKNOWN_ACTION", "Unknown action", 404)
        workspace, incident = bounded_id(body.get("workspaceId"), "workspaceId"), bounded_id(body.get("incidentId"), "incidentId")
        with self.lock:
            state = None if action == "initialize" else self.load(workspace, incident)
            idem = str(body.get("idempotencyKey") or body.get("requestId") or "")
            require(0 < len(idem) <= 512, "IDEMPOTENCY_REQUIRED", "A bounded idempotency key is required", 400)
            fingerprint = digest({key: value for key, value in body.items() if key not in {"requestId"}} | {"action": action})
            existing = self.db.execute("SELECT fingerprint,response,status FROM actions WHERE workspace=? AND incident=? AND idem=?", (workspace, incident, idem)).fetchone()
            if existing:
                require(existing[0] == fingerprint, "IDEMPOTENCY_CONFLICT", "The key was used with different parameters", 409)
                require(existing[2] == "SUCCEEDED", "ACTION_NOT_COMPLETED", "Previous attempt is " + existing[2] + "; inspect the ledger before retrying", 409)
                return json.loads(existing[1])
            self.validate_request(action, body, state)
            if body.get("dryRun") is True:
                version = None if state is None else state["resourceVersions"].get(self.resource_for(action))
                now = utc_now()
                receipt = {"actionId": "dryrun_" + digest({"action": action, "request": body})[:32], "action": action, "status": "DRY_RUN", "beforeResourceVersion": version, "afterResourceVersion": version, "startedAt": now, "completedAt": now}
                return {"data": {"dryRun": True, "validated": True, "sourceMode": SOURCE, "workspaceId": workspace, "incidentId": incident, "traceId": body["traceId"], "resourceVersions": {} if state is None else state["resourceVersions"]}, "resourceVersion": version, "actionReceipt": receipt}
            before = None if state is None else state["resourceVersions"][self.resource_for(action)]
            receipt = {"actionId": "act_" + uuid.uuid4().hex, "action": action, "approvalId": body.get("approvalId"), "approverId": body.get("approverId"), "planId": body.get("planId"), "planDigest": body.get("planDigest"), "stepId": body.get("stepId"), "resourceId": body.get("resourceId"), "argumentsDigest": body.get("argumentsDigest"), "idempotencyKey": idem, "compensation": body.get("compensation", False), "beforeResourceVersion": before, "afterResourceVersion": before, "startedAt": utc_now(), "completedAt": None, "status": "RUNNING"}
            receipt["beforeResourceVersions"] = copy.deepcopy(state["resourceVersions"]) if state else None
            self.db.execute("INSERT INTO actions VALUES(?,?,?,?,?,?,?)", (workspace, incident, idem, fingerprint, canonical(receipt).decode(), None, "RUNNING"))
            self.db.commit()
            try:
                if action == "initialize":
                    state = self.initialize(body)
                else:
                    self.apply(action, state, body)
                    if action != "evaluate":
                        resource = self.resource_for(action)
                        state["resourceVersions"][resource] = str(int(before) + 1)
                        if action in {"canary", "promote"}:
                            state["resourceVersions"]["deploy_risk_prod"] = str(int(state["resourceVersions"]["deploy_risk_prod"]) + 1)
                        receipt["afterResourceVersion"] = state["resourceVersions"][resource]
                receipt["afterResourceVersions"] = copy.deepcopy(state["resourceVersions"])
                state["updatedAt"] = utc_now()
                receipt.update(status="SUCCEEDED", completedAt=utc_now())
                self.save(state)
                data = self.public(state, include_actions=False)
                data.update(datasetDigest=state["dataset"]["datasetDigest"], modelDigest=state["deployment"]["candidateModelDigest"], deploymentUid="deploy_risk_prod")
                if action == "evaluate":
                    data.update(state["training"]["evaluation"])
                    data["evaluationPassed"] = state["deployment"]["evaluationPassed"]
                result = {"data": data, "resourceVersion": receipt["afterResourceVersion"], "actionReceipt": receipt}
                self.db.execute("UPDATE actions SET receipt=?,response=?,status='SUCCEEDED' WHERE workspace=? AND incident=? AND idem=?", (canonical(receipt).decode(), canonical(result).decode(), workspace, incident, idem))
                self.db.commit()
                return result
            except Exception as error:
                self.db.rollback()
                receipt.update(status="FAILED", completedAt=utc_now(), errorCode=error.code if isinstance(error, RuntimeErrorResponse) else "EXECUTION_FAILED")
                receipt["errorMessage"] = str(error)[:400] if isinstance(error, RuntimeErrorResponse) else "Actual artifact execution failed; no domain state was committed"
                self.db.execute("UPDATE actions SET receipt=?,status='FAILED' WHERE workspace=? AND incident=? AND idem=?", (canonical(receipt).decode(), workspace, incident, idem))
                self.db.commit()
                raise

    def backfill(self, state: dict, args: dict) -> None:
        """读取36月源行并真实重算输出CSV / Read 36 months of source rows and actually write repaired CSV."""
        require(args.get("assetUid") == "asset_risk_features_prod" and args.get("historyMonths") == 36, "INVALID_ARGUMENT", "Backfill must target 36 months of the isolated risk asset", 400)
        require(args.get("workflowInstanceUid") == "task_risk_features_latest", "INVALID_ARGUMENT", "Workflow differs from the fixed risk workflow", 400)
        require(args.get("outputDatasetUid") == "dataset_risk_repaired_19" and args.get("targetSchemaVersion") == "2026.08.11-fixed", "INVALID_ARGUMENT", "Dataset/schema differs from the fixed approved contract", 400)
        records, raw, labels = self.source_rows(state)
        matrix = features(raw)
        output = io.StringIO(newline="")
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow(["rowId", "month", "split", *["f" + str(i) for i in range(128)], "label"])
        for index, row in enumerate(records):
            writer.writerow([row["rowId"], row["month"], row["split"], *[f"{value:.8f}" for value in matrix[index]], int(labels[index])])
        path = self.directory(state["workspaceId"], state["incidentId"]) / "repaired.csv"
        atomic_write(path, output.getvalue().encode())
        state["dataset"].update(datasetUid=args["outputDatasetUid"], status="PASSED", outputRows=len(matrix), featureDimension=128, datasetDigest=file_digest(path), qualityScore=float(np.isfinite(matrix).mean()), missingValues=int(np.count_nonzero(~np.isfinite(matrix))), schemaVersion=args["targetSchemaVersion"], workflowInstanceUid="runtime_backfill_" + state["incidentId"], transformationDigest=file_digest(Path(__file__)), completedAt=utc_now())
        state["phase"] = "DATA_REPAIRED"

    def training(self, state: dict, args: dict) -> None:
        """执行获批的有界真实算法搜索 / Run the approved bounded search with actual training algorithms."""
        require(state["dataset"]["status"] == "PASSED", "DATASET_NOT_READY", "Actual repaired dataset is required")
        require(args.get("datasetUid") == state["dataset"]["datasetUid"] and args.get("experimentUid") == "experiment_risk_19" and args.get("targetRevision") == 19 and args.get("mode") == "RETRAIN", "INVALID_ARGUMENT", "Training scope differs from the approved risk contract", 400)
        architectures, count = args.get("architectures"), args.get("trialCount")
        require(isinstance(architectures, list) and len(architectures) == len(set(architectures)) and set(architectures) == {"LightGBM", "WideAndDeep"}, "UNSUPPORTED_ARCHITECTURE", "Both approved algorithms LightGBM and WideAndDeep must execute", 400)
        require(type(count) is int and 2 <= count <= 12, "TRIAL_LIMIT", "Trial count must be 2..12", 400)
        directory = self.directory(state["workspaceId"], state["incidentId"])
        require(file_digest(directory / "repaired.csv") == state["dataset"]["datasetDigest"], "DATASET_CHANGED", "Repaired dataset digest changed")
        with (directory / "repaired.csv").open(encoding="utf-8", newline="") as stream:
            rows = list(csv.DictReader(stream))
        matrix = np.asarray([[float(row["f" + str(i)]) for i in range(128)] for row in rows])
        labels = np.asarray([int(row["label"]) for row in rows])
        train_mask, validation_mask = np.asarray([row["split"] == "train" for row in rows]), np.asarray([row["split"] == "validation" for row in rows])
        job = {"experimentUid": "experiment_risk_19", "status": "RUNNING", "startedAt": utc_now(), "completedAt": None, "trials": [], "selectedTrial": None, "architecture": None, "modelDigest": None, "datasetDigest": state["dataset"]["datasetDigest"], "trainRows": int(train_mask.sum()), "validationRows": int(validation_mask.sum()), "heldOutRows": 192, "logs": ["CPU training started; held-out split is excluded from fit and model selection."]}
        for trial in range(count):
            started = time.perf_counter()
            architecture = architectures[trial % len(architectures)]
            artifact = fit_model(architecture, matrix[train_mask], labels[train_mask], trial)
            artifact["revision"] = 19
            metrics = scores(predict(compile_model(artifact), matrix[validation_mask]), labels[validation_mask])
            path = directory / ("trial-" + str(trial) + ".json")
            atomic_write(path, canonical(artifact))
            record = {"trialId": trial, "architecture": architecture, "parameters": artifact["parameters"], "modelDigest": file_digest(path), "durationMs": round((time.perf_counter() - started) * 1000, 3), **metrics}
            job["trials"].append(record)
            job["logs"].append(f"Trial {trial + 1}/{count} {architecture}: validation accuracy={metrics['accuracy']:.6f}, logLoss={metrics['logLoss']:.6f}.")
        selected = min(job["trials"], key=lambda row: (-row["accuracy"], row["logLoss"]))
        atomic_write(directory / "candidate-19.json", (directory / ("trial-" + str(selected["trialId"]) + ".json")).read_bytes())
        job.update(status="SUCCEEDED", completedAt=utc_now(), selectedTrial=selected["trialId"], architecture=selected["architecture"], modelDigest=selected["modelDigest"])
        job["logs"].append("Candidate selected only on validation data; independent held-out evaluation is still required.")
        state["models"]["19"] = {"file": "candidate-19.json", "digest": selected["modelDigest"], "architecture": selected["architecture"]}
        state["training"] = job
        state["deployment"]["candidateModelDigest"] = selected["modelDigest"]
        state["phase"] = "MODEL_TRAINED"

    def apply(self, action: str, state: dict, body: dict) -> None:
        """执行固定生命周期动作而非只改成功布尔值 / Execute fixed lifecycle operations instead of synthetic success toggles."""
        args, deployment = body.get("arguments", {}), state["deployment"]
        phases = {"backfill": {"MITIGATED"}, "train": {"DATA_REPAIRED"}, "evaluate": {"MODEL_TRAINED", "EVALUATED"}, "register": {"EVALUATED"}, "canary": {"REGISTERED"}, "promote": {"CANARY_PASSED"}, "fallback-remove": {"PROMOTED"}}
        if action in phases:
            require(state["phase"] in phases[action], "PHASE_PRECONDITION_FAILED", "The preceding approved lifecycle step must complete")
        if action == "fallback":
            require(state["phase"] in ({"COMPENSATED"} if body.get("compensation") else {"FAULT_OBSERVED"}), "PHASE_PRECONDITION_FAILED", "Fallback must be the initial mitigation or approved post-rollback preservation")
        if action not in {"backfill"}:
            require(args.get("deploymentUid") == "deploy_risk_prod", "RESOURCE_NOT_ALLOWED", "Deployment scope differs", 400)
        if action in {"fallback", "fallback-remove"}:
            require(args.get("featureSetUid") == "feature_set_risk_fallback_v1", "FEATURE_NOT_ALLOWED", "Unknown fallback feature transformation", 400)
        if action == "fallback":
            require(args.get("reasonCode") in {"UPSTREAM_SDK_CONTRACT_DRIFT", "VERIFICATION_ROLLBACK"}, "INVALID_ARGUMENT", "Unknown fallback reason", 400)
            deployment.update(fallbackFeatureActive=True, featureDimension=128, routeVersion=deployment["routeVersion"] + 1)
            state["phase"] = "MITIGATED" if not body.get("compensation") else "COMPENSATED"
        elif action == "backfill":
            require(deployment["fallbackFeatureActive"], "MITIGATION_REQUIRED", "Apply approved fallback before backfill")
            self.backfill(state, args)
        elif action == "feature-publish":
            require(state["dataset"]["status"] == "PASSED", "DATASET_NOT_READY", "Repaired transformation is required")
            deployment["featureDimension"] = 128
        elif action == "train":
            self.training(state, args)
        elif action == "evaluate":
            require(state["training"] is not None, "MODEL_NOT_READY", "A real trained candidate is required")
            require(args.get("targetRevision") == 19 and args.get("experimentUid") == "experiment_risk_19", "INVALID_ARGUMENT", "Only the isolated trained candidate can be evaluated", 400)
            require(args.get("minimumSharpeImprovement") == 0 and args.get("maximumDrawdownIncrease") == 0, "INVALID_ARGUMENT", "Financial-return gates do not apply to synthetic risk classification", 400)
            require(isinstance(args.get("testDatasetRef"), str) and 0 < len(args["testDatasetRef"]) <= 256, "INVALID_ARGUMENT", "The held-out dataset reference is required", 400)
            measurement = self.measure(state, 192, forced_revision=19, force_repaired=True)
            deployment["evaluationPassed"] = measurement["passed"]
            state["training"]["evaluation"] = measurement
            state["candidateProbe"] = measurement | {"stage": "candidate"}
            state["measurements"] = (state["measurements"] + [state["candidateProbe"]])[-30:]
            require(measurement["passed"], "EVALUATION_FAILED", "Independent candidate quality gate failed")
            state["phase"] = "EVALUATED"
        elif action == "register":
            require(deployment["evaluationPassed"], "EVALUATION_REQUIRED", "Independent candidate evaluation must pass")
            require(args.get("targetRevision") == 19 and args.get("modelCardUid") == "modelcard_risk_19", "INVALID_ARGUMENT", "Model card or revision differs", 400)
            require(args.get("experimentUid") == "experiment_risk_19", "INVALID_ARGUMENT", "Model registration must use the measured risk experiment", 400)
            path = self.directory(state["workspaceId"], state["incidentId"]) / "model-card-19.json"
            atomic_write(path, canonical({"modelCardUid": args["modelCardUid"], "sourceMode": SOURCE, "modelDigest": deployment["candidateModelDigest"], "datasetDigest": state["dataset"]["datasetDigest"], "training": state["training"], "approvalId": body["approvalId"], "planDigest": body["planDigest"]}))
            deployment.update(registered=True, modelCardDigest=file_digest(path))
            state["phase"] = "REGISTERED"
        elif action == "canary":
            require(deployment["registered"], "REGISTRATION_REQUIRED", "Candidate must be registered")
            percent, minutes = args.get("trafficPercent"), args.get("observationMinutes")
            require(type(percent) is int and 1 <= percent <= 50 and type(minutes) is int and 1 <= minutes <= 30 and args.get("targetRevision") == 19 and args.get("environment") == "CANARY", "INVALID_ARGUMENT", "Canary requires approved 1..50 percent traffic and a bounded staging window", 400)
            deployment.update(trafficPercent=percent, routeVersion=deployment["routeVersion"] + 1)
            measurement = self.measure(state, 1000)
            deployment["canary"] = {**measurement, "requestedObservationMinutes": minutes, "requestedWindowMinutes": minutes, "actualWindowMs": measurement["durationMs"], "actualDurationMs": measurement["durationMs"], "compressedWindow": True, "trafficPercent": percent}
            require(measurement["passed"] and measurement["routeCounts"].get("19", 0) > 0, "CANARY_FAILED", "Measured canary did not pass")
            state["phase"] = "CANARY_PASSED"
        elif action == "promote":
            require(deployment["canary"] is not None and deployment["canary"]["passed"], "CANARY_REQUIRED", "Actual canary samples must pass")
            require(args.get("trafficPercent") == 100 and args.get("targetRevision") == 19 and args.get("environment") == "CANARY", "INVALID_ARGUMENT", "Only approved full staging promotion is supported", 400)
            deployment.update(activeRevision=19, activeModelDigest=deployment["candidateModelDigest"], trafficPercent=100, promoted=True, routeVersion=deployment["routeVersion"] + 1)
            state["phase"] = "PROMOTED"
        elif action == "fallback-remove":
            require(deployment["promoted"] and args.get("targetRevision") == 19, "PROMOTION_REQUIRED", "Candidate must be promoted before fallback removal")
            deployment.update(fallbackFeatureActive=False, featureDimension=120 if state["failureMode"] == "post_release_contract" else 128, routeVersion=deployment["routeVersion"] + 1)
            state["phase"] = "RELEASED_AWAITING_VERIFICATION"
        elif action == "rollback":
            require(args.get("targetRevision") == 17, "ROLLBACK_TARGET_INVALID", "Rollback must restore the frozen stable revision 17", 400)
            require(args.get("verificationPolicy") == {"maxErrorRate": 0.05, "maxP95Ms": 300}, "INVALID_ARGUMENT", "Rollback verification must use the approved bounded policy", 400)
            before = {"revision": deployment["activeRevision"], "modelDigest": deployment["activeModelDigest"], "routeVersion": deployment["routeVersion"]}
            deployment.update(activeRevision=17, activeModelDigest=state["models"]["17"]["digest"], trafficPercent=0, promoted=False, fallbackFeatureActive=True, featureDimension=128, routeVersion=deployment["routeVersion"] + 1)
            measurement = self.measure(state, 192)
            require(measurement["errorRate"] <= 0.05 and measurement["p95Ms"] <= 300, "ROLLBACK_VERIFICATION_FAILED", "Frozen baseline readback failed")
            state["compensation"] = {"status": "SUCCEEDED", "before": before, "restoredRevision": 17, "restoredModelDigest": deployment["activeModelDigest"], "probe": measurement, "completedAt": utc_now(), "originalRecoveryGoalMet": False}
            state["phase"] = "COMPENSATED"
        state["latestProbe"] = self.measure(state, 192)
        stage = "compensated" if state["compensation"] is not None else "active" if deployment["promoted"] else "mitigated" if deployment["fallbackFeatureActive"] else "baseline"
        state["latestProbe"]["stage"] = stage
        state["measurements"] = (state["measurements"] + [state["latestProbe"]])[-30:]

    def measure(self, state: dict, sample_limit: int, forced_revision: int | None = None, force_repaired: bool = False) -> dict:
        """从独立持出行真实推理和计时 / Infer and time actual predictions on independent held-out rows."""
        require(type(sample_limit) is int and 1 <= sample_limit <= 2000, "SAMPLE_LIMIT", "sampleLimit must be 1..2000", 400)
        records, raw, labels = self.source_rows(state)
        indices = [i for i, row in enumerate(records) if row["split"] == "held-out"]
        deployment = state["deployment"]
        compiled = {revision: self.model(state, int(revision)) for revision in state["models"]}
        latencies, predicted, expected, routes, model_digests = [], [], [], {}, set()
        errors, started_at, started = 0, utc_now(), time.perf_counter()
        for sample in range(sample_limit):
            index = indices[sample % len(indices)]
            bucket = int(hashlib.sha256((state["incidentId"] + ":" + str(sample)).encode()).hexdigest()[:8], 16) % 100
            revision = forced_revision or (19 if bucket < deployment["trafficPercent"] else deployment["activeRevision"])
            routes[str(revision)] = routes.get(str(revision), 0) + 1
            model_digests.add(state["models"][str(revision)]["digest"])
            model = compiled[str(revision)]
            timer = time.perf_counter()
            try:
                repaired = force_repaired or deployment["fallbackFeatureActive"] or (deployment["promoted"] and state["failureMode"] != "post_release_contract")
                vector = features(raw[index:index + 1]) if repaired else raw[index:index + 1]
                probability = float(predict(model, vector)[0])
                predicted.append(probability)
                expected.append(int(labels[index]))
            except RuntimeErrorResponse as error:
                if error.code != "FEATURE_CONTRACT_MISMATCH":
                    raise
                errors += 1
            latencies.append((time.perf_counter() - timer) * 1000)
        metrics = scores(np.asarray(predicted), np.asarray(expected)) if predicted else {"accuracy": 0.0, "logLoss": None, "approvalRate": 0.0, "referenceApprovalRate": float(labels[indices].mean())}
        delta = abs(metrics["approvalRate"] - metrics["referenceApprovalRate"])
        passed = errors == 0 and metrics["accuracy"] >= 0.92 and delta <= 0.10
        recovered = passed and deployment["promoted"] and not deployment["fallbackFeatureActive"] and state["compensation"] is None
        return {"measurementId": "measurement_" + uuid.uuid4().hex, "sourceMode": SOURCE, "metricScope": "MODEL_INFERENCE_COMPUTE", "metricDescription": "Measured in-process feature transformation and model inference; not HTTP end-to-end latency or production SLO", "sampleCount": sample_limit, "uniqueSamples": min(sample_limit, len(indices)), "sampleReuse": sample_limit > len(indices), "errorCount": errors, "errorRate": errors / sample_limit, "successRate": 1 - errors / sample_limit, "p95Ms": float(np.percentile(latencies, 95)), "p99Ms": float(np.percentile(latencies, 99)), "meanMs": float(np.mean(latencies)), **metrics, "approvalRateDelta": delta, "featureContractPassed": errors == 0, "contractStatus": "MATCH" if errors == 0 else "MISMATCH", "passed": passed, "businessRecovered": recovered, "businessKpiRecovered": recovered, "recovered": recovered, "status": "RECOVERED" if recovered else "MITIGATED" if passed else "DEGRADED", "startedAt": started_at, "completedAt": utc_now(), "durationMs": round((time.perf_counter() - started) * 1000, 3), "modelDigests": sorted(model_digests), "datasetDigest": state["dataset"]["datasetDigest"] or state["dataset"]["sourceDigest"], "split": "held-out", "routeCounts": routes}

    def public(self, state: dict, include_actions: bool = True) -> dict:
        """暴露审计证据并隐藏内部文件路径 / Expose audit evidence without internal artifact paths."""
        result = copy.deepcopy({key: value for key, value in state.items() if key != "models"})
        if include_actions:
            rows = self.db.execute("SELECT receipt,status FROM actions WHERE workspace=? AND incident=? ORDER BY rowid", (state["workspaceId"], state["incidentId"])).fetchall()
            result["actions"] = [json.loads(row[0]) | {"status": row[1]} for row in rows]
        return result

    def read(self, workspace: str, incident: str, view: str = "", query: dict | None = None) -> dict:
        """读取真实域记录或生成独立测量 / Read actual domain records or create an independent measurement."""
        query = query or {}
        with self.lock:
            state = self.load(workspace, incident)
            if query.get("traceId"):
                require(query["traceId"] == state["traceId"], "TRACE_MISMATCH", "Trace differs from initialized incident", 403)
            common = {"sourceMode": SOURCE, "synthetic": True, "workspaceId": workspace, "incidentId": incident, "traceId": state["traceId"], "resourceVersions": state["resourceVersions"]}
            if view == "probe":
                measurement = self.measure(state, int(query.get("sampleLimit", 192)))
                measurement["stage"] = "compensated" if state["compensation"] else "active" if state["deployment"]["promoted"] else "mitigated" if state["deployment"]["fallbackFeatureActive"] else "baseline"
                state["latestProbe"] = measurement
                state["measurements"] = (state["measurements"] + [measurement])[-30:]
                self.save(state)
                self.db.commit()
                data = common | measurement
            elif view == "dataset":
                dataset = state["dataset"]
                valid = dataset["status"] == "PASSED"
                if valid:
                    require(file_digest(self.directory(workspace, incident) / "repaired.csv") == dataset["datasetDigest"], "DATASET_CHANGED", "Dataset artifact changed")
                data = common | dataset | {"valid": valid, "passed": valid, "schemaCompatible": valid, "reproducible": True, "datasetType": "FEATURE_DRIFT_SYNTHETIC", "timeCoverageMonths": 36}
            elif view == "deployment":
                deployment = state["deployment"]
                self.model(state, deployment["activeRevision"])
                data = common | deployment | {"trainingCompleted": state["training"] is not None and state["training"]["status"] == "SUCCEEDED", "modelRegistered": deployment["registered"], "canaryPassed": deployment["canary"] is not None and deployment["canary"]["passed"], "rollbackReady": "17" in state["models"], "inputContractStatus": state["latestProbe"]["contractStatus"], "ready": True, "passed": deployment["promoted"] and state["latestProbe"]["passed"], "modelVersion": "v" + str(deployment["activeRevision"]), "resourceVersion": state["resourceVersions"]["deploy_risk_prod"]}
            elif view == "training":
                data = common | {"training": state["training"]}
            elif view == "evidence":
                data = common | self.evidence(state, query.get("toolName", ""))
            else:
                require(view == "", "NOT_FOUND", "Unknown evidence view", 404)
                data = self.public(state)
            resource = "asset_risk_features_prod/backfill" if view == "dataset" or query.get("toolName", "").startswith("dataops.") else "experiment_risk_19" if view == "training" else "deploy_risk_prod"
            return {"data": data, "resourceVersion": state["resourceVersions"][resource], "actionReceipt": None}

    def evidence(self, state: dict, tool: str) -> dict:
        """把实时制品映射为取证工具字段 / Map real artifacts into investigation tool fields."""
        dataset = state["dataset"]
        valid = dataset["status"] == "PASSED"
        if tool == "dataops.quality.report.get":
            return {**dataset, "reportUid": "qr_risk_features_120", "status": "PASSED" if valid else "FAILED", "passed": valid, "expectedDimension": 128, "observedDimension": dataset["featureDimension"], "failedRules": [] if valid else ["feature_vector_dimension"], "observedAt": utc_now()}
        if tool == "dataops.schema.snapshot.get":
            return {"assetUid": "asset_risk_features_prod", "schemaVersion": dataset.get("schemaVersion", "synthetic-source-120"), "featureDimension": dataset["featureDimension"], "fieldCount": dataset["featureDimension"], "expectedDimension": 128, "observedDimension": dataset["featureDimension"], "schemaCompatible": valid, "fields": [{"name": "f" + str(i), "type": "float64"} for i in range(dataset["featureDimension"])], "sourceDigest": dataset["sourceDigest"], "datasetDigest": dataset["datasetDigest"]}
        if tool == "dataops.lineage.get":
            return {"assetUid": "asset_risk_features_prod", "nodes": [{"id": name, "name": name, "type": "SOURCE" if i == 0 else "TRANSFORM" if i == 1 else "MODEL"} for i, name in enumerate(dataset["lineage"])], "edges": [{"source": dataset["lineage"][i], "target": dataset["lineage"][i + 1]} for i in range(2)], "upstreamSdkVersion": "synthetic-drift-120", "rootCause": "Eight derived features omitted from the isolated source-to-serving transformation", "sourceDigest": dataset["sourceDigest"]}
        if tool == "dataops.workflow.instance.get":
            return {"instanceUid": dataset.get("workflowInstanceUid", "task_risk_features_latest"), "status": "SUCCEEDED" if valid else "NOT_STARTED", "synthetic": True, "sourceMode": SOURCE, "inputRows": dataset["inputRows"], "outputRows": dataset["outputRows"], "publishedSchemaVersion": dataset.get("schemaVersion"), "warning": None if valid else "128-dimensional model is receiving 120-dimensional isolated input", "observedAt": utc_now()}
        if tool in {"aiops.alert.get", "aiops.service.health"}:
            probe = self.measure(state, 192)
            return {**probe, "serviceUid": "service_risk_inference", "alertUid": "alert_risk_error_rate", "status": "RESOLVED" if probe["businessRecovered"] else "OPEN", "severity": "INFO" if probe["businessRecovered"] else "CRITICAL", "message": "Measured isolated feature contract recovery" if probe["businessRecovered"] else "Measured isolated 120/128 input contract drift", "processHealthy": True, "infrastructureHealthy": True, "cpuExecution": True, "observationWindow": {"startedAt": probe["startedAt"], "completedAt": probe["completedAt"]}}
        raise RuntimeErrorResponse(404, "TOOL_NOT_ALLOWED", "Unsupported read-only evidence tool")

    def list_runs(self, workspaces: list[str], workspace: str | None = None) -> dict:
        """只列出授权工作空间的运行 / List runs only inside authorized workspaces."""
        if workspace:
            require(workspace in workspaces, "WORKSPACE_FORBIDDEN", "Workspace is outside token scope", 403)
        with self.lock:
            rows = self.db.execute("SELECT state FROM runs ORDER BY rowid DESC LIMIT 200").fetchall()
            items = [self.public(json.loads(row[0])) for row in rows if json.loads(row[0])["workspaceId"] in ([workspace] if workspace else workspaces)]
            return {"data": {"items": items, "total": len(items)}, "actionReceipt": None}


def load_tokens(path: Path) -> list[dict]:
    """读取私有角色令牌文件并限制权限 / Read the private role-token file and validate permissions."""
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    entries = data.get("tokens", [])
    require(isinstance(entries, list) and 1 <= len(entries) <= 32, "TOKEN_CONFIG_INVALID", "A bounded role-token list is required", 500)
    seen = set()
    for entry in entries:
        token = entry.get("token", "")
        require(isinstance(token, str) and 32 <= len(token) <= 256 and token not in seen and entry.get("role") in ROLE_ACTIONS, "TOKEN_CONFIG_INVALID", "Role tokens must be unique and at least 32 characters", 500)
        require(isinstance(entry.get("workspaceIds"), list) and 1 <= len(entry["workspaceIds"]) <= 1000, "TOKEN_CONFIG_INVALID", "Explicit workspace scopes are required", 500)
        for workspace in entry["workspaceIds"]:
            bounded_id(workspace, "workspaceId")
        seen.add(token)
    return entries


def create_server(runtime: FeatureDriftRuntime, tokens: list[dict], host: str = "127.0.0.1", port: int = 8080) -> ThreadingHTTPServer:
    """创建内网认证HTTP接口 / Create the authenticated internal HTTP interface."""
    class Handler(BaseHTTPRequestHandler):
        """只处理固定JSON契约 / Handle only the fixed JSON contract."""

        server_version = "OpenXnetFeatureDrift/1.3.0"

        def log_message(self, format: str, *args: object) -> None:
            """避免请求、凭据或正文进入标准日志 / Keep requests, credentials, and bodies out of standard logs."""
            return

        def send_json(self, status: int, payload: dict) -> None:
            """返回有长度界限的JSON响应 / Return a JSON response with explicit length."""
            content = canonical(payload)
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(content)

        def identity(self) -> dict:
            """常量时间核验服务角色令牌 / Verify service role tokens using constant-time comparison."""
            token = self.headers.get("X-Feature-Drift-Token", "")
            for entry in tokens:
                if hmac.compare_digest(token, entry["token"]):
                    return entry
            raise RuntimeErrorResponse(401, "UNAUTHORIZED", "A valid internal service token is required")

        def handle_request(self, method: str) -> None:
            """校验方法、路径、工作空间、角色和有界正文 / Validate method, path, workspace, role, and bounded body."""
            try:
                parsed = urlparse(self.path)
                query = {key: values[0] for key, values in parse_qs(parsed.query).items()}
                if method == "GET" and parsed.path == "/health":
                    self.send_json(200, {"status": "ok", "version": __version__, "sourceMode": SOURCE, "synthetic": True})
                    return
                identity = self.identity()
                if method == "GET" and parsed.path == "/v1/incidents":
                    self.send_json(200, runtime.list_runs(identity["workspaceIds"], query.get("workspaceId")))
                    return
                parts = [unquote(part) for part in parsed.path.strip("/").split("/")]
                require(len(parts) in {3, 4, 5} and parts[:2] == ["v1", "incidents"], "NOT_FOUND", "Unknown endpoint", 404)
                incident = bounded_id(parts[2], "incidentId")
                if method == "POST":
                    require(len(parts) == 5 and parts[3] == "actions", "NOT_FOUND", "Unknown action endpoint", 404)
                    length = int(self.headers.get("Content-Length", "0"))
                    require(0 < length <= 65536, "BODY_LIMIT", "JSON body must be 1..65536 bytes", 413)
                    body = json.loads(self.rfile.read(length))
                    require(isinstance(body, dict) and body.get("incidentId", incident) == incident, "INCIDENT_MISMATCH", "Path and request incident differ", 400)
                    body["incidentId"] = incident
                    require(body.get("workspaceId") in identity["workspaceIds"], "WORKSPACE_FORBIDDEN", "Workspace is outside token scope", 403)
                    require(parts[4] in ROLE_ACTIONS[identity["role"]], "ROLE_FORBIDDEN", "Service role cannot execute this action", 403)
                    self.send_json(200, runtime.action(parts[4], body))
                else:
                    require(len(parts) in {3, 4}, "NOT_FOUND", "Unknown evidence endpoint", 404)
                    require(query.get("workspaceId") in identity["workspaceIds"], "WORKSPACE_FORBIDDEN", "Workspace is outside token scope", 403)
                    self.send_json(200, runtime.read(query["workspaceId"], incident, parts[3] if len(parts) == 4 else "", query))
            except RuntimeErrorResponse as error:
                self.send_json(error.status, {"error": str(error), "code": error.code})
            except (ValueError, TypeError, KeyError):
                self.send_json(400, {"error": "Malformed runtime request", "code": "INVALID_REQUEST"})
            except Exception:
                self.send_json(500, {"error": "Runtime execution failed; inspect the action ledger", "code": "EXECUTION_FAILED"})

        def do_GET(self) -> None:
            """分发认证读取 / Dispatch authenticated reads."""
            self.handle_request("GET")

        def do_POST(self) -> None:
            """分发认证动作 / Dispatch authenticated actions."""
            self.handle_request("POST")

    return ThreadingHTTPServer((host, port), Handler)


def main() -> None:
    """从显式私有配置启动内网运行时 / Start the internal runtime from explicit private configuration."""
    token_path = os.environ.get("FEATURE_DRIFT_TOKEN_FILE")
    require(bool(token_path), "TOKEN_CONFIG_REQUIRED", "FEATURE_DRIFT_TOKEN_FILE is required", 500)
    runtime = FeatureDriftRuntime(Path(os.environ.get("FEATURE_DRIFT_DATA_DIR", "/var/lib/openxnet-feature-drift")))
    server = create_server(runtime, load_tokens(Path(token_path)), os.environ.get("FEATURE_DRIFT_HOST", "127.0.0.1"), int(os.environ.get("FEATURE_DRIFT_PORT", "8080")))
    try:
        server.serve_forever()
    finally:
        server.server_close()
        runtime.close()


if __name__ == "__main__":
    main()
