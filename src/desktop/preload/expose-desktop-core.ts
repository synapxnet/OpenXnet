import { DESKTOP_CORE_CHANNELS } from "../contracts/channels";
import {
  APPLICATION_AUTH_CHANNELS,
  type ApplicationAuthSnapshot,
  type SaveApplicationAuthSessionRequest,
} from "../contracts/application-auth";
import {
  APPLICATION_ACCESS_CHANNELS,
  type ApplicationAccessRequest,
  type ApplicationAccessResult,
} from "../contracts/application-access";
import {
  APPLICATION_SYSTEM_RUNTIME_CHANNELS,
  type ApplicationSystemNetworkAddressResult,
  type ApplyApplicationSystemProxyResult,
  type RevealApplicationSystemDirectoryRequest,
  type RevealApplicationSystemDirectoryResult,
} from "../contracts/application-system-runtime";
import {
  APPLICATION_SEARCH_CREDENTIAL_CHANNELS,
  type ApplicationSearchCredentialSnapshot,
  type SaveApplicationSearchCredentialsRequest,
} from "../contracts/application-search-credentials";
import {
  APPLICATION_VOICE_CREDENTIAL_CHANNELS,
  type ApplicationVoiceCredentialSnapshot,
  type SaveApplicationVoiceCredentialsRequest,
} from "../contracts/application-voice-credentials";
import {
  APPLICATION_VOICE_RUNTIME_CHANNELS,
  type ApplicationVoiceReferenceResult,
  type ApplicationVoiceCatalogResult,
  type ApplicationVoiceProviderCatalogRequest,
  type ApplicationVoiceSynthesisRequest,
  type ApplicationVoiceSynthesisResult,
  type ApplicationVoiceTranscriptionRequest,
  type ApplicationVoiceTranscriptionResult,
  type RemoveApplicationVoiceReferenceRequest,
  type RemoveApplicationVoiceReferenceResult,
  type RendererApplicationVoiceReferenceFile,
} from "../contracts/application-voice-runtime";
import {
  APPLICATION_VRM_PRESENTATION_CHANNELS,
  type ApplicationVrmPresentationPublishRequest,
  type ApplicationVrmPresentationPublishResult,
  type ApplicationVrmPresentationStatus,
} from "../contracts/application-vrm-presentation-runtime";
import {
  APPLICATION_MCP_CREDENTIAL_CHANNELS,
  type ApplicationMcpCredentialSnapshot,
  type SaveApplicationMcpCredentialsRequest,
} from "../contracts/application-mcp-credentials";
import {
  APPLICATION_MCP_RUNTIME_CHANNELS,
  type ApplicationMcpRuntimeIntegrationRequest,
  type ApplicationMcpRuntimeResult,
  type ApplicationMcpRuntimeStartRequest,
  type ApplicationMcpRuntimeToolsResult,
} from "../contracts/application-mcp-runtime";
import {
  APPLICATION_HTTP_TOOL_CREDENTIAL_CHANNELS,
  type ApplicationHttpToolCredentialSnapshot,
  type SaveApplicationHttpToolCredentialsRequest,
} from "../contracts/application-http-tool-credentials";
import {
  APPLICATION_CONNECTOR_CREDENTIAL_CHANNELS,
  type ApplicationConnectorCredentialSnapshot,
  type SaveApplicationConnectorCredentialsRequest,
} from "../contracts/application-connector-credentials";
import {
  APPLICATION_CONNECTOR_RUNTIME_CHANNELS,
  type ApplicationConnectorRuntimeMutationRequest,
  type ApplicationConnectorRuntimePlatformRequest,
  type ApplicationConnectorRuntimeResult,
} from "../contracts/application-connector-runtime";
import {
  APPLICATION_TELEGRAM_CREDENTIAL_CHANNELS,
  type ApplicationTelegramCredentialSnapshot,
  type SaveApplicationTelegramCredentialsRequest,
} from "../contracts/application-telegram-credentials";
import {
  APPLICATION_IMAGE_HOST_CREDENTIAL_CHANNELS,
  type ApplicationImageHostCredentialSnapshot,
  type SaveApplicationImageHostCredentialsRequest,
} from "../contracts/application-image-host-credentials";
import {
  APPLICATION_REPOSITORY_CREDENTIAL_CHANNELS,
  type ApplicationRepositoryCredentialSnapshot,
  type SaveApplicationRepositoryCredentialsRequest,
} from "../contracts/application-repository-credentials";
import {
  APPLICATION_LIVE_PLATFORM_CREDENTIAL_CHANNELS,
  type ApplicationLivePlatformCredentialSnapshot,
  type SaveApplicationLivePlatformCredentialsRequest,
} from "../contracts/application-live-platform-credentials";
import {
  APPLICATION_LIVE_RUNTIME_CHANNELS,
  type ApplicationLiveRuntimeEvent,
  type ApplicationLiveRuntimeEventListener,
  type ApplicationLiveRuntimeMutationRequest,
  type ApplicationLiveRuntimeResult,
} from "../contracts/application-live-runtime";
import {
  APPLICATION_CODE_SANDBOX_CREDENTIAL_CHANNELS,
  type ApplicationCodeSandboxCredentialSnapshot,
  type SaveApplicationCodeSandboxCredentialsRequest,
} from "../contracts/application-code-sandbox-credentials";
import {
  APPLICATION_HOME_ASSISTANT_CREDENTIAL_CHANNELS,
  type ApplicationHomeAssistantCredentialSnapshot,
  type SaveApplicationHomeAssistantCredentialsRequest,
} from "../contracts/application-home-assistant-credentials";
import {
  APPLICATION_SQL_CREDENTIAL_CHANNELS,
  type ApplicationSqlCredentialSnapshot,
  type SaveApplicationSqlCredentialsRequest,
} from "../contracts/application-sql-credentials";
import {
  APPLICATION_COMFYUI_CREDENTIAL_CHANNELS,
  type ApplicationComfyUiCredentialSnapshot,
  type SaveApplicationComfyUiCredentialsRequest,
} from "../contracts/application-comfyui-credentials";
import {
  APPLICATION_DELIVERY_CREDENTIAL_CHANNELS,
  type ApplicationDeliveryCredentialSnapshot,
  type SaveApplicationDeliveryCredentialsRequest,
} from "../contracts/application-delivery-credentials";
import {
  APPLICATION_ARTIFACT_CHANNELS,
  MAX_RENDERER_INLINE_ARTIFACT_BATCH_BYTES,
  MAX_RENDERER_INLINE_ARTIFACT_BYTES,
  type ApplicationArtifactSnapshot,
  type ApplicationArtifactWriteResult,
  type DeleteApplicationArtifactsRequest,
  type DeleteApplicationArtifactsResult,
  type ImportApplicationArtifactsRequest,
  type ListApplicationArtifactsRequest,
  type RendererApplicationArtifactFile,
  type RegisterApplicationArtifactsRequest,
} from "../contracts/application-artifacts";
import {
  APPLICATION_VR_ASSET_CHANNELS,
  MAX_INLINE_VR_ASSET_BYTES,
  type ApplicationVrAssetCatalog,
  type ApplicationVrAssetDeleteResult,
  type ApplicationVrAssetWriteResult,
  type DeleteApplicationVrAssetRequest,
  type DownloadApplicationCloudVrmModelRequest,
  type RendererImportApplicationVrAssetRequest,
} from "../contracts/application-vr-assets";
import {
  APPLICATION_EXTENSION_RUNTIME_CHANNELS,
  MAX_INLINE_EXTENSION_ARCHIVE_BYTES,
  type ApplicationExtensionCatalog,
  type ApplicationExtensionIdRequest,
  type ApplicationExtensionMutationResult,
  type ApplicationExtensionStartResult,
  type ApplicationExtensionWriteResult,
  type ApplicationRemoteExtensionCatalog,
  type InstallApplicationExtensionRepositoryRequest,
  type RendererImportApplicationExtensionArchiveRequest,
} from "../contracts/application-extensions-runtime";
import {
  APPLICATION_SKILL_RUNTIME_CHANNELS,
  MAX_INLINE_SKILL_ARCHIVE_BYTES,
  type ApplicationProjectSkillStatus,
  type ApplicationSkillCatalog,
  type ApplicationSkillContentResult,
  type ApplicationSkillDirectoryResult,
  type ApplicationSkillIdRequest,
  type ApplicationSkillMlopsUploadResult,
  type ApplicationSkillMutationResult,
  type ApplicationSkillWriteResult,
  type CrystallizeApplicationSkillRequest,
  type InstallApplicationSkillRepositoryRequest,
  type RendererImportApplicationSkillArchiveRequest,
  type SyncApplicationSkillProjectRequest,
  type UploadApplicationSkillToMlopsRequest,
} from "../contracts/application-skills-runtime";
import {
  APPLICATION_ENTERPRISE_RUNTIME_CHANNELS,
  type ApplicationEnterpriseKnowledgeBaseListResult,
  type ApplicationEnterpriseKnowledgeBaseRequest,
  type ApplicationEnterpriseKnowledgeBaseVersionListResult,
  type ApplicationEnterpriseKnowledgeBaseWriteResult,
  type ApplicationEnterpriseMessageListResult,
  type ApplicationEnterpriseMessageWriteResult,
  type ApplicationEnterpriseProjectListResult,
  type ApplicationEnterpriseProjectRequest,
  type ApplicationEnterpriseProjectWriteResult,
  type ApplicationEnterpriseRemoveResult,
  type ApplicationEnterpriseRoleCardListResult,
  type ApplicationEnterpriseRoleCardRequest,
  type ApplicationEnterpriseRoleCardWriteResult,
  type ApplicationEnterpriseSandboxStateResult,
  type ApplicationEnterpriseSkillBindingListResult,
  type ApplicationEnterpriseSkillBindingWriteResult,
  type ApplicationEnterpriseTeamTemplateListResult,
  type ApplicationEnterpriseTeamTemplateRequest,
  type ApplicationEnterpriseTeamTemplateWriteResult,
  type ApplicationEnterpriseWorkspaceListResult,
  type ApplicationEnterpriseWorkspaceRequest,
  type ApplicationEnterpriseWorkspaceWriteResult,
  type ApplicationEnterpriseXnetServiceListResult,
  type ApplicationEnterpriseXnetServiceRequest,
  type ApplicationEnterpriseXnetServiceWriteResult,
  type CheckAllApplicationEnterpriseXnetServicesRequest,
  type ListApplicationEnterpriseMessagesRequest,
  type PostApplicationEnterpriseMessageRequest,
  type SaveApplicationEnterpriseKnowledgeBaseRequest,
  type SaveApplicationEnterpriseProjectRequest,
  type SaveApplicationEnterpriseRoleCardRequest,
  type SaveApplicationEnterpriseTeamTemplateRequest,
  type SaveApplicationEnterpriseWorkspaceRequest,
  type SetApplicationEnterpriseSkillBindingRequest,
  type SaveApplicationEnterpriseXnetServiceRequest,
} from "../contracts/application-enterprise-runtime";
import {
  APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS,
  type ApplicationEnterpriseKnowledgeGraphEntityRequest,
  type ApplicationEnterpriseKnowledgeGraphEntityResult,
  type ApplicationEnterpriseKnowledgeGraphRequest,
  type ApplicationEnterpriseKnowledgeGraphResult,
  type ApplicationEnterpriseNeuroDashboardRequest,
  type ApplicationEnterpriseNeuroDashboardResult,
  type ApplicationEnterpriseNeuroMaintenanceResult,
  type ApplicationEnterpriseNeuroRemoveResult,
  type ApplicationEnterpriseNeuroSearchRequest,
  type ApplicationEnterpriseNeuroSearchResult,
  type ApplicationEnterpriseNeuroSymbolRequest,
  type ApplicationEnterpriseUsageDashboardRequest,
  type ApplicationEnterpriseUsageDashboardResult,
} from "../contracts/application-enterprise-insights-runtime";
import {
  APPLICATION_KERNEL_RUNTIME_CHANNELS,
  type ApplicationKernelCommandRequest,
  type ApplicationKernelCommandResult,
} from "../contracts/application-kernel-runtime";
import {
  APPLICATION_MODEL_ASSET_CHANNELS,
  type ApplicationModelAssetProgressEvent,
  type ApplicationModelAssetProgressListener,
  type ApplicationModelAssetRequest,
  type ApplicationModelAssetStatus,
  type DownloadApplicationModelAssetRequest,
} from "../contracts/application-model-assets";
import {
  APPLICATION_TASK_CHANNELS,
  type ApplicationTask,
  type ApplicationTaskDetail,
  type ApplicationTaskSnapshot,
  type CreateApplicationTaskRequest,
  type GetApplicationTaskRequest,
  type ListApplicationTasksRequest,
} from "../contracts/application-tasks";
import {
  APPLICATION_TASK_EXECUTION_CHANNELS,
  type ApplicationTaskExecutionDetail,
  type ApplicationTaskExecutionListener,
  type ApplicationTaskExecutionRequest,
  type ApplicationTaskExecutionSnapshot,
  type CreateDeveloperWorkbenchTaskExecutionRequest,
  type RefreshApplicationTaskExecutionsRequest,
  type ResumeApplicationTaskExecutionRequest,
  type StartApplicationTaskExecutionRequest,
} from "../contracts/application-task-execution";
import {
  APPLICATION_CHAT_CHANNELS,
  type AbortApplicationChatRequest,
  type ApplicationChatResponse,
  type ApplicationChatStreamAcknowledgement,
  type ApplicationChatStreamEvent,
  type ApplicationChatStreamListener,
  type CompleteApplicationChatRequest,
  type ExecuteApplicationChatToolRequest,
  type ResolveApplicationChatApprovalRequest,
  type StartApplicationChatStreamRequest,
} from "../contracts/application-chat";
import {
  APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS,
  type ApplicationKnowledgeBaseMutationResult,
  type ApplicationKnowledgeBaseQueryRequest,
  type ApplicationKnowledgeBaseQueryResult,
  type ApplicationKnowledgeBaseScopeRequest,
  type ApplicationKnowledgeBaseStatus,
} from "../contracts/application-knowledge-base-runtime";
import {
  APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS,
  type ApplicationDesktopControlActionRequest,
  type ApplicationDesktopControlActionResult,
  type ApplicationDesktopControlActiveWindowResult,
  type ApplicationDesktopControlHistoryRequest,
  type ApplicationDesktopControlHistoryResult,
  type ApplicationDesktopControlMonitorListResult,
  type ApplicationDesktopControlWindowListRequest,
  type ApplicationDesktopControlWindowListResult,
} from "../contracts/application-desktop-control-runtime";
import {
  APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS,
  type ApplicationDockerContainerListResult,
  type ApplicationDockerContainerMutationRequest,
  type ApplicationDockerImagePullRequest,
  type ApplicationDockerMutationResult,
  type ApplicationToolchainProbeRequest,
  type ApplicationToolchainProbeResult,
} from "../contracts/application-toolchain-runtime";
import {
  APPLICATION_DEVELOPER_WORKBENCH_CHANNELS,
  type ApplyDeveloperWorkbenchMappingRequest,
  type ApplyDeveloperWorkbenchMappingResult,
  type ApplyDeveloperWorkbenchWorkspaceRequest,
  type ApplyDeveloperWorkbenchWorkspaceResult,
  type CreateDeveloperWorkbenchSnapshotRequest,
  type DeveloperWorkbenchCodeSearchRequest,
  type DeveloperWorkbenchCodeSearchResult,
  type DeveloperWorkbenchOverview,
  type DeveloperWorkbenchRepositoriesResult,
  type DeveloperWorkbenchSnapshotDocumentResult,
  type DeveloperWorkbenchSnapshotListResult,
  type DeveloperWorkbenchSnapshotMutationResult,
  type DeveloperWorkbenchSnapshotRequest,
  type DeveloperWorkbenchSnapshotWriteResult,
  type ImportDeveloperWorkbenchSnapshotRequest,
} from "../contracts/application-developer-workbench-runtime";
import {
  APPLICATION_RECALL_RUNTIME_CHANNELS,
  type ApplicationRecallBootstrapResult,
  type ApplicationRecallObservationFocusRequest,
  type ApplicationRecallObservationFocusResult,
  type ApplicationRecallObservationsRequest,
  type ApplicationRecallObservationsResult,
  type ApplicationRecallResumeRequest,
  type ApplicationRecallResumeResult,
  type ApplicationRecallRollbackRequest,
  type ApplicationRecallRollbackResult,
  type ApplicationRecallSearchRequest,
  type ApplicationRecallSearchResult,
  type ApplicationRecallTimelineRequest,
  type ApplicationRecallTimelineResult,
} from "../contracts/application-recall-runtime";
import {
  APPLICATION_PROVIDER_CHANNELS,
  type ApplicationProviderEmbeddingProbeResult,
  type ApplicationProviderSnapshot,
  type ApplicationProviderValidationResult,
  type ProbeApplicationProviderEmbeddingRequest,
  type SaveApplicationProvidersRequest,
  type ValidateApplicationProviderRequest,
} from "../contracts/application-providers";
import {
  APPLICATION_AGENT_RUNTIME_CHANNELS,
  type ApplicationA2aInspectionResult,
  type ApplicationAgentMutationResult,
  type CreateApplicationAgentRequest,
  type InspectApplicationA2aRequest,
  type RemoveApplicationAgentRequest,
} from "../contracts/application-agent-runtime";
import {
  APPLICATION_MEMORY_MANAGEMENT_CHANNELS,
  type ApplicationMemoryCollectionRequest,
  type ApplicationMemoryMutationResult,
  type ApplicationMemoryRecordListResult,
  type ApplicationMemoryRecordRequest,
  type UpdateApplicationMemoryRecordRequest,
} from "../contracts/application-memory-management-runtime";
import {
  APPLICATION_SYNAPXNET_MEMORY_CHANNELS,
  type CreateSynapxnetMemoryRequest,
  type EditSynapxnetMemoryRequest,
  type ExportSynapxnetMemoriesRequest,
  type ImportSynapxnetMemoriesRequest,
  type ListSynapxnetMemoriesRequest,
  type RecoverSynapxnetMemoriesRequest,
  type RollbackSynapxnetMemoryRequest,
  type RetireSynapxnetMemoryRequest,
  type SynapxnetMemoryHistoryResult,
  type SynapxnetMemoryIdentityRequest,
  type SynapxnetMemoryImportResult,
  type SynapxnetMemoryIntegrityResult,
  type SynapxnetMemoryListResult,
  type SynapxnetMemoryRecord,
  type SynapxnetMemoryRecoveryResult,
  type SynapxnetMemoryStatusResult,
  type SynapxnetMemoryTransferDocument,
  type VerifySynapxnetMemoryRequest,
} from "../contracts/application-synapxnet-memory-runtime";
import {
  LEGACY_RENDERER_STATE_CHANNELS,
  type LegacyRendererStateChangedEvent,
  type LegacyRendererStateChangedListener,
  type LegacyRendererStateSnapshot,
  type SaveLegacyRendererConversationsRequest,
  type SaveLegacyRendererSettingsRequest,
  type SaveLegacyRendererVrmConfigRequest,
} from "../contracts/legacy-renderer-state";
import {
  DESKTOP_BOOTSTRAP_CHANNEL,
  type DesktopBootstrapSnapshot,
} from "../contracts/desktop-bootstrap";
import type {
  CapabilitySnapshot,
  DesktopCoreSnapshot,
  DesktopCoreStateListener,
  EnsureCapabilityRequest,
  OpenXnetDesktopApi,
} from "../contracts/capability";
import type {
  FeaturePackDistributionSnapshot,
  FeaturePackMutationResult,
  FeaturePackProgressEvent,
  FeaturePackProgressListener,
  ListFeaturePacksRequest,
  MutateFeaturePackRequest,
} from "../contracts/feature-pack-distribution";

/** Minimal context bridge surface used to publish the typed API. */
export interface ContextBridgeLike {
  exposeInMainWorld(apiKey: string, api: unknown): void;
}

/** Minimal IPC Renderer surface used by the isolated preload adapter. */
export interface IpcRendererLike {
  invoke<TResult>(channel: string, ...arguments_: readonly unknown[]): Promise<TResult>;
  on<TArguments extends readonly unknown[]>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => void,
  ): void;
  removeListener<TArguments extends readonly unknown[]>(
    channel: string,
    listener: (event: unknown, ...arguments_: TArguments) => void,
  ): void;
}

/** Electron dependencies used by the Desktop Core preload bridge. */
export interface ExposeDesktopCoreOptions {
  readonly contextBridge: ContextBridgeLike;
  readonly ipcRenderer: IpcRendererLike;
  readonly resolveFilePath?: (file: RendererApplicationArtifactFile) => string;
}

/**
 * 向隔离 Renderer 暴露 typed Desktop Core API；输入为受限 bridge，副作用仅为注册全局 API。
 *
 * @param options Electron preload dependencies.
 */
export function exposeDesktopCore(options: ExposeDesktopCoreOptions): void {
  const { contextBridge, ipcRenderer } = options;

  /** Retrieve all Core state required for the first interactive frame. */
  function getBootstrapSnapshot(): Promise<DesktopBootstrapSnapshot> {
    return ipcRenderer.invoke<DesktopBootstrapSnapshot>(DESKTOP_BOOTSTRAP_CHANNEL);
  }

  /** Retrieve authentication metadata and OS-protected credentials. */
  function getAuthSession(): Promise<ApplicationAuthSnapshot> {
    return ipcRenderer.invoke<ApplicationAuthSnapshot>(APPLICATION_AUTH_CHANNELS.getSession);
  }

  /** Persist authentication metadata and OS-protected credentials. */
  function saveAuthSession(
    request: SaveApplicationAuthSessionRequest,
  ): Promise<ApplicationAuthSnapshot> {
    return ipcRenderer.invoke<ApplicationAuthSnapshot>(
      APPLICATION_AUTH_CHANNELS.saveSession,
      request,
    );
  }

  /** Clear authentication metadata and OS-protected credentials. */
  function clearAuthSession(): Promise<ApplicationAuthSnapshot> {
    return ipcRenderer.invoke<ApplicationAuthSnapshot>(APPLICATION_AUTH_CHANNELS.clearSession);
  }

  /** Execute one allow-listed account request through Electron Main. */
  function requestAccess(request: ApplicationAccessRequest): Promise<ApplicationAccessResult> {
    return ipcRenderer.invoke<ApplicationAccessResult>(APPLICATION_ACCESS_CHANNELS.request, request);
  }

  /** Retrieve configured search credential flags without secret values. */
  function getApplicationSearchCredentials(): Promise<ApplicationSearchCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationSearchCredentialSnapshot>(
      APPLICATION_SEARCH_CREDENTIAL_CHANNELS.getSnapshot,
    );
  }

  /** Persist newly entered or explicitly cleared search credentials through Main. */
  function saveApplicationSearchCredentials(
    request: SaveApplicationSearchCredentialsRequest,
  ): Promise<ApplicationSearchCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationSearchCredentialSnapshot>(
      APPLICATION_SEARCH_CREDENTIAL_CHANNELS.save,
      request,
    );
  }

  /** Retrieve configured voice credential flags without secret values. */
  function getApplicationVoiceCredentials(): Promise<ApplicationVoiceCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationVoiceCredentialSnapshot>(
      APPLICATION_VOICE_CREDENTIAL_CHANNELS.getSnapshot,
    );
  }

  /** Persist newly entered or explicitly cleared voice credentials through Main. */
  function saveApplicationVoiceCredentials(
    request: SaveApplicationVoiceCredentialsRequest,
  ): Promise<ApplicationVoiceCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationVoiceCredentialSnapshot>(
      APPLICATION_VOICE_CREDENTIAL_CHANNELS.save,
      request,
    );
  }

  /** 通过 Main 私有 artifact 和 Voice Worker 转写一次桌面录音。 */
  function transcribeApplicationVoice(
    request: ApplicationVoiceTranscriptionRequest,
  ): Promise<ApplicationVoiceTranscriptionResult> {
    return ipcRenderer.invoke<ApplicationVoiceTranscriptionResult>(
      APPLICATION_VOICE_RUNTIME_CHANNELS.transcribe,
      request,
    );
  }

  /** 通过 Main 注入设置并由 Voice Worker 合成一次有界桌面音频。 */
  function synthesizeApplicationVoice(
    request: ApplicationVoiceSynthesisRequest,
  ): Promise<ApplicationVoiceSynthesisResult> {
    return ipcRenderer.invoke<ApplicationVoiceSynthesisResult>(
      APPLICATION_VOICE_RUNTIME_CHANNELS.synthesize,
      request,
    );
  }

  /** 通过 Voice Worker 读取公开系统音色目录，调用时才激活可选能力。 */
  function listApplicationSystemVoices(): Promise<ApplicationVoiceCatalogResult> {
    return ipcRenderer.invoke<ApplicationVoiceCatalogResult>(
      APPLICATION_VOICE_RUNTIME_CHANNELS.listSystemVoices,
    );
  }

  /** 通过固定 Provider 与安全存储作用域读取公开供应商音色目录。 */
  function listApplicationProviderVoices(
    request: ApplicationVoiceProviderCatalogRequest,
  ): Promise<ApplicationVoiceCatalogResult> {
    return ipcRenderer.invoke<ApplicationVoiceCatalogResult>(
      APPLICATION_VOICE_RUNTIME_CHANNELS.listProviderVoices,
      request,
    );
  }

  /** 从真实 File 构造专用参考音频请求；路径留在 preload/Main，内联字节限制为 25 MiB。 */
  async function importApplicationVoiceReference(
    file: RendererApplicationVoiceReferenceFile,
  ): Promise<ApplicationVoiceReferenceResult> {
    if (!file || typeof file.name !== "string" || !file.name.trim()) {
      throw new TypeError("Voice reference selection is invalid.");
    }
    const nativePath = options.resolveFilePath?.(file) ?? "";
    if (nativePath) {
      return ipcRenderer.invoke<ApplicationVoiceReferenceResult>(
        APPLICATION_VOICE_RUNTIME_CHANNELS.importReference,
        { entry: { source: "path", path: nativePath, originalName: file.name } },
      );
    }
    if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > 25 * 1024 * 1024) {
      throw new RangeError("Voice reference exceeds its inline byte budget.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size) {
      throw new Error("Voice reference size changed while it was read.");
    }
    return ipcRenderer.invoke<ApplicationVoiceReferenceResult>(
      APPLICATION_VOICE_RUNTIME_CHANNELS.importReference,
      { entry: { source: "bytes", bytes, originalName: file.name } },
    );
  }

  /** 删除一个固定存储名对应的 Main-owned 参考音频；缺失文件按幂等结果返回。 */
  function removeApplicationVoiceReference(
    request: RemoveApplicationVoiceReferenceRequest,
  ): Promise<RemoveApplicationVoiceReferenceResult> {
    return ipcRenderer.invoke<RemoveApplicationVoiceReferenceResult>(
      APPLICATION_VOICE_RUNTIME_CHANNELS.removeReference,
      request,
    );
  }

  /** 返回 Main 当前 VRM 窗口数量，不启动 legacy backend 或 Python Worker。 */
  function getApplicationVrmPresentationStatus(): Promise<ApplicationVrmPresentationStatus> {
    return ipcRenderer.invoke<ApplicationVrmPresentationStatus>(
      APPLICATION_VRM_PRESENTATION_CHANNELS.status,
    );
  }

  /** 把一条有界 TTS 展示事件交给 Main 直接广播到 VRM 窗口。 */
  function publishApplicationVrmPresentation(
    request: ApplicationVrmPresentationPublishRequest,
  ): Promise<ApplicationVrmPresentationPublishResult> {
    return ipcRenderer.invoke<ApplicationVrmPresentationPublishResult>(
      APPLICATION_VRM_PRESENTATION_CHANNELS.publish,
      request,
    );
  }

  /** 应用 Main-owned 代理设置并让持有旧环境的运行时按需重启。 */
  function applyApplicationSystemProxy(): Promise<ApplyApplicationSystemProxyResult> {
    return ipcRenderer.invoke<ApplyApplicationSystemProxyResult>(
      APPLICATION_SYSTEM_RUNTIME_CHANNELS.applyProxy,
    );
  }

  /** 打开一个固定应用目录；输入目录枚举，返回无路径结果。 */
  function revealApplicationSystemDirectory(
    request: RevealApplicationSystemDirectoryRequest,
  ): Promise<RevealApplicationSystemDirectoryResult> {
    return ipcRenderer.invoke<RevealApplicationSystemDirectoryResult>(
      APPLICATION_SYSTEM_RUNTIME_CHANNELS.revealDirectory,
      request,
    );
  }

  /** 读取 Main 选择的局域网 IPv4 地址；无可用网卡时返回 loopback。 */
  function getApplicationSystemNetworkAddress(): Promise<ApplicationSystemNetworkAddressResult> {
    return ipcRenderer.invoke<ApplicationSystemNetworkAddressResult>(
      APPLICATION_SYSTEM_RUNTIME_CHANNELS.networkAddress,
    );
  }

  /** Retrieve configured MCP credential names without secret values. */
  function getApplicationMcpCredentials(): Promise<ApplicationMcpCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationMcpCredentialSnapshot>(
      APPLICATION_MCP_CREDENTIAL_CHANNELS.getSnapshot,
    );
  }

  /** Persist newly entered or explicitly cleared MCP credentials through Main. */
  function saveApplicationMcpCredentials(
    request: SaveApplicationMcpCredentialsRequest,
  ): Promise<ApplicationMcpCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationMcpCredentialSnapshot>(
      APPLICATION_MCP_CREDENTIAL_CHANNELS.save,
      request,
    );
  }

  /** 查询一个 MCP 集成且不激活停止的 Worker；输入集成请求，返回公开状态。 */
  function getApplicationMcpRuntimeStatus(
    request: ApplicationMcpRuntimeIntegrationRequest,
  ): Promise<ApplicationMcpRuntimeResult> {
    return ipcRenderer.invoke<ApplicationMcpRuntimeResult>(
      APPLICATION_MCP_RUNTIME_CHANNELS.status,
      request,
    );
  }

  /** 启动一个 MCP 集成；输入无密钥配置，返回公开状态，凭据只由 Main 注入 Worker。 */
  function startApplicationMcpRuntime(
    request: ApplicationMcpRuntimeStartRequest,
  ): Promise<ApplicationMcpRuntimeResult> {
    return ipcRenderer.invoke<ApplicationMcpRuntimeResult>(
      APPLICATION_MCP_RUNTIME_CHANNELS.start,
      request,
    );
  }

  /** 停止一个 MCP 集成；输入集成请求，返回公开状态，不激活停止的 Worker。 */
  function stopApplicationMcpRuntime(
    request: ApplicationMcpRuntimeIntegrationRequest,
  ): Promise<ApplicationMcpRuntimeResult> {
    return ipcRenderer.invoke<ApplicationMcpRuntimeResult>(
      APPLICATION_MCP_RUNTIME_CHANNELS.stop,
      request,
    );
  }

  /** 发现 MCP 集成工具；输入无密钥启动请求，返回脱敏摘要，失败时 Promise 仍返回固定结果。 */
  function listApplicationMcpRuntimeTools(
    request: ApplicationMcpRuntimeStartRequest,
  ): Promise<ApplicationMcpRuntimeToolsResult> {
    return ipcRenderer.invoke<ApplicationMcpRuntimeToolsResult>(
      APPLICATION_MCP_RUNTIME_CHANNELS.listTools,
      request,
    );
  }

  /** Retrieve configured custom HTTP credential names without secret values. */
  function getApplicationHttpToolCredentials(): Promise<ApplicationHttpToolCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationHttpToolCredentialSnapshot>(
      APPLICATION_HTTP_TOOL_CREDENTIAL_CHANNELS.getSnapshot,
    );
  }

  /** Persist newly entered or explicitly cleared custom HTTP credentials through Main. */
  function saveApplicationHttpToolCredentials(
    request: SaveApplicationHttpToolCredentialsRequest,
  ): Promise<ApplicationHttpToolCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationHttpToolCredentialSnapshot>(
      APPLICATION_HTTP_TOOL_CREDENTIAL_CHANNELS.save,
      request,
    );
  }

  /** Retrieve configured Connector Worker credential names without secret values. */
  function getApplicationConnectorCredentials(): Promise<ApplicationConnectorCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationConnectorCredentialSnapshot>(
      APPLICATION_CONNECTOR_CREDENTIAL_CHANNELS.getSnapshot,
    );
  }

  /** Persist newly entered or explicitly cleared Connector Worker credentials through Main. */
  function saveApplicationConnectorCredentials(
    request: SaveApplicationConnectorCredentialsRequest,
  ): Promise<ApplicationConnectorCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationConnectorCredentialSnapshot>(
      APPLICATION_CONNECTOR_CREDENTIAL_CHANNELS.save,
      request,
    );
  }

  /** Return one Connector platform status without activating its Worker. */
  function getApplicationConnectorRuntimeStatus(
    request: ApplicationConnectorRuntimePlatformRequest,
  ): Promise<ApplicationConnectorRuntimeResult> {
    return ipcRenderer.invoke<ApplicationConnectorRuntimeResult>(
      APPLICATION_CONNECTOR_RUNTIME_CHANNELS.status,
      request,
    );
  }

  /** Start one Connector platform with bounded non-secret metadata. */
  function startApplicationConnectorRuntime(
    request: ApplicationConnectorRuntimeMutationRequest,
  ): Promise<ApplicationConnectorRuntimeResult> {
    return ipcRenderer.invoke<ApplicationConnectorRuntimeResult>(
      APPLICATION_CONNECTOR_RUNTIME_CHANNELS.start,
      request,
    );
  }

  /** Stop one Connector platform without activating a stopped Worker. */
  function stopApplicationConnectorRuntime(
    request: ApplicationConnectorRuntimePlatformRequest,
  ): Promise<ApplicationConnectorRuntimeResult> {
    return ipcRenderer.invoke<ApplicationConnectorRuntimeResult>(
      APPLICATION_CONNECTOR_RUNTIME_CHANNELS.stop,
      request,
    );
  }

  /** Reload one Connector platform with bounded non-secret metadata. */
  function reloadApplicationConnectorRuntime(
    request: ApplicationConnectorRuntimeMutationRequest,
  ): Promise<ApplicationConnectorRuntimeResult> {
    return ipcRenderer.invoke<ApplicationConnectorRuntimeResult>(
      APPLICATION_CONNECTOR_RUNTIME_CHANNELS.reload,
      request,
    );
  }

  /** 热更新一个已运行 Connector 平台，且不激活已停止的 Worker。 */
  function updateApplicationConnectorRuntime(
    request: ApplicationConnectorRuntimeMutationRequest,
  ): Promise<ApplicationConnectorRuntimeResult> {
    return ipcRenderer.invoke<ApplicationConnectorRuntimeResult>(
      APPLICATION_CONNECTOR_RUNTIME_CHANNELS.update,
      request,
    );
  }

  /** Retrieve configured Telegram credential state without its Bot token. */
  function getApplicationTelegramCredentials(): Promise<ApplicationTelegramCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationTelegramCredentialSnapshot>(
      APPLICATION_TELEGRAM_CREDENTIAL_CHANNELS.getSnapshot,
    );
  }

  /** Persist a newly entered or explicitly cleared Telegram Bot token through Main. */
  function saveApplicationTelegramCredentials(
    request: SaveApplicationTelegramCredentialsRequest,
  ): Promise<ApplicationTelegramCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationTelegramCredentialSnapshot>(
      APPLICATION_TELEGRAM_CREDENTIAL_CHANNELS.save,
      request,
    );
  }

  /** Retrieve configured image-host credential names without secret values. */
  function getApplicationImageHostCredentials(): Promise<ApplicationImageHostCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationImageHostCredentialSnapshot>(
      APPLICATION_IMAGE_HOST_CREDENTIAL_CHANNELS.getSnapshot,
    );
  }

  /** Persist newly entered or explicitly cleared image-host credentials through Main. */
  function saveApplicationImageHostCredentials(
    request: SaveApplicationImageHostCredentialsRequest,
  ): Promise<ApplicationImageHostCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationImageHostCredentialSnapshot>(
      APPLICATION_IMAGE_HOST_CREDENTIAL_CHANNELS.save,
      request,
    );
  }

  /** Retrieve configured repository credential names without secret values. */
  function getApplicationRepositoryCredentials(): Promise<ApplicationRepositoryCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationRepositoryCredentialSnapshot>(
      APPLICATION_REPOSITORY_CREDENTIAL_CHANNELS.getSnapshot,
    );
  }

  /** Persist newly entered or explicitly cleared repository credentials through Main. */
  function saveApplicationRepositoryCredentials(
    request: SaveApplicationRepositoryCredentialsRequest,
  ): Promise<ApplicationRepositoryCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationRepositoryCredentialSnapshot>(
      APPLICATION_REPOSITORY_CREDENTIAL_CHANNELS.save,
      request,
    );
  }

  /** Retrieve configured live-platform credential names without secret values. */
  function getApplicationLivePlatformCredentials(): Promise<ApplicationLivePlatformCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationLivePlatformCredentialSnapshot>(
      APPLICATION_LIVE_PLATFORM_CREDENTIAL_CHANNELS.getSnapshot,
    );
  }

  /** Persist newly entered or explicitly cleared live-platform credentials through Main. */
  function saveApplicationLivePlatformCredentials(
    request: SaveApplicationLivePlatformCredentialsRequest,
  ): Promise<ApplicationLivePlatformCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationLivePlatformCredentialSnapshot>(
      APPLICATION_LIVE_PLATFORM_CREDENTIAL_CHANNELS.save,
      request,
    );
  }

  /** 查询 Live Worker 状态且不激活停止能力；无输入，返回公开无凭据结果。 */
  function getApplicationLiveRuntimeStatus(): Promise<ApplicationLiveRuntimeResult> {
    return ipcRenderer.invoke<ApplicationLiveRuntimeResult>(APPLICATION_LIVE_RUNTIME_CHANNELS.status);
  }

  /** 使用有界无密钥配置启动 Live Worker；输入请求，返回公开结果。 */
  function startApplicationLiveRuntime(
    request: ApplicationLiveRuntimeMutationRequest,
  ): Promise<ApplicationLiveRuntimeResult> {
    return ipcRenderer.invoke<ApplicationLiveRuntimeResult>(
      APPLICATION_LIVE_RUNTIME_CHANNELS.start,
      request,
    );
  }

  /** 停止 Live Worker 内全部直播传输；无输入，返回公开结果。 */
  function stopApplicationLiveRuntime(): Promise<ApplicationLiveRuntimeResult> {
    return ipcRenderer.invoke<ApplicationLiveRuntimeResult>(APPLICATION_LIVE_RUNTIME_CHANNELS.stop);
  }

  /** 使用新无密钥配置重载直播传输；输入请求，返回公开结果。 */
  function reloadApplicationLiveRuntime(
    request: ApplicationLiveRuntimeMutationRequest,
  ): Promise<ApplicationLiveRuntimeResult> {
    return ipcRenderer.invoke<ApplicationLiveRuntimeResult>(
      APPLICATION_LIVE_RUNTIME_CHANNELS.reload,
      request,
    );
  }

  /** 订阅已由 Main 校验的直播事件；输入回调，返回精确取消函数，回调类型无效时抛出 TypeError。 */
  function onApplicationLiveRuntimeEvent(listener: ApplicationLiveRuntimeEventListener): () => void {
    if (typeof listener !== "function") {
      throw new TypeError("Application Live Runtime listener must be a function.");
    }

    /** 转发可信直播事件且隐藏 Electron 事件；输入 IPC 事件和载荷，无返回。 */
    function handleApplicationLiveRuntimeEvent(
      _event: unknown,
      liveEvent: ApplicationLiveRuntimeEvent,
    ): void {
      listener(liveEvent);
    }

    ipcRenderer.on(APPLICATION_LIVE_RUNTIME_CHANNELS.event, handleApplicationLiveRuntimeEvent);

    /** 移除当前直播事件监听器；无输入和返回值，不影响其他订阅者。 */
    function unsubscribe(): void {
      ipcRenderer.removeListener(
        APPLICATION_LIVE_RUNTIME_CHANNELS.event,
        handleApplicationLiveRuntimeEvent,
      );
    }
    return unsubscribe;
  }

  /** Retrieve configured code-sandbox credential names without secret values. */
  function getApplicationCodeSandboxCredentials(): Promise<ApplicationCodeSandboxCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationCodeSandboxCredentialSnapshot>(
      APPLICATION_CODE_SANDBOX_CREDENTIAL_CHANNELS.getSnapshot,
    );
  }

  /** Persist a newly entered or explicitly cleared code-sandbox credential through Main. */
  function saveApplicationCodeSandboxCredentials(
    request: SaveApplicationCodeSandboxCredentialsRequest,
  ): Promise<ApplicationCodeSandboxCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationCodeSandboxCredentialSnapshot>(
      APPLICATION_CODE_SANDBOX_CREDENTIAL_CHANNELS.save,
      request,
    );
  }

  /** Retrieve configured Home Assistant credential names without secret values. */
  function getApplicationHomeAssistantCredentials(): Promise<ApplicationHomeAssistantCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationHomeAssistantCredentialSnapshot>(
      APPLICATION_HOME_ASSISTANT_CREDENTIAL_CHANNELS.getSnapshot,
    );
  }

  /** Persist a newly entered or explicitly cleared Home Assistant credential through Main. */
  function saveApplicationHomeAssistantCredentials(
    request: SaveApplicationHomeAssistantCredentialsRequest,
  ): Promise<ApplicationHomeAssistantCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationHomeAssistantCredentialSnapshot>(
      APPLICATION_HOME_ASSISTANT_CREDENTIAL_CHANNELS.save,
      request,
    );
  }

  /** 读取 SQL 脱敏凭据和文件授权状态；无输入，返回快照，不激活 MCP Worker。 */
  function getApplicationSqlCredentials(): Promise<ApplicationSqlCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationSqlCredentialSnapshot>(
      APPLICATION_SQL_CREDENTIAL_CHANNELS.getSnapshot,
    );
  }

  /** 保存 Main 持有的 SQL 口令；输入精确修改请求，返回脱敏快照，失败时 Promise 拒绝。 */
  function saveApplicationSqlCredentials(
    request: SaveApplicationSqlCredentialsRequest,
  ): Promise<ApplicationSqlCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationSqlCredentialSnapshot>(
      APPLICATION_SQL_CREDENTIAL_CHANNELS.save,
      request,
    );
  }

  /** 打开系统 SQLite 文件选择器；无输入，返回最新授权快照，取消时保留当前授权。 */
  function selectApplicationSqliteDatabase(): Promise<ApplicationSqlCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationSqlCredentialSnapshot>(
      APPLICATION_SQL_CREDENTIAL_CHANNELS.selectDatabase,
    );
  }

  /** Retrieve configured ComfyUI credential names without secret values. */
  function getApplicationComfyUiCredentials(): Promise<ApplicationComfyUiCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationComfyUiCredentialSnapshot>(
      APPLICATION_COMFYUI_CREDENTIAL_CHANNELS.getSnapshot,
    );
  }

  /** Persist a newly entered or explicitly cleared ComfyUI credential through Main. */
  function saveApplicationComfyUiCredentials(
    request: SaveApplicationComfyUiCredentialsRequest,
  ): Promise<ApplicationComfyUiCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationComfyUiCredentialSnapshot>(
      APPLICATION_COMFYUI_CREDENTIAL_CHANNELS.save,
      request,
    );
  }

  /** Retrieve configured task delivery credential scopes without secret values. */
  function getApplicationDeliveryCredentials(): Promise<ApplicationDeliveryCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationDeliveryCredentialSnapshot>(
      APPLICATION_DELIVERY_CREDENTIAL_CHANNELS.getSnapshot,
    );
  }

  /** Persist one scoped task delivery credential replacement or explicit clear. */
  function saveApplicationDeliveryCredentials(
    request: SaveApplicationDeliveryCredentialsRequest,
  ): Promise<ApplicationDeliveryCredentialSnapshot> {
    return ipcRenderer.invoke<ApplicationDeliveryCredentialSnapshot>(
      APPLICATION_DELIVERY_CREDENTIAL_CHANNELS.save,
      request,
    );
  }

  /** Retrieve the lazy migration-managed artifact catalog. */
  function listArtifacts(
    request: ListApplicationArtifactsRequest = {},
  ): Promise<ApplicationArtifactSnapshot> {
    return ipcRenderer.invoke<ApplicationArtifactSnapshot>(APPLICATION_ARTIFACT_CHANNELS.list, request);
  }

  /** Import authorized native files into the application artifact library. */
  function importArtifacts(
    request: ImportApplicationArtifactsRequest,
  ): Promise<ApplicationArtifactWriteResult> {
    return ipcRenderer.invoke<ApplicationArtifactWriteResult>(
      APPLICATION_ARTIFACT_CHANNELS.importFiles,
      request,
    );
  }

  /**
   * 从真实 File 构造 preload 所有权导入请求；输入文件数组，返回 Core 写入结果，本机路径不暴露给 Renderer，非法来源或超出预算时抛错。
   */
  async function importSelectedArtifacts(
    files: readonly RendererApplicationArtifactFile[],
  ): Promise<ApplicationArtifactWriteResult> {
    if (!Array.isArray(files) || files.length === 0 || files.length > 256) {
      throw new Error("Artifact files must contain between 1 and 256 items.");
    }
    const entries: Array<
      | { source: "path"; path: string }
      | { source: "bytes"; originalName: string; bytes: Uint8Array }
    > = [];
    let inlineBytes = 0;
    for (const file of files) {
      if (!file || typeof file.name !== "string" || !file.name.trim()) {
        throw new Error("Artifact selection contains an invalid File.");
      }
      const nativePath = options.resolveFilePath?.(file) ?? "";
      if (nativePath) {
        entries.push({ source: "path", path: nativePath });
        continue;
      }
      if (
        !Number.isSafeInteger(file.size)
        || file.size <= 0
        || file.size > MAX_RENDERER_INLINE_ARTIFACT_BYTES
      ) {
        throw new Error("Generated artifact exceeds its byte budget.");
      }
      inlineBytes += file.size;
      if (inlineBytes > MAX_RENDERER_INLINE_ARTIFACT_BATCH_BYTES) {
        throw new Error("Generated artifact batch exceeds its byte budget.");
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength !== file.size) {
        throw new Error("Generated artifact size changed while it was read.");
      }
      entries.push({ source: "bytes", originalName: file.name, bytes });
    }
    return ipcRenderer.invoke<ApplicationArtifactWriteResult>(
      APPLICATION_ARTIFACT_CHANNELS.importRendererFiles,
      { entries },
    );
  }

  /** 从真实 File 构造 VR 资产请求；输入类型、显示名和文件，返回 Runtime 写入结果，非法来源或超限时抛错。 */
  async function importApplicationVrAsset(
    request: RendererImportApplicationVrAssetRequest,
  ): Promise<ApplicationVrAssetWriteResult> {
    if (!request || !["model", "motion", "scene"].includes(request.kind)) {
      throw new Error("VR asset import request is invalid.");
    }
    const displayName = String(request.displayName || "").trim();
    const file = request.file;
    if (!displayName || !file || typeof file.name !== "string" || !file.name.trim()) {
      throw new Error("VR asset selection is invalid.");
    }
    const nativePath = options.resolveFilePath?.(file) ?? "";
    if (nativePath) {
      return ipcRenderer.invoke<ApplicationVrAssetWriteResult>(
        APPLICATION_VR_ASSET_CHANNELS.importAsset,
        {
          kind: request.kind,
          displayName,
          entry: { source: "path", path: nativePath, originalName: file.name },
        },
      );
    }
    if (
      !Number.isSafeInteger(file.size)
      || file.size <= 0
      || file.size > MAX_INLINE_VR_ASSET_BYTES
    ) {
      throw new Error("Generated VR asset exceeds its byte budget.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size) throw new Error("Generated VR asset size changed while it was read.");
    return ipcRenderer.invoke<ApplicationVrAssetWriteResult>(
      APPLICATION_VR_ASSET_CHANNELS.importAsset,
      {
        kind: request.kind,
        displayName,
        entry: { source: "bytes", originalName: file.name, bytes },
      },
    );
  }

  /** 列出完整 VR 资产目录；无输入，返回内置、用户和云模型，不激活 Python。 */
  function listApplicationVrAssets(): Promise<ApplicationVrAssetCatalog> {
    return ipcRenderer.invoke<ApplicationVrAssetCatalog>(APPLICATION_VR_ASSET_CHANNELS.list);
  }

  /** 删除一个用户 VR 资产；输入类型和稳定 ID，返回删除结果，内置或缺失资产时拒绝 Promise。 */
  function deleteApplicationVrAsset(
    request: DeleteApplicationVrAssetRequest,
  ): Promise<ApplicationVrAssetDeleteResult> {
    return ipcRenderer.invoke<ApplicationVrAssetDeleteResult>(APPLICATION_VR_ASSET_CHANNELS.deleteAsset, request);
  }

  /** 下载固定目录中的云 VRM；输入模型 ID，返回用户资产，未知 ID 或下载失败时拒绝 Promise。 */
  function downloadApplicationCloudVrmModel(
    request: DownloadApplicationCloudVrmModelRequest,
  ): Promise<ApplicationVrAssetWriteResult> {
    return ipcRenderer.invoke<ApplicationVrAssetWriteResult>(
      APPLICATION_VR_ASSET_CHANNELS.downloadCloudModel,
      request,
    );
  }

  /** 从真实 File 构造有界 ZIP 项；输入 File、预算和标签，返回路径或字节项，非法、空文件或超限时抛错。 */
  async function createApplicationArchiveEntry(
    file: RendererImportApplicationExtensionArchiveRequest["file"] | RendererImportApplicationSkillArchiveRequest["file"],
    maximumInlineBytes: number,
    label: string,
  ): Promise<
    | { readonly source: "path"; readonly path: string; readonly originalName: string }
    | { readonly source: "bytes"; readonly originalName: string; readonly bytes: Uint8Array }
  > {
    if (!file || typeof file.name !== "string" || !file.name.trim().toLowerCase().endsWith(".zip")) {
      throw new Error(`${label} selection is invalid.`);
    }
    const nativePath = options.resolveFilePath?.(file) ?? "";
    if (nativePath) return { source: "path", path: nativePath, originalName: file.name };
    if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > maximumInlineBytes) {
      throw new Error(`${label} exceeds its inline byte budget.`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size) throw new Error(`${label} size changed while it was read.`);
    return { source: "bytes", originalName: file.name, bytes };
  }

  /** 列出本机扩展；无输入，返回有界元数据，不激活 Python。 */
  function listApplicationExtensions(): Promise<ApplicationExtensionCatalog> {
    return ipcRenderer.invoke<ApplicationExtensionCatalog>(APPLICATION_EXTENSION_RUNTIME_CHANNELS.list);
  }

  /** 列出固定远程扩展；无输入，返回远端目录及安装状态，仅访问 Main allow-list 主机。 */
  function listRemoteApplicationExtensions(): Promise<ApplicationRemoteExtensionCatalog> {
    return ipcRenderer.invoke<ApplicationRemoteExtensionCatalog>(APPLICATION_EXTENSION_RUNTIME_CHANNELS.listRemote);
  }

  /** 从固定仓库安装扩展；输入主/备用仓库，返回安装结果，非法主机或 ZIP 会拒绝 Promise。 */
  function installApplicationExtensionFromRepository(
    request: InstallApplicationExtensionRepositoryRequest,
  ): Promise<ApplicationExtensionWriteResult> {
    return ipcRenderer.invoke<ApplicationExtensionWriteResult>(
      APPLICATION_EXTENSION_RUNTIME_CHANNELS.installRepository,
      request,
    );
  }

  /** 导入本机扩展 ZIP；输入真实 File，返回安装结果，路径或字节由 preload 收敛。 */
  async function importApplicationExtensionArchive(
    request: RendererImportApplicationExtensionArchiveRequest,
  ): Promise<ApplicationExtensionWriteResult> {
    const entry = await createApplicationArchiveEntry(request?.file, MAX_INLINE_EXTENSION_ARCHIVE_BYTES, "Extension ZIP");
    return ipcRenderer.invoke<ApplicationExtensionWriteResult>(
      APPLICATION_EXTENSION_RUNTIME_CHANNELS.importArchive,
      { entry },
    );
  }

  /** 更新一个扩展；输入稳定 ID，返回原子替换后的元数据，失败时拒绝 Promise。 */
  function updateApplicationExtension(request: ApplicationExtensionIdRequest): Promise<ApplicationExtensionWriteResult> {
    return ipcRenderer.invoke<ApplicationExtensionWriteResult>(APPLICATION_EXTENSION_RUNTIME_CHANNELS.update, request);
  }

  /** 删除一个扩展；输入稳定 ID，返回删除结果，会先停止其受监督进程。 */
  function removeApplicationExtension(request: ApplicationExtensionIdRequest): Promise<ApplicationExtensionMutationResult> {
    return ipcRenderer.invoke<ApplicationExtensionMutationResult>(APPLICATION_EXTENSION_RUNTIME_CHANNELS.remove, request);
  }

  /** 启动扩展页面；输入稳定 ID，返回独立回环 Origin URL，Node 启动失败时拒绝 Promise。 */
  function startApplicationExtension(request: ApplicationExtensionIdRequest): Promise<ApplicationExtensionStartResult> {
    return ipcRenderer.invoke<ApplicationExtensionStartResult>(APPLICATION_EXTENSION_RUNTIME_CHANNELS.start, request);
  }

  /** 停止一个 Node 扩展；输入稳定 ID，返回幂等停止结果。 */
  function stopApplicationExtension(request: ApplicationExtensionIdRequest): Promise<ApplicationExtensionMutationResult> {
    return ipcRenderer.invoke<ApplicationExtensionMutationResult>(APPLICATION_EXTENSION_RUNTIME_CHANNELS.stop, request);
  }

  /** 列出全局技能；无输入，返回有界元数据并补齐缺失内置技能，不激活 Python。 */
  function listApplicationSkills(): Promise<ApplicationSkillCatalog> {
    return ipcRenderer.invoke<ApplicationSkillCatalog>(APPLICATION_SKILL_RUNTIME_CHANNELS.list);
  }

  /** 读取一个技能 Markdown；输入稳定 ID，返回有界 UTF-8 内容。 */
  function getApplicationSkillContent(request: ApplicationSkillIdRequest): Promise<ApplicationSkillContentResult> {
    return ipcRenderer.invoke<ApplicationSkillContentResult>(APPLICATION_SKILL_RUNTIME_CHANNELS.content, request);
  }

  /** 从固定 GitHub 仓库安装技能；输入仓库或 tree 深链，返回安装结果。 */
  function installApplicationSkillFromRepository(
    request: InstallApplicationSkillRepositoryRequest,
  ): Promise<ApplicationSkillWriteResult> {
    return ipcRenderer.invoke<ApplicationSkillWriteResult>(APPLICATION_SKILL_RUNTIME_CHANNELS.installRepository, request);
  }

  /** 导入本机技能 ZIP；输入真实 File，返回安装结果，路径或字节由 preload 收敛。 */
  async function importApplicationSkillArchive(
    request: RendererImportApplicationSkillArchiveRequest,
  ): Promise<ApplicationSkillWriteResult> {
    const entry = await createApplicationArchiveEntry(request?.file, MAX_INLINE_SKILL_ARCHIVE_BYTES, "Skill ZIP");
    return ipcRenderer.invoke<ApplicationSkillWriteResult>(APPLICATION_SKILL_RUNTIME_CHANNELS.importArchive, { entry });
  }

  /** 结晶标准技能；输入有界流程字段，返回全局及可选工作区写入结果。 */
  function crystallizeApplicationSkill(request: CrystallizeApplicationSkillRequest): Promise<ApplicationSkillWriteResult> {
    return ipcRenderer.invoke<ApplicationSkillWriteResult>(APPLICATION_SKILL_RUNTIME_CHANNELS.crystallize, request);
  }

  /** 上传企业 Skill 候选到 XnetMLOps；输入 Skill/Workspace ID，返回草稿仓库回执。 */
  function uploadApplicationSkillToMlops(
    request: UploadApplicationSkillToMlopsRequest,
  ): Promise<ApplicationSkillMlopsUploadResult> {
    return ipcRenderer.invoke<ApplicationSkillMlopsUploadResult>(APPLICATION_SKILL_RUNTIME_CHANNELS.uploadMlops, request);
  }

  /** 删除全局技能；输入稳定 ID，返回删除结果。 */
  function removeApplicationSkill(request: ApplicationSkillIdRequest): Promise<ApplicationSkillMutationResult> {
    return ipcRenderer.invoke<ApplicationSkillMutationResult>(APPLICATION_SKILL_RUNTIME_CHANNELS.remove, request);
  }

  /** 读取 Main-owned 当前工作区技能状态；无输入，Renderer 不提交路径。 */
  function getApplicationProjectSkillStatus(): Promise<ApplicationProjectSkillStatus> {
    return ipcRenderer.invoke<ApplicationProjectSkillStatus>(APPLICATION_SKILL_RUNTIME_CHANNELS.projectStatus);
  }

  /** 同步当前工作区技能；输入稳定 ID 和固定动作，Renderer 不提交路径。 */
  function syncApplicationProjectSkill(request: SyncApplicationSkillProjectRequest): Promise<ApplicationSkillWriteResult> {
    return ipcRenderer.invoke<ApplicationSkillWriteResult>(APPLICATION_SKILL_RUNTIME_CHANNELS.syncProject, request);
  }

  /** 让 Main 打开全局技能目录；无输入，返回固定结果，Renderer 不接收或提交文件路径。 */
  function revealApplicationSkillsDirectory(): Promise<ApplicationSkillDirectoryResult> {
    return ipcRenderer.invoke<ApplicationSkillDirectoryResult>(APPLICATION_SKILL_RUNTIME_CHANNELS.revealDirectory);
  }

  /** 列出企业角色卡；无输入，返回本机有界记录，不激活 Python。 */
  function listApplicationEnterpriseRoleCards(): Promise<ApplicationEnterpriseRoleCardListResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseRoleCardListResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listRoleCards);
  }

  /** 保存企业角色卡；输入结构化草稿，返回写入记录，未知字段时拒绝 Promise。 */
  function saveApplicationEnterpriseRoleCard(
    request: SaveApplicationEnterpriseRoleCardRequest,
  ): Promise<ApplicationEnterpriseRoleCardWriteResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseRoleCardWriteResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.saveRoleCard, request);
  }

  /** 删除企业角色卡；输入稳定 ID，返回删除结果并同步本机沙盘。 */
  function removeApplicationEnterpriseRoleCard(
    request: ApplicationEnterpriseRoleCardRequest,
  ): Promise<ApplicationEnterpriseRemoveResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseRemoveResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.removeRoleCard, request);
  }

  /** 列出企业团队模板；无输入，返回本机有界模板，不访问 AgentTeams 服务。 */
  function listApplicationEnterpriseTeamTemplates(): Promise<ApplicationEnterpriseTeamTemplateListResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseTeamTemplateListResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listTeamTemplates);
  }

  /** 保存企业团队模板；输入结构化成员引用，返回递增版本，成员无效时拒绝 Promise。 */
  function saveApplicationEnterpriseTeamTemplate(
    request: SaveApplicationEnterpriseTeamTemplateRequest,
  ): Promise<ApplicationEnterpriseTeamTemplateWriteResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseTeamTemplateWriteResult>(
      APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.saveTeamTemplate,
      request,
    );
  }

  /** 删除企业团队模板；输入稳定 ID，返回删除结果，不删除角色卡。 */
  function removeApplicationEnterpriseTeamTemplate(
    request: ApplicationEnterpriseTeamTemplateRequest,
  ): Promise<ApplicationEnterpriseRemoveResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseRemoveResult>(
      APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.removeTeamTemplate,
      request,
    );
  }

  /** 列出企业知识库；无输入，返回本机有界元数据，不激活 Python。 */
  function listApplicationEnterpriseKnowledgeBases(): Promise<ApplicationEnterpriseKnowledgeBaseListResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseKnowledgeBaseListResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listKnowledgeBases);
  }

  /** 保存企业知识库；输入结构化草稿，返回写入记录。 */
  function saveApplicationEnterpriseKnowledgeBase(
    request: SaveApplicationEnterpriseKnowledgeBaseRequest,
  ): Promise<ApplicationEnterpriseKnowledgeBaseWriteResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseKnowledgeBaseWriteResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.saveKnowledgeBase, request);
  }

  /** 删除企业知识库；输入稳定 ID，返回删除结果并清理版本目录。 */
  function removeApplicationEnterpriseKnowledgeBase(
    request: ApplicationEnterpriseKnowledgeBaseRequest,
  ): Promise<ApplicationEnterpriseRemoveResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseRemoveResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.removeKnowledgeBase, request);
  }

  /** 列出企业知识库版本；输入稳定 ID，返回不含 snapshot_data 的摘要。 */
  function listApplicationEnterpriseKnowledgeBaseVersions(
    request: ApplicationEnterpriseKnowledgeBaseRequest,
  ): Promise<ApplicationEnterpriseKnowledgeBaseVersionListResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseKnowledgeBaseVersionListResult>(
      APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listKnowledgeBaseVersions,
      request,
    );
  }

  /** 列出企业环境元数据；无输入，返回结构化记录，不执行 Docker 或 SSH。 */
  function listApplicationEnterpriseWorkspaces(): Promise<ApplicationEnterpriseWorkspaceListResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseWorkspaceListResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listWorkspaces);
  }

  /** 保存企业环境元数据；输入结构化草稿，返回记录，不执行外部资源动作。 */
  function saveApplicationEnterpriseWorkspace(
    request: SaveApplicationEnterpriseWorkspaceRequest,
  ): Promise<ApplicationEnterpriseWorkspaceWriteResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseWorkspaceWriteResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.saveWorkspace, request);
  }

  /** 删除企业环境元数据；输入稳定 ID，返回结果，不停止外部资源。 */
  function removeApplicationEnterpriseWorkspace(
    request: ApplicationEnterpriseWorkspaceRequest,
  ): Promise<ApplicationEnterpriseRemoveResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseRemoveResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.removeWorkspace, request);
  }

  /** 列出企业项目楼层；无输入，返回 Main-owned 有界记录。 */
  function listApplicationEnterpriseProjects(): Promise<ApplicationEnterpriseProjectListResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseProjectListResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listProjects);
  }

  /** 保存企业项目楼层；输入结构化草稿，返回持久记录。 */
  function saveApplicationEnterpriseProject(
    request: SaveApplicationEnterpriseProjectRequest,
  ): Promise<ApplicationEnterpriseProjectWriteResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseProjectWriteResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.saveProject, request);
  }

  /** 删除企业项目楼层；输入稳定 ID，返回删除结果。 */
  function removeApplicationEnterpriseProject(
    request: ApplicationEnterpriseProjectRequest,
  ): Promise<ApplicationEnterpriseRemoveResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseRemoveResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.removeProject, request);
  }

  /** 查询企业协作群消息；输入 Workspace、项目和数量，返回有界审计轨迹。 */
  function listApplicationEnterpriseMessages(
    request: ListApplicationEnterpriseMessagesRequest,
  ): Promise<ApplicationEnterpriseMessageListResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseMessageListResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listMessages, request);
  }

  /** 发布企业领导消息；输入内容和 @员工 ID，作者身份、时间和消息 ID 由 Main 生成。 */
  function postApplicationEnterpriseMessage(
    request: PostApplicationEnterpriseMessageRequest,
  ): Promise<ApplicationEnterpriseMessageWriteResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseMessageWriteResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.postMessage, request);
  }

  /** 列出企业空间 Skill 绑定；无输入，返回不含技能正文的启用关系。 */
  function listApplicationEnterpriseSkillBindings(): Promise<ApplicationEnterpriseSkillBindingListResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseSkillBindingListResult>(
      APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listSkillBindings,
    );
  }

  /** 设置企业 Skill 启用状态；输入 Workspace、Skill 和来源事件，返回幂等写入结果。 */
  function setApplicationEnterpriseSkillBinding(
    request: SetApplicationEnterpriseSkillBindingRequest,
  ): Promise<ApplicationEnterpriseSkillBindingWriteResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseSkillBindingWriteResult>(
      APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.setSkillBinding,
      request,
    );
  }

  /** 读取企业沙盘；无输入，返回角色卡投影和场景，不启动 Agent 或 Python。 */
  function getApplicationEnterpriseSandboxState(): Promise<ApplicationEnterpriseSandboxStateResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseSandboxStateResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.getSandboxState);
  }

  /** 列出 Xnet 服务；无输入，返回保存配置和最近状态，不执行网络检查。 */
  function listApplicationEnterpriseXnetServices(): Promise<ApplicationEnterpriseXnetServiceListResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseXnetServiceListResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.listXnetServices);
  }

  /** 保存 Xnet 服务；输入固定键、URL 和自动连接标志，返回配置，不执行网络检查。 */
  function saveApplicationEnterpriseXnetService(
    request: SaveApplicationEnterpriseXnetServiceRequest,
  ): Promise<ApplicationEnterpriseXnetServiceWriteResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseXnetServiceWriteResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.saveXnetService, request);
  }

  /** 检查单个 Xnet 服务；输入固定键，返回状态，只访问 Main 已保存 URL。 */
  function checkApplicationEnterpriseXnetService(
    request: ApplicationEnterpriseXnetServiceRequest,
  ): Promise<ApplicationEnterpriseXnetServiceWriteResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseXnetServiceWriteResult>(APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.checkXnetService, request);
  }

  /** 批量检查 Xnet 服务；输入 autoOnly，返回完整状态，不接受 URL。 */
  function checkAllApplicationEnterpriseXnetServices(
    request: CheckAllApplicationEnterpriseXnetServicesRequest,
  ): Promise<ApplicationEnterpriseXnetServiceListResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseXnetServiceListResult>(
      APPLICATION_ENTERPRISE_RUNTIME_CHANNELS.checkAllXnetServices,
      request,
    );
  }

  /** 读取企业用量面板；输入分组和数量，返回 Main SQLite 聚合，不启动 Python。 */
  function loadApplicationEnterpriseUsageDashboard(
    request: ApplicationEnterpriseUsageDashboardRequest,
  ): Promise<ApplicationEnterpriseUsageDashboardResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseUsageDashboardResult>(
      APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS.loadUsageDashboard,
      request,
    );
  }

  /** 读取认知符号面板；输入数量，返回脱敏符号、统计和规则，通过请求租约按需访问引擎。 */
  function loadApplicationEnterpriseNeuroDashboard(
    request: ApplicationEnterpriseNeuroDashboardRequest,
  ): Promise<ApplicationEnterpriseNeuroDashboardResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseNeuroDashboardResult>(
      APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS.loadNeuroDashboard,
      request,
    );
  }

  /** 搜索认知符号；输入文本、算子和数量，返回纯读取结果，不接受 URL 或路径。 */
  function searchApplicationEnterpriseNeuroSymbols(
    request: ApplicationEnterpriseNeuroSearchRequest,
  ): Promise<ApplicationEnterpriseNeuroSearchResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseNeuroSearchResult>(
      APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS.searchNeuroSymbols,
      request,
    );
  }

  /** 删除普通认知符号；输入稳定 ID，返回删除结果，内置规则不可删除。 */
  function removeApplicationEnterpriseNeuroSymbol(
    request: ApplicationEnterpriseNeuroSymbolRequest,
  ): Promise<ApplicationEnterpriseNeuroRemoveResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseNeuroRemoveResult>(
      APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS.removeNeuroSymbol,
      request,
    );
  }

  /** 执行认知符号维护；无输入，返回衰减和清理计数，写入由引擎单一所有。 */
  function runApplicationEnterpriseNeuroMaintenance(): Promise<ApplicationEnterpriseNeuroMaintenanceResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseNeuroMaintenanceResult>(
      APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS.runNeuroMaintenance,
    );
  }

  /** 读取知识图谱面板；输入边数量，返回脱敏节点、边和统计。 */
  function loadApplicationEnterpriseKnowledgeGraph(
    request: ApplicationEnterpriseKnowledgeGraphRequest,
  ): Promise<ApplicationEnterpriseKnowledgeGraphResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseKnowledgeGraphResult>(
      APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS.loadKnowledgeGraph,
      request,
    );
  }

  /** 查询知识图谱实体；输入实体和数量，返回脱敏时序事实。 */
  function queryApplicationEnterpriseKnowledgeGraphEntity(
    request: ApplicationEnterpriseKnowledgeGraphEntityRequest,
  ): Promise<ApplicationEnterpriseKnowledgeGraphEntityResult> {
    return ipcRenderer.invoke<ApplicationEnterpriseKnowledgeGraphEntityResult>(
      APPLICATION_ENTERPRISE_INSIGHTS_RUNTIME_CHANNELS.queryKnowledgeGraphEntity,
      request,
    );
  }

  /** 执行固定 Kernel 操作；输入 operation 和结构化载荷，返回脱敏结果，不接受 URL、HTTP 方法或路径。 */
  function invokeApplicationKernel(
    request: ApplicationKernelCommandRequest,
  ): Promise<ApplicationKernelCommandResult> {
    return ipcRenderer.invoke<ApplicationKernelCommandResult>(APPLICATION_KERNEL_RUNTIME_CHANNELS.invoke, request);
  }

  /** 读取本地模型状态；输入固定 kind，返回无路径摘要，不启动 Voice/Vector Worker。 */
  function getApplicationModelAssetStatus(
    request: ApplicationModelAssetRequest,
  ): Promise<ApplicationModelAssetStatus> {
    return ipcRenderer.invoke<ApplicationModelAssetStatus>(APPLICATION_MODEL_ASSET_CHANNELS.getStatus, request);
  }

  /** 下载固定版本模型；输入 kind/source，返回安装状态，不接受 URL、版本、路径或哈希。 */
  function downloadApplicationModelAsset(
    request: DownloadApplicationModelAssetRequest,
  ): Promise<ApplicationModelAssetStatus> {
    return ipcRenderer.invoke<ApplicationModelAssetStatus>(APPLICATION_MODEL_ASSET_CHANNELS.download, request);
  }

  /** 删除本地模型；输入固定 kind，返回未安装状态，Main 会先停止对应 Worker。 */
  function removeApplicationModelAsset(
    request: ApplicationModelAssetRequest,
  ): Promise<ApplicationModelAssetStatus> {
    return ipcRenderer.invoke<ApplicationModelAssetStatus>(APPLICATION_MODEL_ASSET_CHANNELS.remove, request);
  }

  /** 订阅模型下载进度；输入监听器，返回精确取消函数；非法监听器时抛出 TypeError。 */
  function onApplicationModelAssetProgress(listener: ApplicationModelAssetProgressListener): () => void {
    if (typeof listener !== "function") throw new TypeError("Model asset progress listener must be a function.");

    /** 转发可信 Main 模型进度；输入 Electron 事件和进度，无返回，不暴露 Electron 对象。 */
    function handleProgress(_event: unknown, progress: ApplicationModelAssetProgressEvent): void {
      listener(progress);
    }

    ipcRenderer.on(APPLICATION_MODEL_ASSET_CHANNELS.progress, handleProgress);

    /** 移除当前模型进度监听；无输入和返回，可重复调用。 */
    function unsubscribe(): void {
      ipcRenderer.removeListener(APPLICATION_MODEL_ASSET_CHANNELS.progress, handleProgress);
    }

    return unsubscribe;
  }

  /** Register files written by the temporary HTTP compatibility upload route. */
  function registerArtifacts(
    request: RegisterApplicationArtifactsRequest,
  ): Promise<ApplicationArtifactWriteResult> {
    return ipcRenderer.invoke<ApplicationArtifactWriteResult>(
      APPLICATION_ARTIFACT_CHANNELS.registerFiles,
      request,
    );
  }

  /** Delete artifact binaries while retaining stable Core tombstones. */
  function deleteArtifacts(
    request: DeleteApplicationArtifactsRequest,
  ): Promise<DeleteApplicationArtifactsResult> {
    return ipcRenderer.invoke<DeleteApplicationArtifactsResult>(
      APPLICATION_ARTIFACT_CHANNELS.delete,
      request,
    );
  }

  /** Retrieve durable tasks without requiring the Python execution mirror. */
  function listTasks(
    request: ListApplicationTasksRequest = {},
  ): Promise<ApplicationTaskSnapshot> {
    return ipcRenderer.invoke<ApplicationTaskSnapshot>(APPLICATION_TASK_CHANNELS.list, request);
  }

  /** Retrieve one durable task and its Core event history. */
  function getTask(request: GetApplicationTaskRequest): Promise<ApplicationTaskDetail> {
    return ipcRenderer.invoke<ApplicationTaskDetail>(APPLICATION_TASK_CHANNELS.get, request);
  }

  /** Persist one durable task before compatibility execution dispatch. */
  function createTask(request: CreateApplicationTaskRequest): Promise<ApplicationTask> {
    return ipcRenderer.invoke<ApplicationTask>(APPLICATION_TASK_CHANNELS.create, request);
  }

  /** Refresh Python execution mirrors through the supervised Core worker. */
  function refreshTaskExecutions(
    request: RefreshApplicationTaskExecutionsRequest,
  ): Promise<ApplicationTaskExecutionSnapshot> {
    return ipcRenderer.invoke<ApplicationTaskExecutionSnapshot>(
      APPLICATION_TASK_EXECUTION_CHANNELS.refresh,
      request,
    );
  }

  /** Retrieve one Core task enriched by its current execution mirror. */
  function getTaskExecution(
    request: ApplicationTaskExecutionRequest,
  ): Promise<ApplicationTaskExecutionDetail> {
    return ipcRenderer.invoke<ApplicationTaskExecutionDetail>(
      APPLICATION_TASK_EXECUTION_CHANNELS.get,
      request,
    );
  }

  /** Create and dispatch one standardized developer-workbench task through Core. */
  function createDeveloperWorkbenchTaskExecution(
    request: CreateDeveloperWorkbenchTaskExecutionRequest,
  ): Promise<ApplicationTask> {
    return ipcRenderer.invoke<ApplicationTask>(
      APPLICATION_TASK_EXECUTION_CHANNELS.createWorkbench,
      request,
    );
  }

  /** Dispatch one persisted Core task through the supervised worker. */
  function dispatchTaskExecution(request: ApplicationTaskExecutionRequest): Promise<ApplicationTask> {
    return ipcRenderer.invoke<ApplicationTask>(APPLICATION_TASK_EXECUTION_CHANNELS.dispatch, request);
  }

  /** Start one pending task through the supervised worker. */
  function startTaskExecution(request: StartApplicationTaskExecutionRequest): Promise<ApplicationTask> {
    return ipcRenderer.invoke<ApplicationTask>(APPLICATION_TASK_EXECUTION_CHANNELS.start, request);
  }

  /** Resume one terminal task through the supervised worker. */
  function resumeTaskExecution(request: ResumeApplicationTaskExecutionRequest): Promise<ApplicationTask> {
    return ipcRenderer.invoke<ApplicationTask>(APPLICATION_TASK_EXECUTION_CHANNELS.resume, request);
  }

  /** Cancel one task through the Core-first execution coordinator. */
  function cancelTaskExecution(request: ApplicationTaskExecutionRequest): Promise<ApplicationTask> {
    return ipcRenderer.invoke<ApplicationTask>(APPLICATION_TASK_EXECUTION_CHANNELS.cancel, request);
  }

  /** Delete one task and its compatibility execution mirror. */
  function deleteTaskExecution(request: ApplicationTaskExecutionRequest): Promise<ApplicationTaskSnapshot> {
    return ipcRenderer.invoke<ApplicationTaskSnapshot>(APPLICATION_TASK_EXECUTION_CHANNELS.delete, request);
  }

  /** Subscribe to authoritative task snapshots emitted by the execution worker. */
  function onTaskExecutionChanged(listener: ApplicationTaskExecutionListener): () => void {
    if (typeof listener !== "function") {
      throw new TypeError("Task execution listener must be a function.");
    }

    /** Forward a trusted Core task snapshot without exposing Electron internals. */
    function handleTaskExecutionChanged(_event: unknown, snapshot: ApplicationTaskSnapshot): void {
      listener(snapshot);
    }

    ipcRenderer.on(APPLICATION_TASK_EXECUTION_CHANNELS.changed, handleTaskExecutionChanged);

    /** Remove the exact task execution listener registered by this subscription. */
    function unsubscribe(): void {
      ipcRenderer.removeListener(APPLICATION_TASK_EXECUTION_CHANNELS.changed, handleTaskExecutionChanged);
    }
    return unsubscribe;
  }

  /** Start one private Execution Engine chat stream. */
  function startApplicationChatStream(
    request: StartApplicationChatStreamRequest,
  ): Promise<ApplicationChatStreamAcknowledgement> {
    return ipcRenderer.invoke<ApplicationChatStreamAcknowledgement>(
      APPLICATION_CHAT_CHANNELS.startStream,
      request,
    );
  }

  /** Execute one bounded non-stream chat completion. */
  function completeApplicationChat(
    request: CompleteApplicationChatRequest,
  ): Promise<ApplicationChatResponse> {
    return ipcRenderer.invoke<ApplicationChatResponse>(APPLICATION_CHAT_CHANNELS.complete, request);
  }

  /** Retrieve available chat models from the private engine. */
  function listApplicationChatModels(): Promise<ApplicationChatResponse> {
    return ipcRenderer.invoke<ApplicationChatResponse>(APPLICATION_CHAT_CHANNELS.listModels);
  }

  /** Cancel one local chat stream and its provider conversation. */
  function abortApplicationChat(request: AbortApplicationChatRequest): Promise<ApplicationChatResponse> {
    return ipcRenderer.invoke<ApplicationChatResponse>(APPLICATION_CHAT_CHANNELS.abort, request);
  }

  /** Execute one explicitly requested provider tool. */
  function executeApplicationChatTool(
    request: ExecuteApplicationChatToolRequest,
  ): Promise<ApplicationChatResponse> {
    return ipcRenderer.invoke<ApplicationChatResponse>(APPLICATION_CHAT_CHANNELS.executeTool, request);
  }

  /** Resolve one pending provider-tool approval. */
  function resolveApplicationChatApproval(
    request: ResolveApplicationChatApprovalRequest,
  ): Promise<ApplicationChatResponse> {
    return ipcRenderer.invoke<ApplicationChatResponse>(APPLICATION_CHAT_CHANNELS.resolveApproval, request);
  }

  /** Subscribe to ordered private chat stream events. */
  function onApplicationChatStreamEvent(listener: ApplicationChatStreamListener): () => void {
    if (typeof listener !== "function") {
      throw new TypeError("Application Chat stream listener must be a function.");
    }

    /** Forward a trusted chat event without exposing the Electron event. */
    function handleApplicationChatStreamEvent(_event: unknown, event: ApplicationChatStreamEvent): void {
      listener(event);
    }

    ipcRenderer.on(APPLICATION_CHAT_CHANNELS.streamEvent, handleApplicationChatStreamEvent);

    /** Remove the exact chat stream listener registered by this subscription. */
    function unsubscribe(): void {
      ipcRenderer.removeListener(APPLICATION_CHAT_CHANNELS.streamEvent, handleApplicationChatStreamEvent);
    }
    return unsubscribe;
  }

  /** 构建一个知识库；输入稳定 scope，返回最终状态，不暴露私有引擎地址。 */
  function buildApplicationKnowledgeBase(
    request: ApplicationKnowledgeBaseScopeRequest,
  ): Promise<ApplicationKnowledgeBaseStatus> {
    return ipcRenderer.invoke<ApplicationKnowledgeBaseStatus>(
      APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS.build,
      request,
    );
  }

  /** 查询知识库状态；输入稳定 scope，返回固定状态，不激活 legacy backend。 */
  function getApplicationKnowledgeBaseStatus(
    request: ApplicationKnowledgeBaseScopeRequest,
  ): Promise<ApplicationKnowledgeBaseStatus> {
    return ipcRenderer.invoke<ApplicationKnowledgeBaseStatus>(
      APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS.status,
      request,
    );
  }

  /** 删除知识库索引；输入稳定 scope，返回删除结果，不暴露本机目录。 */
  function removeApplicationKnowledgeBase(
    request: ApplicationKnowledgeBaseScopeRequest,
  ): Promise<ApplicationKnowledgeBaseMutationResult> {
    return ipcRenderer.invoke<ApplicationKnowledgeBaseMutationResult>(
      APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS.remove,
      request,
    );
  }

  /** 检索知识库；输入有界查询，返回脱敏结果，不暴露 Provider 凭据。 */
  function queryApplicationKnowledgeBase(
    request: ApplicationKnowledgeBaseQueryRequest,
  ): Promise<ApplicationKnowledgeBaseQueryResult> {
    return ipcRenderer.invoke<ApplicationKnowledgeBaseQueryResult>(
      APPLICATION_KNOWLEDGE_BASE_RUNTIME_CHANNELS.query,
      request,
    );
  }

  /** 列出可操作窗口；输入有界筛选，返回不含进程路径的窗口元数据。 */
  function listApplicationDesktopControlWindows(
    request: ApplicationDesktopControlWindowListRequest,
  ): Promise<ApplicationDesktopControlWindowListResult> {
    return ipcRenderer.invoke<ApplicationDesktopControlWindowListResult>(
      APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS.listWindows,
      request,
    );
  }

  /** 列出显示器；无输入，返回有界显示器元数据，不激活 legacy backend。 */
  function listApplicationDesktopControlMonitors(): Promise<ApplicationDesktopControlMonitorListResult> {
    return ipcRenderer.invoke<ApplicationDesktopControlMonitorListResult>(
      APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS.listMonitors,
    );
  }

  /** 读取活动窗口；无输入，返回脱敏状态，不暴露本机进程路径。 */
  function getApplicationDesktopControlActiveWindow(): Promise<ApplicationDesktopControlActiveWindowResult> {
    return ipcRenderer.invoke<ApplicationDesktopControlActiveWindowResult>(
      APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS.getActiveWindow,
    );
  }

  /** 列出窗口动作历史；输入有界数量，返回当前 Worker 的脱敏记录。 */
  function listApplicationDesktopControlHistory(
    request: ApplicationDesktopControlHistoryRequest,
  ): Promise<ApplicationDesktopControlHistoryResult> {
    return ipcRenderer.invoke<ApplicationDesktopControlHistoryResult>(
      APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS.listHistory,
      request,
    );
  }

  /** 执行一个窗口动作；输入精确动作请求，返回脱敏窗口结果。 */
  function executeApplicationDesktopControlAction(
    request: ApplicationDesktopControlActionRequest,
  ): Promise<ApplicationDesktopControlActionResult> {
    return ipcRenderer.invoke<ApplicationDesktopControlActionResult>(
      APPLICATION_DESKTOP_CONTROL_RUNTIME_CHANNELS.executeAction,
      request,
    );
  }

  /** 探测一个 allow-list 本机工具；输入精确工具名，返回无路径结果。 */
  function probeApplicationToolchain(
    request: ApplicationToolchainProbeRequest,
  ): Promise<ApplicationToolchainProbeResult> {
    return ipcRenderer.invoke<ApplicationToolchainProbeResult>(
      APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS.probe,
      request,
    );
  }

  /** 列出 Docker 容器；无输入，返回有界摘要，不暴露命令输出。 */
  function listApplicationDockerContainers(): Promise<ApplicationDockerContainerListResult> {
    return ipcRenderer.invoke<ApplicationDockerContainerListResult>(
      APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS.listDockerContainers,
    );
  }

  /** 拉取 Docker 镜像；输入精确镜像引用，返回固定结果，不暴露 stdout/stderr。 */
  function pullApplicationDockerImage(
    request: ApplicationDockerImagePullRequest,
  ): Promise<ApplicationDockerMutationResult> {
    return ipcRenderer.invoke<ApplicationDockerMutationResult>(
      APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS.pullDockerImage,
      request,
    );
  }

  /** 执行 Docker 容器动作；输入精确容器和动作，返回固定结果。 */
  function mutateApplicationDockerContainer(
    request: ApplicationDockerContainerMutationRequest,
  ): Promise<ApplicationDockerMutationResult> {
    return ipcRenderer.invoke<ApplicationDockerMutationResult>(
      APPLICATION_TOOLCHAIN_RUNTIME_CHANNELS.mutateDockerContainer,
      request,
    );
  }

  /** 读取开发工作台概览；无输入，返回无密钥聚合状态，IPC 失败时拒绝 Promise。 */
  function getApplicationDeveloperWorkbenchOverview(): Promise<DeveloperWorkbenchOverview> {
    return ipcRenderer.invoke<DeveloperWorkbenchOverview>(APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.overview);
  }

  /** 扫描已配置仓库；无输入，返回有界摘要，扫描或 IPC 失败时拒绝 Promise。 */
  function listApplicationDeveloperWorkbenchRepositories(): Promise<DeveloperWorkbenchRepositoriesResult> {
    return ipcRenderer.invoke<DeveloperWorkbenchRepositoriesResult>(
      APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.repositories,
    );
  }

  /** 搜索已授权代码；输入有界查询，返回相对路径命中，校验或扫描失败时拒绝 Promise。 */
  function searchApplicationDeveloperWorkbenchCode(
    request: DeveloperWorkbenchCodeSearchRequest,
  ): Promise<DeveloperWorkbenchCodeSearchResult> {
    return ipcRenderer.invoke<DeveloperWorkbenchCodeSearchResult>(
      APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.searchCode,
      request,
    );
  }

  /** 列出本地工作台快照；无输入，返回有界摘要，读取失败时拒绝 Promise。 */
  function listApplicationDeveloperWorkbenchSnapshots(): Promise<DeveloperWorkbenchSnapshotListResult> {
    return ipcRenderer.invoke<DeveloperWorkbenchSnapshotListResult>(
      APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.listSnapshots,
    );
  }

  /** 创建本地工作台快照；输入包含范围，返回快照摘要，校验或写盘失败时拒绝 Promise。 */
  function createApplicationDeveloperWorkbenchSnapshot(
    request: CreateDeveloperWorkbenchSnapshotRequest,
  ): Promise<DeveloperWorkbenchSnapshotWriteResult> {
    return ipcRenderer.invoke<DeveloperWorkbenchSnapshotWriteResult>(
      APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.createSnapshot,
      request,
    );
  }

  /** 导入无密钥工作台快照；输入 JSON 文档，返回快照摘要，敏感字段或写盘失败时拒绝 Promise。 */
  function importApplicationDeveloperWorkbenchSnapshot(
    request: ImportDeveloperWorkbenchSnapshotRequest,
  ): Promise<DeveloperWorkbenchSnapshotWriteResult> {
    return ipcRenderer.invoke<DeveloperWorkbenchSnapshotWriteResult>(
      APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.importSnapshot,
      request,
    );
  }

  /** 读取一个工作台快照；输入稳定 ID，返回 JSON 文档，缺失或损坏时拒绝 Promise。 */
  function getApplicationDeveloperWorkbenchSnapshot(
    request: DeveloperWorkbenchSnapshotRequest,
  ): Promise<DeveloperWorkbenchSnapshotDocumentResult> {
    return ipcRenderer.invoke<DeveloperWorkbenchSnapshotDocumentResult>(
      APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.getSnapshot,
      request,
    );
  }

  /** 恢复一个工作台快照；输入稳定 ID，返回恢复结果，缺失或状态写入失败时拒绝 Promise。 */
  function restoreApplicationDeveloperWorkbenchSnapshot(
    request: DeveloperWorkbenchSnapshotRequest,
  ): Promise<DeveloperWorkbenchSnapshotMutationResult> {
    return ipcRenderer.invoke<DeveloperWorkbenchSnapshotMutationResult>(
      APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.restoreSnapshot,
      request,
    );
  }

  /** 删除一个工作台快照；输入稳定 ID，返回删除结果，缺失或删除失败时拒绝 Promise。 */
  function deleteApplicationDeveloperWorkbenchSnapshot(
    request: DeveloperWorkbenchSnapshotRequest,
  ): Promise<DeveloperWorkbenchSnapshotMutationResult> {
    return ipcRenderer.invoke<DeveloperWorkbenchSnapshotMutationResult>(
      APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.deleteSnapshot,
      request,
    );
  }

  /** 应用 Main 授权的工作区；输入精确配置，返回规范配置，目录未授权或写盘失败时拒绝 Promise。 */
  function applyApplicationDeveloperWorkbenchWorkspace(
    request: ApplyDeveloperWorkbenchWorkspaceRequest,
  ): Promise<ApplyDeveloperWorkbenchWorkspaceResult> {
    return ipcRenderer.invoke<ApplyDeveloperWorkbenchWorkspaceResult>(
      APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.applyWorkspace,
      request,
    );
  }

  /** 应用默认 Agent 映射；输入 Agent ID，返回模型映射，Agent 未知或写盘失败时拒绝 Promise。 */
  function applyApplicationDeveloperWorkbenchMapping(
    request: ApplyDeveloperWorkbenchMappingRequest,
  ): Promise<ApplyDeveloperWorkbenchMappingResult> {
    return ipcRenderer.invoke<ApplyDeveloperWorkbenchMappingResult>(
      APPLICATION_DEVELOPER_WORKBENCH_CHANNELS.applyMapping,
      request,
    );
  }

  /** 读取 Recall 首屏；无输入，返回聚合结果，不激活 legacy backend。 */
  function getApplicationRecallBootstrap(): Promise<ApplicationRecallBootstrapResult> {
    return ipcRenderer.invoke<ApplicationRecallBootstrapResult>(APPLICATION_RECALL_RUNTIME_CHANNELS.bootstrap);
  }

  /** 搜索 Recall；输入有界查询，返回脱敏结果，不暴露工作区内部路径。 */
  function searchApplicationRecall(
    request: ApplicationRecallSearchRequest,
  ): Promise<ApplicationRecallSearchResult> {
    return ipcRenderer.invoke<ApplicationRecallSearchResult>(APPLICATION_RECALL_RUNTIME_CHANNELS.search, request);
  }

  /** 读取 Recall 时间线；输入查询或锚点，返回有界渐进记录。 */
  function getApplicationRecallTimeline(
    request: ApplicationRecallTimelineRequest,
  ): Promise<ApplicationRecallTimelineResult> {
    return ipcRenderer.invoke<ApplicationRecallTimelineResult>(
      APPLICATION_RECALL_RUNTIME_CHANNELS.timeline,
      request,
    );
  }

  /** 读取 Recall 观察流；输入目标字段，返回有界详细记录。 */
  function getApplicationRecallObservations(
    request: ApplicationRecallObservationsRequest,
  ): Promise<ApplicationRecallObservationsResult> {
    return ipcRenderer.invoke<ApplicationRecallObservationsResult>(
      APPLICATION_RECALL_RUNTIME_CHANNELS.observations,
      request,
    );
  }

  /** 恢复中断 turn；输入精确 ID，返回恢复提示。 */
  function resumeApplicationRecall(
    request: ApplicationRecallResumeRequest,
  ): Promise<ApplicationRecallResumeResult> {
    return ipcRenderer.invoke<ApplicationRecallResumeResult>(APPLICATION_RECALL_RUNTIME_CHANNELS.resume, request);
  }

  /** 恢复工作区检查点；输入精确 ID，返回固定成功结果。 */
  function rollbackApplicationRecall(
    request: ApplicationRecallRollbackRequest,
  ): Promise<ApplicationRecallRollbackResult> {
    return ipcRenderer.invoke<ApplicationRecallRollbackResult>(
      APPLICATION_RECALL_RUNTIME_CHANNELS.rollback,
      request,
    );
  }

  /** 发布 Recall 观察焦点；输入有界展示数据，返回 Desktop 浮层投递数量。 */
  function publishApplicationRecallObservationFocus(
    request: ApplicationRecallObservationFocusRequest,
  ): Promise<ApplicationRecallObservationFocusResult> {
    return ipcRenderer.invoke<ApplicationRecallObservationFocusResult>(
      APPLICATION_RECALL_RUNTIME_CHANNELS.publishObservationFocus,
      request,
    );
  }

  /** Retrieve redacted provider metadata from Application Core. */
  function getApplicationProviders(): Promise<ApplicationProviderSnapshot> {
    return ipcRenderer.invoke<ApplicationProviderSnapshot>(APPLICATION_PROVIDER_CHANNELS.getSnapshot);
  }

  /** Persist provider metadata and newly entered credentials through Main. */
  function saveApplicationProviders(
    request: SaveApplicationProvidersRequest,
  ): Promise<ApplicationProviderSnapshot> {
    return ipcRenderer.invoke<ApplicationProviderSnapshot>(
      APPLICATION_PROVIDER_CHANNELS.saveProviders,
      request,
    );
  }

  /** Validate one provider without returning its credential to Renderer. */
  function validateApplicationProvider(
    request: ValidateApplicationProviderRequest,
  ): Promise<ApplicationProviderValidationResult> {
    return ipcRenderer.invoke<ApplicationProviderValidationResult>(
      APPLICATION_PROVIDER_CHANNELS.validateProvider,
      request,
    );
  }

  /** 使用 Main 私有 Provider 凭据探测向量维度；输入已保存 Provider ID，返回无密钥结果。 */
  function probeApplicationProviderEmbedding(
    request: ProbeApplicationProviderEmbeddingRequest,
  ): Promise<ApplicationProviderEmbeddingProbeResult> {
    return ipcRenderer.invoke<ApplicationProviderEmbeddingProbeResult>(
      APPLICATION_PROVIDER_CHANNELS.probeEmbedding,
      request,
    );
  }

  /** 在 Main 创建 Agent 快照；输入名称和提示词，返回不含路径的公开元数据。 */
  function createApplicationAgent(
    request: CreateApplicationAgentRequest,
  ): Promise<ApplicationAgentMutationResult> {
    return ipcRenderer.invoke<ApplicationAgentMutationResult>(
      APPLICATION_AGENT_RUNTIME_CHANNELS.createAgent,
      request,
    );
  }

  /** 在 Main 删除 Agent 快照；输入稳定 ID，返回删除结果。 */
  function removeApplicationAgent(
    request: RemoveApplicationAgentRequest,
  ): Promise<ApplicationAgentMutationResult> {
    return ipcRenderer.invoke<ApplicationAgentMutationResult>(
      APPLICATION_AGENT_RUNTIME_CHANNELS.removeAgent,
      request,
    );
  }

  /** 通过 Main 探测 A2A Agent Card；输入受限 URL，返回有界公开卡片。 */
  function inspectApplicationA2a(
    request: InspectApplicationA2aRequest,
  ): Promise<ApplicationA2aInspectionResult> {
    return ipcRenderer.invoke<ApplicationA2aInspectionResult>(
      APPLICATION_AGENT_RUNTIME_CHANNELS.inspectA2a,
      request,
    );
  }

  /** 列出一个记忆集合；输入稳定 ID，返回无路径记录。 */
  function listApplicationMemoryRecords(
    request: ApplicationMemoryCollectionRequest,
  ): Promise<ApplicationMemoryRecordListResult> {
    return ipcRenderer.invoke<ApplicationMemoryRecordListResult>(
      APPLICATION_MEMORY_MANAGEMENT_CHANNELS.listRecords,
      request,
    );
  }

  /** 更新一个稳定记忆记录；输入 ID 和文本，返回固定变更结果。 */
  function updateApplicationMemoryRecord(
    request: UpdateApplicationMemoryRecordRequest,
  ): Promise<ApplicationMemoryMutationResult> {
    return ipcRenderer.invoke<ApplicationMemoryMutationResult>(
      APPLICATION_MEMORY_MANAGEMENT_CHANNELS.updateRecord,
      request,
    );
  }

  /** 删除一个稳定记忆记录；输入集合和记录 ID，返回固定变更结果。 */
  function deleteApplicationMemoryRecord(
    request: ApplicationMemoryRecordRequest,
  ): Promise<ApplicationMemoryMutationResult> {
    return ipcRenderer.invoke<ApplicationMemoryMutationResult>(
      APPLICATION_MEMORY_MANAGEMENT_CHANNELS.deleteRecord,
      request,
    );
  }

  /** 删除一个记忆集合；输入稳定集合 ID，返回固定变更结果。 */
  function removeApplicationMemoryCollection(
    request: ApplicationMemoryCollectionRequest,
  ): Promise<ApplicationMemoryMutationResult> {
    return ipcRenderer.invoke<ApplicationMemoryMutationResult>(
      APPLICATION_MEMORY_MANAGEMENT_CHANNELS.removeCollection,
      request,
    );
  }

  /** 恢复可信的 V3 记忆；输入目标 Agent，返回来源、数量与完整性状态。 */
  function recoverSynapxnetMemories(
    request: RecoverSynapxnetMemoriesRequest,
  ): Promise<SynapxnetMemoryRecoveryResult> {
    return ipcRenderer.invoke<SynapxnetMemoryRecoveryResult>(
      APPLICATION_SYNAPXNET_MEMORY_CHANNELS.recover,
      request,
    );
  }

  /** 读取 V3 分层、共享和审计总览；无输入，返回不含正文的状态。 */
  function getSynapxnetMemoryStatus(): Promise<SynapxnetMemoryStatusResult> {
    return ipcRenderer.invoke<SynapxnetMemoryStatusResult>(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.status);
  }

  /** 查询可访问的 V3 记忆；输入过滤条件，返回记忆列表。 */
  function listSynapxnetMemories(request: ListSynapxnetMemoriesRequest): Promise<SynapxnetMemoryListResult> {
    return ipcRenderer.invoke<SynapxnetMemoryListResult>(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.list, request);
  }

  /** 查询单条 V3 记忆的版本历史；输入记忆和请求者身份，返回版本链。 */
  function getSynapxnetMemoryHistory(request: SynapxnetMemoryIdentityRequest): Promise<SynapxnetMemoryHistoryResult> {
    return ipcRenderer.invoke<SynapxnetMemoryHistoryResult>(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.history, request);
  }

  /** 创建一条 V3 长期记忆；输入内容和权限，返回已提交记录。 */
  function createSynapxnetMemory(request: CreateSynapxnetMemoryRequest): Promise<SynapxnetMemoryRecord> {
    return ipcRenderer.invoke<SynapxnetMemoryRecord>(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.create, request);
  }

  /** 编辑一条 V3 记忆；输入基础版本和新内容，返回新版本记录。 */
  function editSynapxnetMemory(request: EditSynapxnetMemoryRequest): Promise<SynapxnetMemoryRecord> {
    return ipcRenderer.invoke<SynapxnetMemoryRecord>(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.edit, request);
  }

  /** 回滚一条 V3 记忆；输入目标版本和原因，返回回滚后记录。 */
  function rollbackSynapxnetMemory(request: RollbackSynapxnetMemoryRequest): Promise<SynapxnetMemoryRecord> {
    return ipcRenderer.invoke<SynapxnetMemoryRecord>(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.rollback, request);
  }

  /** 退役一条 V3 记忆；输入记忆和操作者身份，返回退役记录。 */
  function retireSynapxnetMemory(request: RetireSynapxnetMemoryRequest): Promise<SynapxnetMemoryRecord> {
    return ipcRenderer.invoke<SynapxnetMemoryRecord>(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.retire, request);
  }

  /** 导出可迁移的 V3 记忆文档；输入记忆摘要列表，返回完整性受保护的文档。 */
  function exportSynapxnetMemories(request: ExportSynapxnetMemoriesRequest): Promise<SynapxnetMemoryTransferDocument> {
    return ipcRenderer.invoke<SynapxnetMemoryTransferDocument>(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.export, request);
  }

  /** 导入 V3 记忆文档；输入目标所有者和文档，返回导入结果。 */
  function importSynapxnetMemories(request: ImportSynapxnetMemoriesRequest): Promise<SynapxnetMemoryImportResult> {
    return ipcRenderer.invoke<SynapxnetMemoryImportResult>(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.import, request);
  }

  /** 校验 V3 记忆和审计链完整性；输入范围，返回健康结果。 */
  function verifySynapxnetMemory(request: VerifySynapxnetMemoryRequest): Promise<SynapxnetMemoryIntegrityResult> {
    return ipcRenderer.invoke<SynapxnetMemoryIntegrityResult>(APPLICATION_SYNAPXNET_MEMORY_CHANNELS.verify, request);
  }

  /** Retrieve legacy Renderer state without starting the Python backend. */
  function getLegacyRendererState(): Promise<LegacyRendererStateSnapshot> {
    return ipcRenderer.invoke<LegacyRendererStateSnapshot>(LEGACY_RENDERER_STATE_CHANNELS.getSnapshot);
  }

  /** Persist one bounded compatibility settings replacement. */
  function saveLegacyRendererSettings(
    request: SaveLegacyRendererSettingsRequest,
  ): Promise<LegacyRendererStateSnapshot> {
    return ipcRenderer.invoke<LegacyRendererStateSnapshot>(
      LEGACY_RENDERER_STATE_CHANNELS.saveSettings,
      request,
    );
  }

  /** Persist one bounded compatibility conversations replacement. */
  function saveLegacyRendererConversations(
    request: SaveLegacyRendererConversationsRequest,
  ): Promise<LegacyRendererStateSnapshot> {
    return ipcRenderer.invoke<LegacyRendererStateSnapshot>(
      LEGACY_RENDERER_STATE_CHANNELS.saveConversations,
      request,
    );
  }

  /** Persist one bounded compatibility VRM settings replacement. */
  function saveLegacyRendererVrmConfig(
    request: SaveLegacyRendererVrmConfigRequest,
  ): Promise<LegacyRendererStateSnapshot> {
    return ipcRenderer.invoke<LegacyRendererStateSnapshot>(
      LEGACY_RENDERER_STATE_CHANNELS.saveVrmConfig,
      request,
    );
  }

  /** Subscribe to compatibility state changes from other Renderer windows. */
  function onLegacyRendererStateChanged(listener: LegacyRendererStateChangedListener): () => void {
    if (typeof listener !== "function") {
      throw new TypeError("Legacy Renderer state listener must be a function.");
    }

    /** Forward a trusted compatibility state event without Electron internals. */
    function handleLegacyRendererStateChanged(_event: unknown, event: LegacyRendererStateChangedEvent): void {
      listener(event);
    }

    ipcRenderer.on(LEGACY_RENDERER_STATE_CHANNELS.changed, handleLegacyRendererStateChanged);

    /** Remove the exact compatibility state listener. */
    function unsubscribe(): void {
      ipcRenderer.removeListener(LEGACY_RENDERER_STATE_CHANNELS.changed, handleLegacyRendererStateChanged);
    }
    return unsubscribe;
  }

  /** Retrieve aggregate Core state through an allow-listed channel. */
  function getState(): Promise<DesktopCoreSnapshot> {
    return ipcRenderer.invoke<DesktopCoreSnapshot>(DESKTOP_CORE_CHANNELS.getState);
  }

  /** Retrieve all capability states through an allow-listed channel. */
  function listCapabilities(): Promise<readonly CapabilitySnapshot[]> {
    return ipcRenderer.invoke<readonly CapabilitySnapshot[]>(DESKTOP_CORE_CHANNELS.listCapabilities);
  }

  /** Request activation of one validated desktop capability. */
  function ensureCapability(request: EnsureCapabilityRequest): Promise<CapabilitySnapshot> {
    return ipcRenderer.invoke<CapabilitySnapshot>(DESKTOP_CORE_CHANNELS.ensureCapability, request);
  }

  /** Retrieve installed Feature Pack health and signed catalog state. */
  function listFeaturePacks(
    request: ListFeaturePacksRequest = {},
  ): Promise<FeaturePackDistributionSnapshot> {
    return ipcRenderer.invoke<FeaturePackDistributionSnapshot>(
      DESKTOP_CORE_CHANNELS.listFeaturePacks,
      request,
    );
  }

  /** Install one allow-listed Feature Pack through Electron Main. */
  function installFeaturePack(
    request: MutateFeaturePackRequest,
  ): Promise<FeaturePackMutationResult> {
    return ipcRenderer.invoke<FeaturePackMutationResult>(
      DESKTOP_CORE_CHANNELS.installFeaturePack,
      request,
    );
  }

  /** Repair one allow-listed Feature Pack through Electron Main. */
  function repairFeaturePack(
    request: MutateFeaturePackRequest,
  ): Promise<FeaturePackMutationResult> {
    return ipcRenderer.invoke<FeaturePackMutationResult>(
      DESKTOP_CORE_CHANNELS.repairFeaturePack,
      request,
    );
  }

  /** Uninstall one allow-listed Feature Pack through Electron Main. */
  function uninstallFeaturePack(
    request: MutateFeaturePackRequest,
  ): Promise<FeaturePackMutationResult> {
    return ipcRenderer.invoke<FeaturePackMutationResult>(
      DESKTOP_CORE_CHANNELS.uninstallFeaturePack,
      request,
    );
  }

  /** Subscribe to sanitized Feature Pack progress and return an unsubscriber. */
  function onFeaturePackProgress(listener: FeaturePackProgressListener): () => void {
    if (typeof listener !== "function") {
      throw new TypeError("Feature Pack progress listener must be a function.");
    }

    /** Forward a trusted Main-process progress event without exposing Electron internals. */
    function handleFeaturePackProgress(_event: unknown, progress: FeaturePackProgressEvent): void {
      listener(progress);
    }

    ipcRenderer.on(DESKTOP_CORE_CHANNELS.featurePackProgress, handleFeaturePackProgress);

    /** Remove the exact Feature Pack progress listener registered by this subscription. */
    function unsubscribe(): void {
      ipcRenderer.removeListener(DESKTOP_CORE_CHANNELS.featurePackProgress, handleFeaturePackProgress);
    }
    return unsubscribe;
  }

  /** Subscribe to aggregate state changes and return an explicit unsubscriber. */
  function onStateChanged(listener: DesktopCoreStateListener): () => void {
    if (typeof listener !== "function") {
      throw new TypeError("Desktop Core state listener must be a function.");
    }

    /** Forward a trusted main-process snapshot without exposing the Electron event. */
    function handleStateChanged(_event: unknown, snapshot: DesktopCoreSnapshot): void {
      listener(snapshot);
    }

    ipcRenderer.on(DESKTOP_CORE_CHANNELS.stateChanged, handleStateChanged);

    /** Remove the exact state listener registered by this subscription. */
    function unsubscribe(): void {
      ipcRenderer.removeListener(DESKTOP_CORE_CHANNELS.stateChanged, handleStateChanged);
    }

    return unsubscribe;
  }

  const api: OpenXnetDesktopApi = {
    getBootstrapSnapshot,
    getAuthSession,
    saveAuthSession,
    clearAuthSession,
    requestAccess,
    getApplicationSearchCredentials,
    saveApplicationSearchCredentials,
    getApplicationVoiceCredentials,
    saveApplicationVoiceCredentials,
    transcribeApplicationVoice,
    synthesizeApplicationVoice,
    listApplicationSystemVoices,
    listApplicationProviderVoices,
    importApplicationVoiceReference,
    removeApplicationVoiceReference,
    getApplicationVrmPresentationStatus,
    publishApplicationVrmPresentation,
    applyApplicationSystemProxy,
    revealApplicationSystemDirectory,
    getApplicationSystemNetworkAddress,
    getApplicationMcpCredentials,
    saveApplicationMcpCredentials,
    getApplicationMcpRuntimeStatus,
    startApplicationMcpRuntime,
    stopApplicationMcpRuntime,
    listApplicationMcpRuntimeTools,
    getApplicationHttpToolCredentials,
    saveApplicationHttpToolCredentials,
    getApplicationConnectorCredentials,
    saveApplicationConnectorCredentials,
    getApplicationConnectorRuntimeStatus,
    startApplicationConnectorRuntime,
    stopApplicationConnectorRuntime,
    reloadApplicationConnectorRuntime,
    updateApplicationConnectorRuntime,
    getApplicationTelegramCredentials,
    saveApplicationTelegramCredentials,
    getApplicationImageHostCredentials,
    saveApplicationImageHostCredentials,
    getApplicationRepositoryCredentials,
    saveApplicationRepositoryCredentials,
    getApplicationLivePlatformCredentials,
    saveApplicationLivePlatformCredentials,
    getApplicationLiveRuntimeStatus,
    startApplicationLiveRuntime,
    stopApplicationLiveRuntime,
    reloadApplicationLiveRuntime,
    onApplicationLiveRuntimeEvent,
    getApplicationCodeSandboxCredentials,
    saveApplicationCodeSandboxCredentials,
    getApplicationHomeAssistantCredentials,
    saveApplicationHomeAssistantCredentials,
    getApplicationSqlCredentials,
    saveApplicationSqlCredentials,
    selectApplicationSqliteDatabase,
    getApplicationComfyUiCredentials,
    saveApplicationComfyUiCredentials,
    getApplicationDeliveryCredentials,
    saveApplicationDeliveryCredentials,
    listArtifacts,
    importArtifacts,
    importSelectedArtifacts,
    listApplicationVrAssets,
    importApplicationVrAsset,
    deleteApplicationVrAsset,
    downloadApplicationCloudVrmModel,
    listApplicationExtensions,
    listRemoteApplicationExtensions,
    installApplicationExtensionFromRepository,
    importApplicationExtensionArchive,
    updateApplicationExtension,
    removeApplicationExtension,
    startApplicationExtension,
    stopApplicationExtension,
    listApplicationSkills,
    getApplicationSkillContent,
    installApplicationSkillFromRepository,
    importApplicationSkillArchive,
    crystallizeApplicationSkill,
    uploadApplicationSkillToMlops,
    removeApplicationSkill,
    getApplicationProjectSkillStatus,
    syncApplicationProjectSkill,
    revealApplicationSkillsDirectory,
    listApplicationEnterpriseRoleCards,
    saveApplicationEnterpriseRoleCard,
    removeApplicationEnterpriseRoleCard,
    listApplicationEnterpriseTeamTemplates,
    saveApplicationEnterpriseTeamTemplate,
    removeApplicationEnterpriseTeamTemplate,
    listApplicationEnterpriseKnowledgeBases,
    saveApplicationEnterpriseKnowledgeBase,
    removeApplicationEnterpriseKnowledgeBase,
    listApplicationEnterpriseKnowledgeBaseVersions,
    listApplicationEnterpriseWorkspaces,
    saveApplicationEnterpriseWorkspace,
    removeApplicationEnterpriseWorkspace,
    listApplicationEnterpriseProjects,
    saveApplicationEnterpriseProject,
    removeApplicationEnterpriseProject,
    listApplicationEnterpriseMessages,
    postApplicationEnterpriseMessage,
    listApplicationEnterpriseSkillBindings,
    setApplicationEnterpriseSkillBinding,
    getApplicationEnterpriseSandboxState,
    listApplicationEnterpriseXnetServices,
    saveApplicationEnterpriseXnetService,
    checkApplicationEnterpriseXnetService,
    checkAllApplicationEnterpriseXnetServices,
    loadApplicationEnterpriseUsageDashboard,
    loadApplicationEnterpriseNeuroDashboard,
    searchApplicationEnterpriseNeuroSymbols,
    removeApplicationEnterpriseNeuroSymbol,
    runApplicationEnterpriseNeuroMaintenance,
    loadApplicationEnterpriseKnowledgeGraph,
    queryApplicationEnterpriseKnowledgeGraphEntity,
    invokeApplicationKernel,
    getApplicationModelAssetStatus,
    downloadApplicationModelAsset,
    removeApplicationModelAsset,
    onApplicationModelAssetProgress,
    registerArtifacts,
    deleteArtifacts,
    listTasks,
    getTask,
    createTask,
    refreshTaskExecutions,
    getTaskExecution,
    createDeveloperWorkbenchTaskExecution,
    dispatchTaskExecution,
    startTaskExecution,
    resumeTaskExecution,
    cancelTaskExecution,
    deleteTaskExecution,
    onTaskExecutionChanged,
    startApplicationChatStream,
    completeApplicationChat,
    listApplicationChatModels,
    abortApplicationChat,
    executeApplicationChatTool,
    resolveApplicationChatApproval,
    onApplicationChatStreamEvent,
    buildApplicationKnowledgeBase,
    getApplicationKnowledgeBaseStatus,
    removeApplicationKnowledgeBase,
    queryApplicationKnowledgeBase,
    listApplicationDesktopControlWindows,
    listApplicationDesktopControlMonitors,
    getApplicationDesktopControlActiveWindow,
    listApplicationDesktopControlHistory,
    executeApplicationDesktopControlAction,
    probeApplicationToolchain,
    listApplicationDockerContainers,
    pullApplicationDockerImage,
    mutateApplicationDockerContainer,
    getApplicationDeveloperWorkbenchOverview,
    listApplicationDeveloperWorkbenchRepositories,
    searchApplicationDeveloperWorkbenchCode,
    listApplicationDeveloperWorkbenchSnapshots,
    createApplicationDeveloperWorkbenchSnapshot,
    importApplicationDeveloperWorkbenchSnapshot,
    getApplicationDeveloperWorkbenchSnapshot,
    restoreApplicationDeveloperWorkbenchSnapshot,
    deleteApplicationDeveloperWorkbenchSnapshot,
    applyApplicationDeveloperWorkbenchWorkspace,
    applyApplicationDeveloperWorkbenchMapping,
    getApplicationRecallBootstrap,
    searchApplicationRecall,
    getApplicationRecallTimeline,
    getApplicationRecallObservations,
    resumeApplicationRecall,
    rollbackApplicationRecall,
    publishApplicationRecallObservationFocus,
    getApplicationProviders,
    saveApplicationProviders,
    validateApplicationProvider,
    probeApplicationProviderEmbedding,
    createApplicationAgent,
    removeApplicationAgent,
    inspectApplicationA2a,
    listApplicationMemoryRecords,
    updateApplicationMemoryRecord,
    deleteApplicationMemoryRecord,
    removeApplicationMemoryCollection,
    recoverSynapxnetMemories,
    getSynapxnetMemoryStatus,
    listSynapxnetMemories,
    getSynapxnetMemoryHistory,
    createSynapxnetMemory,
    editSynapxnetMemory,
    rollbackSynapxnetMemory,
    retireSynapxnetMemory,
    exportSynapxnetMemories,
    importSynapxnetMemories,
    verifySynapxnetMemory,
    getLegacyRendererState,
    saveLegacyRendererSettings,
    saveLegacyRendererConversations,
    saveLegacyRendererVrmConfig,
    onLegacyRendererStateChanged,
    getState,
    listCapabilities,
    ensureCapability,
    listFeaturePacks,
    installFeaturePack,
    repairFeaturePack,
    uninstallFeaturePack,
    onFeaturePackProgress,
    onStateChanged,
  };
  contextBridge.exposeInMainWorld("openxnetDesktop", api);
}
