#!/usr/bin/env node
/* -*- coding: utf-8 -*-
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 固定南向工具目录 / Fixed southbound tool catalogue.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-17
 * Version: 1.3.0 | Security Level: INTERNAL
 * __version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 * Generated from src/desktop/competition/competition-tool-registry.ts; parity is tested.
 */
"use strict";
module.exports = [
  {
    "name": "aiops.alert.get",
    "platform": "aiops",
    "path": "/api/agent/v1/tools/aiops.alert.get:invoke",
    "requiresApproval": false,
    "timeoutMs": 3000,
    "inputSchema": {
      "type": "object",
      "oneOf": [
        {
          "required": [
            "alertId"
          ]
        },
        {
          "required": [
            "alertUid"
          ]
        }
      ],
      "properties": {
        "alertId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "alertUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "aiops.service.health",
    "platform": "aiops",
    "path": "/api/agent/v1/tools/aiops.service.health:invoke",
    "requiresApproval": false,
    "timeoutMs": 5000,
    "inputSchema": {
      "type": "object",
      "required": [
        "serviceUid"
      ],
      "properties": {
        "serviceUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "windowMinutes": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1440
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "aiops.k8s.workload.get",
    "platform": "aiops",
    "path": "/api/agent/v1/tools/aiops.k8s.workload.get:invoke",
    "requiresApproval": false,
    "timeoutMs": 8000,
    "inputSchema": {
      "type": "object",
      "required": [
        "clusterId",
        "namespace",
        "kind",
        "name"
      ],
      "properties": {
        "clusterId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "namespace": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "kind": {
          "type": "string",
          "enum": [
            "Deployment",
            "StatefulSet",
            "DaemonSet"
          ]
        },
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "windowMinutes": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1440
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "aiops.inference.metrics.get",
    "platform": "aiops",
    "path": "/api/agent/v1/tools/aiops.inference.metrics.get:invoke",
    "requiresApproval": false,
    "timeoutMs": 5000,
    "inputSchema": {
      "type": "object",
      "required": [
        "serviceUid",
        "deploymentUid"
      ],
      "properties": {
        "serviceUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "deploymentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "windowMinutes": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1440
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "aiops.inference.recovery.status",
    "platform": "aiops",
    "path": "/api/agent/v1/tools/aiops.inference.recovery.status:invoke",
    "requiresApproval": false,
    "timeoutMs": 5000,
    "inputSchema": {
      "type": "object",
      "required": [
        "serviceUid",
        "deploymentUid"
      ],
      "properties": {
        "serviceUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "deploymentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "aiops.gpu.capacity.ensure",
    "platform": "aiops",
    "path": "/api/agent/v1/tools/aiops.gpu.capacity.ensure:invoke",
    "requiresApproval": true,
    "timeoutMs": 20000,
    "inputSchema": {
      "type": "object",
      "required": [
        "clusterId",
        "nodePool",
        "desiredGpuNodes",
        "mode"
      ],
      "properties": {
        "clusterId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "nodePool": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "desiredGpuNodes": {
          "type": "integer",
          "minimum": 1,
          "maximum": 64
        },
        "mode": {
          "type": "string",
          "enum": [
            "ENSURE",
            "CONVERGE"
          ]
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "aiops.inference.runtime.tune",
    "platform": "aiops",
    "path": "/api/agent/v1/tools/aiops.inference.runtime.tune:invoke",
    "requiresApproval": true,
    "timeoutMs": 15000,
    "inputSchema": {
      "type": "object",
      "required": [
        "deploymentUid",
        "maxBatchSize",
        "duplicateWindowMs",
        "engineProfile"
      ],
      "properties": {
        "deploymentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "maxBatchSize": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1024
        },
        "duplicateWindowMs": {
          "type": "integer",
          "minimum": 0,
          "maximum": 10000
        },
        "engineProfile": {
          "type": "string",
          "enum": [
            "BASELINE",
            "DYNAMIC_SHAPE_OPTIMIZED"
          ]
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "aiops.inference.capacity.apply",
    "platform": "aiops",
    "path": "/api/agent/v1/tools/aiops.inference.capacity.apply:invoke",
    "requiresApproval": true,
    "timeoutMs": 15000,
    "inputSchema": {
      "type": "object",
      "required": [
        "clusterId",
        "namespace",
        "name",
        "desiredReplicas",
        "maxBatchSize"
      ],
      "properties": {
        "clusterId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "namespace": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "desiredReplicas": {
          "type": "integer",
          "minimum": 1,
          "maximum": 200
        },
        "maxBatchSize": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1024
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "aiops.inference.traffic.shift",
    "platform": "aiops",
    "path": "/api/agent/v1/tools/aiops.inference.traffic.shift:invoke",
    "requiresApproval": true,
    "timeoutMs": 15000,
    "inputSchema": {
      "type": "object",
      "required": [
        "serviceUid",
        "target",
        "percentages"
      ],
      "properties": {
        "serviceUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "target": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "percentages": {
          "type": "array",
          "minItems": 1,
          "maxItems": 8,
          "items": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100
          }
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "aiops.inference.autoscaling.policy.update",
    "platform": "aiops",
    "path": "/api/agent/v1/tools/aiops.inference.autoscaling.policy.update:invoke",
    "requiresApproval": true,
    "timeoutMs": 10000,
    "inputSchema": {
      "type": "object",
      "required": [
        "clusterId",
        "namespace",
        "name",
        "queueDepthTarget",
        "p99TargetMs",
        "minReplicas",
        "maxReplicas"
      ],
      "properties": {
        "clusterId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "namespace": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "queueDepthTarget": {
          "type": "integer",
          "minimum": 0,
          "maximum": 100000
        },
        "p99TargetMs": {
          "type": "integer",
          "minimum": 1,
          "maximum": 60000
        },
        "minReplicas": {
          "type": "integer",
          "minimum": 1,
          "maximum": 200
        },
        "maxReplicas": {
          "type": "integer",
          "minimum": 1,
          "maximum": 200
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "aiops.inference.capacity.converge",
    "platform": "aiops",
    "path": "/api/agent/v1/tools/aiops.inference.capacity.converge:invoke",
    "requiresApproval": true,
    "timeoutMs": 15000,
    "inputSchema": {
      "type": "object",
      "required": [
        "clusterId",
        "namespace",
        "name",
        "stableReplicas",
        "maxBatchSize",
        "observationMinutes"
      ],
      "properties": {
        "clusterId": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "namespace": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "stableReplicas": {
          "type": "integer",
          "minimum": 1,
          "maximum": 200
        },
        "maxBatchSize": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1024
        },
        "observationMinutes": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1440
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "dataops.quality.report.get",
    "platform": "dataops",
    "path": "/api/agent/v1/tools/dataops.quality.report.get:invoke",
    "requiresApproval": false,
    "timeoutMs": 5000,
    "inputSchema": {
      "type": "object",
      "required": [
        "reportUid"
      ],
      "properties": {
        "reportUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "dataops.schema.snapshot.get",
    "platform": "dataops",
    "path": "/api/agent/v1/tools/dataops.schema.snapshot.get:invoke",
    "requiresApproval": false,
    "timeoutMs": 5000,
    "inputSchema": {
      "type": "object",
      "required": [
        "assetUid"
      ],
      "properties": {
        "assetUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "schemaVersion": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "observedAt": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "dataops.lineage.get",
    "platform": "dataops",
    "path": "/api/agent/v1/tools/dataops.lineage.get:invoke",
    "requiresApproval": false,
    "timeoutMs": 8000,
    "inputSchema": {
      "type": "object",
      "required": [
        "assetUid",
        "direction",
        "depth"
      ],
      "properties": {
        "assetUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "direction": {
          "type": "string",
          "enum": [
            "UPSTREAM",
            "DOWNSTREAM",
            "BOTH"
          ]
        },
        "depth": {
          "type": "integer",
          "minimum": 1,
          "maximum": 5
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "dataops.workflow.instance.get",
    "platform": "dataops",
    "path": "/api/agent/v1/tools/dataops.workflow.instance.get:invoke",
    "requiresApproval": false,
    "timeoutMs": 5000,
    "inputSchema": {
      "type": "object",
      "required": [
        "instanceUid"
      ],
      "properties": {
        "instanceUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "includeLogSummary": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "dataops.training.dataset.build",
    "platform": "dataops",
    "path": "/api/agent/v1/tools/dataops.training.dataset.build:invoke",
    "requiresApproval": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "workflowInstanceUid",
        "datasetUid",
        "historyYears",
        "addedFactors",
        "removedFactors"
      ],
      "properties": {
        "workflowInstanceUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "datasetUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "historyYears": {
          "type": "integer",
          "minimum": 1,
          "maximum": 20
        },
        "addedFactors": {
          "type": "array",
          "maxItems": 32,
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 512
          }
        },
        "removedFactors": {
          "type": "array",
          "maxItems": 32,
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 512
          }
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "dataops.feature.backfill.start",
    "platform": "dataops",
    "path": "/api/agent/v1/tools/dataops.feature.backfill.start:invoke",
    "requiresApproval": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "assetUid",
        "workflowInstanceUid",
        "historyMonths",
        "targetSchemaVersion",
        "outputDatasetUid"
      ],
      "properties": {
        "assetUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "workflowInstanceUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "historyMonths": {
          "type": "integer",
          "minimum": 1,
          "maximum": 120
        },
        "targetSchemaVersion": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "outputDatasetUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "dataops.dataset.validation.get",
    "platform": "dataops",
    "path": "/api/agent/v1/tools/dataops.dataset.validation.get:invoke",
    "requiresApproval": false,
    "timeoutMs": 8000,
    "inputSchema": {
      "type": "object",
      "required": [
        "datasetUid"
      ],
      "properties": {
        "datasetUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "mlops.deployment.get",
    "platform": "mlops",
    "path": "/api/agent/v1/tools/mlops.deployment.get:invoke",
    "requiresApproval": false,
    "timeoutMs": 5000,
    "inputSchema": {
      "type": "object",
      "required": [
        "deploymentUid"
      ],
      "properties": {
        "deploymentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "includeRevisions": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "mlops.attribution.report.get",
    "platform": "mlops",
    "path": "/api/agent/v1/tools/mlops.attribution.report.get:invoke",
    "requiresApproval": false,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "deploymentUid",
        "reportUid"
      ],
      "properties": {
        "deploymentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "reportUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "mlops.inference.probe",
    "platform": "mlops",
    "path": "/api/agent/v1/tools/mlops.inference.probe:invoke",
    "requiresApproval": false,
    "timeoutMs": 60000,
    "inputSchema": {
      "type": "object",
      "required": [
        "deploymentUid",
        "testDatasetRef",
        "sampleLimit"
      ],
      "properties": {
        "deploymentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "testDatasetRef": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "sampleLimit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1000
        },
        "timeoutMs": {
          "type": "integer",
          "minimum": 100,
          "maximum": 60000
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "mlops.model.iteration.start",
    "platform": "mlops",
    "path": "/api/agent/v1/tools/mlops.model.iteration.start:invoke",
    "requiresApproval": true,
    "timeoutMs": 15000,
    "inputSchema": {
      "type": "object",
      "required": [
        "deploymentUid",
        "workflowInstanceUid",
        "datasetRef",
        "targetRevision"
      ],
      "properties": {
        "deploymentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "workflowInstanceUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "datasetRef": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "targetRevision": {
          "type": "integer",
          "minimum": 1
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "mlops.feature.pipeline.publish",
    "platform": "mlops",
    "path": "/api/agent/v1/tools/mlops.feature.pipeline.publish:invoke",
    "requiresApproval": true,
    "timeoutMs": 15000,
    "inputSchema": {
      "type": "object",
      "required": [
        "deploymentUid",
        "datasetUid",
        "pipelineUid",
        "addedFeatures",
        "removedFeatures"
      ],
      "properties": {
        "deploymentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "datasetUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "pipelineUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "addedFeatures": {
          "type": "array",
          "maxItems": 64,
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 512
          }
        },
        "removedFeatures": {
          "type": "array",
          "maxItems": 64,
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 512
          }
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "mlops.training.search.start",
    "platform": "mlops",
    "path": "/api/agent/v1/tools/mlops.training.search.start:invoke",
    "requiresApproval": true,
    "timeoutMs": 30000,
    "inputSchema": {
      "type": "object",
      "required": [
        "deploymentUid",
        "datasetUid",
        "experimentUid",
        "targetRevision",
        "trialCount",
        "architectures",
        "mode"
      ],
      "properties": {
        "deploymentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "datasetUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "experimentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "targetRevision": {
          "type": "integer",
          "minimum": 1
        },
        "trialCount": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "architectures": {
          "type": "array",
          "minItems": 1,
          "maxItems": 16,
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 512
          }
        },
        "mode": {
          "type": "string",
          "enum": [
            "ITERATION",
            "RETRAIN"
          ]
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "mlops.model.evaluation.run",
    "platform": "mlops",
    "path": "/api/agent/v1/tools/mlops.model.evaluation.run:invoke",
    "requiresApproval": false,
    "timeoutMs": 60000,
    "inputSchema": {
      "type": "object",
      "required": [
        "deploymentUid",
        "experimentUid",
        "targetRevision",
        "testDatasetRef",
        "minimumSharpeImprovement",
        "maximumDrawdownIncrease"
      ],
      "properties": {
        "deploymentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "experimentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "targetRevision": {
          "type": "integer",
          "minimum": 1
        },
        "testDatasetRef": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "minimumSharpeImprovement": {
          "type": "number",
          "minimum": 0,
          "maximum": 10
        },
        "maximumDrawdownIncrease": {
          "type": "number",
          "minimum": -1,
          "maximum": 1
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "mlops.model.register",
    "platform": "mlops",
    "path": "/api/agent/v1/tools/mlops.model.register:invoke",
    "requiresApproval": true,
    "timeoutMs": 15000,
    "inputSchema": {
      "type": "object",
      "required": [
        "deploymentUid",
        "experimentUid",
        "targetRevision",
        "modelCardUid"
      ],
      "properties": {
        "deploymentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "experimentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "targetRevision": {
          "type": "integer",
          "minimum": 1
        },
        "modelCardUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "mlops.feature.fallback.apply",
    "platform": "mlops",
    "path": "/api/agent/v1/tools/mlops.feature.fallback.apply:invoke",
    "requiresApproval": true,
    "timeoutMs": 10000,
    "inputSchema": {
      "type": "object",
      "required": [
        "deploymentUid",
        "featureSetUid",
        "reasonCode"
      ],
      "properties": {
        "deploymentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "featureSetUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "reasonCode": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "mlops.feature.fallback.remove",
    "platform": "mlops",
    "path": "/api/agent/v1/tools/mlops.feature.fallback.remove:invoke",
    "requiresApproval": true,
    "timeoutMs": 10000,
    "inputSchema": {
      "type": "object",
      "required": [
        "deploymentUid",
        "featureSetUid",
        "targetRevision"
      ],
      "properties": {
        "deploymentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "featureSetUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "targetRevision": {
          "type": "integer",
          "minimum": 1
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "mlops.deployment.canary.apply",
    "platform": "mlops",
    "path": "/api/agent/v1/tools/mlops.deployment.canary.apply:invoke",
    "requiresApproval": true,
    "timeoutMs": 15000,
    "inputSchema": {
      "type": "object",
      "required": [
        "deploymentUid",
        "targetRevision",
        "trafficPercent",
        "environment",
        "observationMinutes"
      ],
      "properties": {
        "deploymentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "targetRevision": {
          "type": "integer",
          "minimum": 1
        },
        "trafficPercent": {
          "type": "integer",
          "minimum": 1,
          "maximum": 50
        },
        "environment": {
          "type": "string",
          "enum": [
            "SIMULATION",
            "SHADOW",
            "CANARY"
          ]
        },
        "observationMinutes": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1440
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "mlops.deployment.promote",
    "platform": "mlops",
    "path": "/api/agent/v1/tools/mlops.deployment.promote:invoke",
    "requiresApproval": true,
    "timeoutMs": 15000,
    "inputSchema": {
      "type": "object",
      "required": [
        "deploymentUid",
        "targetRevision",
        "trafficPercent",
        "environment"
      ],
      "properties": {
        "deploymentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "targetRevision": {
          "type": "integer",
          "minimum": 1
        },
        "trafficPercent": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "environment": {
          "type": "string",
          "enum": [
            "SIMULATION",
            "SHADOW",
            "CANARY"
          ]
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "mlops.release.validation.get",
    "platform": "mlops",
    "path": "/api/agent/v1/tools/mlops.release.validation.get:invoke",
    "requiresApproval": false,
    "timeoutMs": 8000,
    "inputSchema": {
      "type": "object",
      "required": [
        "deploymentUid",
        "targetRevision"
      ],
      "properties": {
        "deploymentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "targetRevision": {
          "type": "integer",
          "minimum": 1
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "mlops.deployment.rollback",
    "platform": "mlops",
    "path": "/api/agent/v1/tools/mlops.deployment.rollback:invoke",
    "requiresApproval": true,
    "timeoutMs": 10000,
    "inputSchema": {
      "type": "object",
      "required": [
        "deploymentUid",
        "targetRevision",
        "verificationPolicy"
      ],
      "properties": {
        "deploymentUid": {
          "type": "string",
          "minLength": 1,
          "maxLength": 512
        },
        "targetRevision": {
          "type": "integer",
          "minimum": 1
        },
        "verificationPolicy": {
          "type": "object",
          "required": [
            "maxErrorRate",
            "maxP95Ms"
          ],
          "properties": {
            "maxErrorRate": {
              "type": "number",
              "minimum": 0,
              "maximum": 1
            },
            "maxP95Ms": {
              "type": "integer",
              "minimum": 1
            }
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    }
  }
];
