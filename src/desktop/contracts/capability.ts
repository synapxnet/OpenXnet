import type {
  FeaturePackDistributionSnapshot,
  FeaturePackMutationResult,
  FeaturePackProgressListener,
  ListFeaturePacksRequest,
  MutateFeaturePackRequest,
} from "./feature-pack-distribution";
import type {
  ApplicationAuthSnapshot,
  SaveApplicationAuthSessionRequest,
} from "./application-auth";
import type {
  ApplicationAccessRequest,
  ApplicationAccessResult,
} from "./application-access";
import type {
  ApplicationSystemNetworkAddressResult,
  ApplyApplicationSystemProxyResult,
  RevealApplicationSystemDirectoryRequest,
  RevealApplicationSystemDirectoryResult,
} from "./application-system-runtime";
import type {
  ApplicationSearchCredentialSnapshot,
  SaveApplicationSearchCredentialsRequest,
} from "./application-search-credentials";
import type {
  ApplicationVoiceCredentialSnapshot,
  SaveApplicationVoiceCredentialsRequest,
} from "./application-voice-credentials";
import type {
  ApplicationVoiceReferenceResult,
  ApplicationVoiceCatalogResult,
  ApplicationVoiceProviderCatalogRequest,
  ApplicationVoiceSynthesisRequest,
  ApplicationVoiceSynthesisResult,
  RemoveApplicationVoiceReferenceRequest,
  RemoveApplicationVoiceReferenceResult,
  RendererApplicationVoiceReferenceFile,
  ApplicationVoiceTranscriptionRequest,
  ApplicationVoiceTranscriptionResult,
} from "./application-voice-runtime";
import type {
  ApplicationVrmPresentationPublishRequest,
  ApplicationVrmPresentationPublishResult,
  ApplicationVrmPresentationStatus,
} from "./application-vrm-presentation-runtime";
import type {
  ApplicationMcpCredentialSnapshot,
  SaveApplicationMcpCredentialsRequest,
} from "./application-mcp-credentials";
import type {
  ApplicationMcpRuntimeIntegrationRequest,
  ApplicationMcpRuntimeResult,
  ApplicationMcpRuntimeStartRequest,
  ApplicationMcpRuntimeToolsResult,
} from "./application-mcp-runtime";
import type {
  ApplicationHttpToolCredentialSnapshot,
  SaveApplicationHttpToolCredentialsRequest,
} from "./application-http-tool-credentials";
import type {
  ApplicationConnectorCredentialSnapshot,
  SaveApplicationConnectorCredentialsRequest,
} from "./application-connector-credentials";
import type {
  ApplicationConnectorRuntimeMutationRequest,
  ApplicationConnectorRuntimePlatformRequest,
  ApplicationConnectorRuntimeResult,
} from "./application-connector-runtime";
import type {
  ApplicationTelegramCredentialSnapshot,
  SaveApplicationTelegramCredentialsRequest,
} from "./application-telegram-credentials";
import type {
  ApplicationImageHostCredentialSnapshot,
  SaveApplicationImageHostCredentialsRequest,
} from "./application-image-host-credentials";
import type {
  ApplicationRepositoryCredentialSnapshot,
  SaveApplicationRepositoryCredentialsRequest,
} from "./application-repository-credentials";
import type {
  ApplicationLivePlatformCredentialSnapshot,
  SaveApplicationLivePlatformCredentialsRequest,
} from "./application-live-platform-credentials";
import type {
  ApplicationLiveRuntimeEventListener,
  ApplicationLiveRuntimeMutationRequest,
  ApplicationLiveRuntimeResult,
} from "./application-live-runtime";
import type {
  ApplicationCodeSandboxCredentialSnapshot,
  SaveApplicationCodeSandboxCredentialsRequest,
} from "./application-code-sandbox-credentials";
import type {
  ApplicationHomeAssistantCredentialSnapshot,
  SaveApplicationHomeAssistantCredentialsRequest,
} from "./application-home-assistant-credentials";
import type {
  ApplicationSqlCredentialSnapshot,
  SaveApplicationSqlCredentialsRequest,
} from "./application-sql-credentials";
import type {
  ApplicationComfyUiCredentialSnapshot,
  SaveApplicationComfyUiCredentialsRequest,
} from "./application-comfyui-credentials";
import type {
  ApplicationDeliveryCredentialSnapshot,
  SaveApplicationDeliveryCredentialsRequest,
} from "./application-delivery-credentials";
import type {
  ApplicationArtifactSnapshot,
  ApplicationArtifactWriteResult,
  DeleteApplicationArtifactsRequest,
  DeleteApplicationArtifactsResult,
  ImportApplicationArtifactsRequest,
  ListApplicationArtifactsRequest,
  RendererApplicationArtifactFile,
  RegisterApplicationArtifactsRequest,
} from "./application-artifacts";
import type {
  ApplicationVrAssetCatalog,
  ApplicationVrAssetDeleteResult,
  ApplicationVrAssetWriteResult,
  DeleteApplicationVrAssetRequest,
  DownloadApplicationCloudVrmModelRequest,
  RendererImportApplicationVrAssetRequest,
} from "./application-vr-assets";
import type {
  ApplicationExtensionCatalog,
  ApplicationExtensionIdRequest,
  ApplicationExtensionMutationResult,
  ApplicationExtensionStartResult,
  ApplicationExtensionWriteResult,
  ApplicationRemoteExtensionCatalog,
  InstallApplicationExtensionRepositoryRequest,
  RendererImportApplicationExtensionArchiveRequest,
} from "./application-extensions-runtime";
import type {
  ApplicationProjectSkillStatus,
  ApplicationSkillCatalog,
  ApplicationSkillContentResult,
  ApplicationSkillDirectoryResult,
  ApplicationSkillIdRequest,
  ApplicationSkillMlopsUploadResult,
  ApplicationSkillMutationResult,
  ApplicationSkillWriteResult,
  CrystallizeApplicationSkillRequest,
  InstallApplicationSkillRepositoryRequest,
  RendererImportApplicationSkillArchiveRequest,
  SyncApplicationSkillProjectRequest,
  UploadApplicationSkillToMlopsRequest,
} from "./application-skills-runtime";
import type {
  ApplicationEnterpriseKnowledgeBaseListResult,
  ApplicationEnterpriseKnowledgeBaseRequest,
  ApplicationEnterpriseKnowledgeBaseVersionListResult,
  ApplicationEnterpriseKnowledgeBaseWriteResult,
  ApplicationEnterpriseMessageListResult,
  ApplicationEnterpriseMessageWriteResult,
  ApplicationEnterpriseProjectListResult,
  ApplicationEnterpriseProjectRequest,
  ApplicationEnterpriseProjectWriteResult,
  ApplicationEnterpriseRemoveResult,
  ApplicationEnterpriseRoleCardListResult,
  ApplicationEnterpriseRoleCardRequest,
  ApplicationEnterpriseRoleCardWriteResult,
  ApplicationEnterpriseSandboxStateResult,
  ApplicationEnterpriseSkillBindingListResult,
  ApplicationEnterpriseSkillBindingWriteResult,
  ApplicationEnterpriseTeamTemplateListResult,
  ApplicationEnterpriseTeamTemplateRequest,
  ApplicationEnterpriseTeamTemplateWriteResult,
  ApplicationEnterpriseWorkspaceListResult,
  ApplicationEnterpriseWorkspaceRequest,
  ApplicationEnterpriseWorkspaceWriteResult,
  ApplicationEnterpriseXnetServiceListResult,
  ApplicationEnterpriseXnetServiceRequest,
  ApplicationEnterpriseXnetServiceWriteResult,
  CheckAllApplicationEnterpriseXnetServicesRequest,
  ListApplicationEnterpriseMessagesRequest,
  PostApplicationEnterpriseMessageRequest,
  SaveApplicationEnterpriseKnowledgeBaseRequest,
  SaveApplicationEnterpriseProjectRequest,
  SaveApplicationEnterpriseRoleCardRequest,
  SaveApplicationEnterpriseTeamTemplateRequest,
  SaveApplicationEnterpriseWorkspaceRequest,
  SetApplicationEnterpriseSkillBindingRequest,
  SaveApplicationEnterpriseXnetServiceRequest,
} from "./application-enterprise-runtime";
import type {
  ApplicationEnterpriseKnowledgeGraphEntityRequest,
  ApplicationEnterpriseKnowledgeGraphEntityResult,
  ApplicationEnterpriseKnowledgeGraphRequest,
  ApplicationEnterpriseKnowledgeGraphResult,
  ApplicationEnterpriseNeuroDashboardRequest,
  ApplicationEnterpriseNeuroDashboardResult,
  ApplicationEnterpriseNeuroMaintenanceResult,
  ApplicationEnterpriseNeuroRemoveResult,
  ApplicationEnterpriseNeuroSearchRequest,
  ApplicationEnterpriseNeuroSearchResult,
  ApplicationEnterpriseNeuroSymbolRequest,
  ApplicationEnterpriseUsageDashboardRequest,
  ApplicationEnterpriseUsageDashboardResult,
} from "./application-enterprise-insights-runtime";
import type {
  ApplicationKernelCommandRequest,
  ApplicationKernelCommandResult,
} from "./application-kernel-runtime";
import type {
  ApplicationModelAssetProgressListener,
  ApplicationModelAssetRequest,
  ApplicationModelAssetStatus,
  DownloadApplicationModelAssetRequest,
} from "./application-model-assets";
import type {
  ApplicationTask,
  ApplicationTaskDetail,
  ApplicationTaskSnapshot,
  CreateApplicationTaskRequest,
  GetApplicationTaskRequest,
  ListApplicationTasksRequest,
} from "./application-tasks";
import type { DesktopBootstrapSnapshot } from "./desktop-bootstrap";
import type {
  ApplicationTaskExecutionDetail,
  ApplicationTaskExecutionListener,
  ApplicationTaskExecutionRequest,
  ApplicationTaskExecutionSnapshot,
  CreateDeveloperWorkbenchTaskExecutionRequest,
  RefreshApplicationTaskExecutionsRequest,
  ResumeApplicationTaskExecutionRequest,
  StartApplicationTaskExecutionRequest,
} from "./application-task-execution";
import type {
  AbortApplicationChatRequest,
  ApplicationChatResponse,
  ApplicationChatStreamAcknowledgement,
  ApplicationChatStreamListener,
  CompleteApplicationChatRequest,
  ExecuteApplicationChatToolRequest,
  ResolveApplicationChatApprovalRequest,
  StartApplicationChatStreamRequest,
} from "./application-chat";
import type {
  ApplicationKnowledgeBaseMutationResult,
  ApplicationKnowledgeBaseQueryRequest,
  ApplicationKnowledgeBaseQueryResult,
  ApplicationKnowledgeBaseScopeRequest,
  ApplicationKnowledgeBaseStatus,
} from "./application-knowledge-base-runtime";
import type {
  ApplicationDesktopControlActionRequest,
  ApplicationDesktopControlActionResult,
  ApplicationDesktopControlActiveWindowResult,
  ApplicationDesktopControlHistoryRequest,
  ApplicationDesktopControlHistoryResult,
  ApplicationDesktopControlMonitorListResult,
  ApplicationDesktopControlWindowListRequest,
  ApplicationDesktopControlWindowListResult,
} from "./application-desktop-control-runtime";
import type {
  ApplicationDockerContainerListResult,
  ApplicationDockerContainerMutationRequest,
  ApplicationDockerImagePullRequest,
  ApplicationDockerMutationResult,
  ApplicationToolchainProbeRequest,
  ApplicationToolchainProbeResult,
} from "./application-toolchain-runtime";
import type {
  ApplyDeveloperWorkbenchMappingRequest,
  ApplyDeveloperWorkbenchMappingResult,
  ApplyDeveloperWorkbenchWorkspaceRequest,
  ApplyDeveloperWorkbenchWorkspaceResult,
  CreateDeveloperWorkbenchSnapshotRequest,
  DeveloperWorkbenchCodeSearchRequest,
  DeveloperWorkbenchCodeSearchResult,
  DeveloperWorkbenchOverview,
  DeveloperWorkbenchRepositoriesResult,
  DeveloperWorkbenchSnapshotDocumentResult,
  DeveloperWorkbenchSnapshotListResult,
  DeveloperWorkbenchSnapshotMutationResult,
  DeveloperWorkbenchSnapshotRequest,
  DeveloperWorkbenchSnapshotWriteResult,
  ImportDeveloperWorkbenchSnapshotRequest,
} from "./application-developer-workbench-runtime";
import type {
  ApplicationRecallBootstrapResult,
  ApplicationRecallObservationFocusRequest,
  ApplicationRecallObservationFocusResult,
  ApplicationRecallObservationsRequest,
  ApplicationRecallObservationsResult,
  ApplicationRecallResumeRequest,
  ApplicationRecallResumeResult,
  ApplicationRecallRollbackRequest,
  ApplicationRecallRollbackResult,
  ApplicationRecallSearchRequest,
  ApplicationRecallSearchResult,
  ApplicationRecallTimelineRequest,
  ApplicationRecallTimelineResult,
} from "./application-recall-runtime";
import type {
  LegacyRendererStateChangedListener,
  LegacyRendererStateSnapshot,
  SaveLegacyRendererConversationsRequest,
  SaveLegacyRendererSettingsRequest,
  SaveLegacyRendererVrmConfigRequest,
} from "./legacy-renderer-state";
import type {
  ApplicationProviderEmbeddingProbeResult,
  ApplicationProviderSnapshot,
  ApplicationProviderValidationResult,
  ProbeApplicationProviderEmbeddingRequest,
  SaveApplicationProvidersRequest,
  ValidateApplicationProviderRequest,
} from "./application-providers";
import type {
  ApplicationA2aInspectionResult,
  ApplicationAgentMutationResult,
  CreateApplicationAgentRequest,
  InspectApplicationA2aRequest,
  RemoveApplicationAgentRequest,
} from "./application-agent-runtime";
import type {
  ApplicationMemoryCollectionRequest,
  ApplicationMemoryMutationResult,
  ApplicationMemoryRecordListResult,
  ApplicationMemoryRecordRequest,
  UpdateApplicationMemoryRecordRequest,
} from "./application-memory-management-runtime";

/** Stable protocol version exposed by Desktop Core to Renderer clients. */
export const DESKTOP_CORE_PROTOCOL_VERSION = "1.0";

/** Capability identifiers supported by the first desktop migration boundary. */
export const CAPABILITY_IDS = [
  "core",
  "legacy-backend",
  "execution-engine",
  "chat",
  "tasks",
  "voice",
  "vector-index",
  "memory",
  "documents",
  "connectors",
  "live",
  "mcp",
  "agentteams",
  "desktop-control",
  "gitnexus",
  "vr",
] as const;

/** Runtime technologies that can implement a desktop capability. */
export const CAPABILITY_RUNTIMES = ["typescript", "python", "node", "native", "asset"] as const;

/** Lifecycle states shared by Core, Renderer, and capability installers. */
export const CAPABILITY_STATES = [
  "unavailable",
  "installing",
  "stopped",
  "starting",
  "ready",
  "degraded",
  "stopping",
  "error",
] as const;

/** Identifier for a capability known to this Desktop Core version. */
export type CapabilityId = (typeof CAPABILITY_IDS)[number];

/** Runtime used to implement a capability. */
export type CapabilityRuntime = (typeof CAPABILITY_RUNTIMES)[number];

/** Current lifecycle state of a capability. */
export type CapabilityState = (typeof CAPABILITY_STATES)[number];

/** Serializable metadata describing a desktop capability. */
export interface CapabilityDescriptor {
  readonly id: CapabilityId;
  readonly displayName: string;
  readonly runtime: CapabilityRuntime;
  readonly optional: boolean;
  readonly dependencies: readonly CapabilityId[];
}

/** Structured error that can safely cross an Electron IPC boundary. */
export interface CapabilityError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

/** Immutable capability state returned to clients. */
export interface CapabilitySnapshot extends CapabilityDescriptor {
  readonly state: CapabilityState;
  readonly changedAt: string;
  readonly error?: CapabilityError;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Serializable aggregate state of the Desktop Core runtime. */
export interface DesktopCoreSnapshot {
  readonly protocolVersion: string;
  readonly sessionId: string;
  readonly startedAt: string | null;
  readonly capabilities: readonly CapabilitySnapshot[];
}

/** IPC request used to activate or wait for a capability. */
export interface EnsureCapabilityRequest {
  readonly capabilityId: CapabilityId;
}

/** Function signature used by clients that observe Desktop Core state. */
export type DesktopCoreStateListener = (snapshot: DesktopCoreSnapshot) => void;

/** Public API exposed by the preload bridge. */
export interface OpenXnetDesktopApi {
  getBootstrapSnapshot(): Promise<DesktopBootstrapSnapshot>;
  getAuthSession(): Promise<ApplicationAuthSnapshot>;
  saveAuthSession(request: SaveApplicationAuthSessionRequest): Promise<ApplicationAuthSnapshot>;
  clearAuthSession(): Promise<ApplicationAuthSnapshot>;
  requestAccess(request: ApplicationAccessRequest): Promise<ApplicationAccessResult>;
  applyApplicationSystemProxy(): Promise<ApplyApplicationSystemProxyResult>;
  revealApplicationSystemDirectory(
    request: RevealApplicationSystemDirectoryRequest,
  ): Promise<RevealApplicationSystemDirectoryResult>;
  getApplicationSystemNetworkAddress(): Promise<ApplicationSystemNetworkAddressResult>;
  getApplicationSearchCredentials(): Promise<ApplicationSearchCredentialSnapshot>;
  saveApplicationSearchCredentials(
    request: SaveApplicationSearchCredentialsRequest,
  ): Promise<ApplicationSearchCredentialSnapshot>;
  getApplicationVoiceCredentials(): Promise<ApplicationVoiceCredentialSnapshot>;
  saveApplicationVoiceCredentials(
    request: SaveApplicationVoiceCredentialsRequest,
  ): Promise<ApplicationVoiceCredentialSnapshot>;
  transcribeApplicationVoice(
    request: ApplicationVoiceTranscriptionRequest,
  ): Promise<ApplicationVoiceTranscriptionResult>;
  synthesizeApplicationVoice(
    request: ApplicationVoiceSynthesisRequest,
  ): Promise<ApplicationVoiceSynthesisResult>;
  listApplicationSystemVoices(): Promise<ApplicationVoiceCatalogResult>;
  listApplicationProviderVoices(
    request: ApplicationVoiceProviderCatalogRequest,
  ): Promise<ApplicationVoiceCatalogResult>;
  importApplicationVoiceReference(
    file: RendererApplicationVoiceReferenceFile,
  ): Promise<ApplicationVoiceReferenceResult>;
  removeApplicationVoiceReference(
    request: RemoveApplicationVoiceReferenceRequest,
  ): Promise<RemoveApplicationVoiceReferenceResult>;
  getApplicationVrmPresentationStatus(): Promise<ApplicationVrmPresentationStatus>;
  publishApplicationVrmPresentation(
    request: ApplicationVrmPresentationPublishRequest,
  ): Promise<ApplicationVrmPresentationPublishResult>;
  getApplicationMcpCredentials(): Promise<ApplicationMcpCredentialSnapshot>;
  saveApplicationMcpCredentials(
    request: SaveApplicationMcpCredentialsRequest,
  ): Promise<ApplicationMcpCredentialSnapshot>;
  getApplicationMcpRuntimeStatus(
    request: ApplicationMcpRuntimeIntegrationRequest,
  ): Promise<ApplicationMcpRuntimeResult>;
  startApplicationMcpRuntime(
    request: ApplicationMcpRuntimeStartRequest,
  ): Promise<ApplicationMcpRuntimeResult>;
  stopApplicationMcpRuntime(
    request: ApplicationMcpRuntimeIntegrationRequest,
  ): Promise<ApplicationMcpRuntimeResult>;
  listApplicationMcpRuntimeTools(
    request: ApplicationMcpRuntimeStartRequest,
  ): Promise<ApplicationMcpRuntimeToolsResult>;
  getApplicationHttpToolCredentials(): Promise<ApplicationHttpToolCredentialSnapshot>;
  saveApplicationHttpToolCredentials(
    request: SaveApplicationHttpToolCredentialsRequest,
  ): Promise<ApplicationHttpToolCredentialSnapshot>;
  getApplicationConnectorCredentials(): Promise<ApplicationConnectorCredentialSnapshot>;
  saveApplicationConnectorCredentials(
    request: SaveApplicationConnectorCredentialsRequest,
  ): Promise<ApplicationConnectorCredentialSnapshot>;
  getApplicationConnectorRuntimeStatus(
    request: ApplicationConnectorRuntimePlatformRequest,
  ): Promise<ApplicationConnectorRuntimeResult>;
  startApplicationConnectorRuntime(
    request: ApplicationConnectorRuntimeMutationRequest,
  ): Promise<ApplicationConnectorRuntimeResult>;
  stopApplicationConnectorRuntime(
    request: ApplicationConnectorRuntimePlatformRequest,
  ): Promise<ApplicationConnectorRuntimeResult>;
  reloadApplicationConnectorRuntime(
    request: ApplicationConnectorRuntimeMutationRequest,
  ): Promise<ApplicationConnectorRuntimeResult>;
  updateApplicationConnectorRuntime(
    request: ApplicationConnectorRuntimeMutationRequest,
  ): Promise<ApplicationConnectorRuntimeResult>;
  getApplicationTelegramCredentials(): Promise<ApplicationTelegramCredentialSnapshot>;
  saveApplicationTelegramCredentials(
    request: SaveApplicationTelegramCredentialsRequest,
  ): Promise<ApplicationTelegramCredentialSnapshot>;
  getApplicationImageHostCredentials(): Promise<ApplicationImageHostCredentialSnapshot>;
  saveApplicationImageHostCredentials(
    request: SaveApplicationImageHostCredentialsRequest,
  ): Promise<ApplicationImageHostCredentialSnapshot>;
  getApplicationRepositoryCredentials(): Promise<ApplicationRepositoryCredentialSnapshot>;
  saveApplicationRepositoryCredentials(
    request: SaveApplicationRepositoryCredentialsRequest,
  ): Promise<ApplicationRepositoryCredentialSnapshot>;
  getApplicationLivePlatformCredentials(): Promise<ApplicationLivePlatformCredentialSnapshot>;
  saveApplicationLivePlatformCredentials(
    request: SaveApplicationLivePlatformCredentialsRequest,
  ): Promise<ApplicationLivePlatformCredentialSnapshot>;
  getApplicationLiveRuntimeStatus(): Promise<ApplicationLiveRuntimeResult>;
  startApplicationLiveRuntime(
    request: ApplicationLiveRuntimeMutationRequest,
  ): Promise<ApplicationLiveRuntimeResult>;
  stopApplicationLiveRuntime(): Promise<ApplicationLiveRuntimeResult>;
  reloadApplicationLiveRuntime(
    request: ApplicationLiveRuntimeMutationRequest,
  ): Promise<ApplicationLiveRuntimeResult>;
  onApplicationLiveRuntimeEvent(listener: ApplicationLiveRuntimeEventListener): () => void;
  getApplicationCodeSandboxCredentials(): Promise<ApplicationCodeSandboxCredentialSnapshot>;
  saveApplicationCodeSandboxCredentials(
    request: SaveApplicationCodeSandboxCredentialsRequest,
  ): Promise<ApplicationCodeSandboxCredentialSnapshot>;
  getApplicationHomeAssistantCredentials(): Promise<ApplicationHomeAssistantCredentialSnapshot>;
  saveApplicationHomeAssistantCredentials(
    request: SaveApplicationHomeAssistantCredentialsRequest,
  ): Promise<ApplicationHomeAssistantCredentialSnapshot>;
  getApplicationSqlCredentials(): Promise<ApplicationSqlCredentialSnapshot>;
  saveApplicationSqlCredentials(
    request: SaveApplicationSqlCredentialsRequest,
  ): Promise<ApplicationSqlCredentialSnapshot>;
  selectApplicationSqliteDatabase(): Promise<ApplicationSqlCredentialSnapshot>;
  getApplicationComfyUiCredentials(): Promise<ApplicationComfyUiCredentialSnapshot>;
  saveApplicationComfyUiCredentials(
    request: SaveApplicationComfyUiCredentialsRequest,
  ): Promise<ApplicationComfyUiCredentialSnapshot>;
  getApplicationDeliveryCredentials(): Promise<ApplicationDeliveryCredentialSnapshot>;
  saveApplicationDeliveryCredentials(
    request: SaveApplicationDeliveryCredentialsRequest,
  ): Promise<ApplicationDeliveryCredentialSnapshot>;
  listArtifacts(request?: ListApplicationArtifactsRequest): Promise<ApplicationArtifactSnapshot>;
  importArtifacts(request: ImportApplicationArtifactsRequest): Promise<ApplicationArtifactWriteResult>;
  importSelectedArtifacts(
    files: readonly RendererApplicationArtifactFile[],
  ): Promise<ApplicationArtifactWriteResult>;
  listApplicationVrAssets(): Promise<ApplicationVrAssetCatalog>;
  importApplicationVrAsset(
    request: RendererImportApplicationVrAssetRequest,
  ): Promise<ApplicationVrAssetWriteResult>;
  deleteApplicationVrAsset(
    request: DeleteApplicationVrAssetRequest,
  ): Promise<ApplicationVrAssetDeleteResult>;
  downloadApplicationCloudVrmModel(
    request: DownloadApplicationCloudVrmModelRequest,
  ): Promise<ApplicationVrAssetWriteResult>;
  listApplicationExtensions(): Promise<ApplicationExtensionCatalog>;
  listRemoteApplicationExtensions(): Promise<ApplicationRemoteExtensionCatalog>;
  installApplicationExtensionFromRepository(
    request: InstallApplicationExtensionRepositoryRequest,
  ): Promise<ApplicationExtensionWriteResult>;
  importApplicationExtensionArchive(
    request: RendererImportApplicationExtensionArchiveRequest,
  ): Promise<ApplicationExtensionWriteResult>;
  updateApplicationExtension(request: ApplicationExtensionIdRequest): Promise<ApplicationExtensionWriteResult>;
  removeApplicationExtension(request: ApplicationExtensionIdRequest): Promise<ApplicationExtensionMutationResult>;
  startApplicationExtension(request: ApplicationExtensionIdRequest): Promise<ApplicationExtensionStartResult>;
  stopApplicationExtension(request: ApplicationExtensionIdRequest): Promise<ApplicationExtensionMutationResult>;
  listApplicationSkills(): Promise<ApplicationSkillCatalog>;
  getApplicationSkillContent(request: ApplicationSkillIdRequest): Promise<ApplicationSkillContentResult>;
  installApplicationSkillFromRepository(
    request: InstallApplicationSkillRepositoryRequest,
  ): Promise<ApplicationSkillWriteResult>;
  importApplicationSkillArchive(
    request: RendererImportApplicationSkillArchiveRequest,
  ): Promise<ApplicationSkillWriteResult>;
  crystallizeApplicationSkill(request: CrystallizeApplicationSkillRequest): Promise<ApplicationSkillWriteResult>;
  uploadApplicationSkillToMlops(
    request: UploadApplicationSkillToMlopsRequest,
  ): Promise<ApplicationSkillMlopsUploadResult>;
  removeApplicationSkill(request: ApplicationSkillIdRequest): Promise<ApplicationSkillMutationResult>;
  getApplicationProjectSkillStatus(): Promise<ApplicationProjectSkillStatus>;
  syncApplicationProjectSkill(request: SyncApplicationSkillProjectRequest): Promise<ApplicationSkillWriteResult>;
  revealApplicationSkillsDirectory(): Promise<ApplicationSkillDirectoryResult>;
  listApplicationEnterpriseRoleCards(): Promise<ApplicationEnterpriseRoleCardListResult>;
  saveApplicationEnterpriseRoleCard(
    request: SaveApplicationEnterpriseRoleCardRequest,
  ): Promise<ApplicationEnterpriseRoleCardWriteResult>;
  removeApplicationEnterpriseRoleCard(
    request: ApplicationEnterpriseRoleCardRequest,
  ): Promise<ApplicationEnterpriseRemoveResult>;
  listApplicationEnterpriseTeamTemplates(): Promise<ApplicationEnterpriseTeamTemplateListResult>;
  saveApplicationEnterpriseTeamTemplate(
    request: SaveApplicationEnterpriseTeamTemplateRequest,
  ): Promise<ApplicationEnterpriseTeamTemplateWriteResult>;
  removeApplicationEnterpriseTeamTemplate(
    request: ApplicationEnterpriseTeamTemplateRequest,
  ): Promise<ApplicationEnterpriseRemoveResult>;
  listApplicationEnterpriseKnowledgeBases(): Promise<ApplicationEnterpriseKnowledgeBaseListResult>;
  saveApplicationEnterpriseKnowledgeBase(
    request: SaveApplicationEnterpriseKnowledgeBaseRequest,
  ): Promise<ApplicationEnterpriseKnowledgeBaseWriteResult>;
  removeApplicationEnterpriseKnowledgeBase(
    request: ApplicationEnterpriseKnowledgeBaseRequest,
  ): Promise<ApplicationEnterpriseRemoveResult>;
  listApplicationEnterpriseKnowledgeBaseVersions(
    request: ApplicationEnterpriseKnowledgeBaseRequest,
  ): Promise<ApplicationEnterpriseKnowledgeBaseVersionListResult>;
  listApplicationEnterpriseWorkspaces(): Promise<ApplicationEnterpriseWorkspaceListResult>;
  saveApplicationEnterpriseWorkspace(
    request: SaveApplicationEnterpriseWorkspaceRequest,
  ): Promise<ApplicationEnterpriseWorkspaceWriteResult>;
  removeApplicationEnterpriseWorkspace(
    request: ApplicationEnterpriseWorkspaceRequest,
  ): Promise<ApplicationEnterpriseRemoveResult>;
  listApplicationEnterpriseProjects(): Promise<ApplicationEnterpriseProjectListResult>;
  saveApplicationEnterpriseProject(
    request: SaveApplicationEnterpriseProjectRequest,
  ): Promise<ApplicationEnterpriseProjectWriteResult>;
  removeApplicationEnterpriseProject(
    request: ApplicationEnterpriseProjectRequest,
  ): Promise<ApplicationEnterpriseRemoveResult>;
  listApplicationEnterpriseMessages(
    request: ListApplicationEnterpriseMessagesRequest,
  ): Promise<ApplicationEnterpriseMessageListResult>;
  postApplicationEnterpriseMessage(
    request: PostApplicationEnterpriseMessageRequest,
  ): Promise<ApplicationEnterpriseMessageWriteResult>;
  listApplicationEnterpriseSkillBindings(): Promise<ApplicationEnterpriseSkillBindingListResult>;
  setApplicationEnterpriseSkillBinding(
    request: SetApplicationEnterpriseSkillBindingRequest,
  ): Promise<ApplicationEnterpriseSkillBindingWriteResult>;
  getApplicationEnterpriseSandboxState(): Promise<ApplicationEnterpriseSandboxStateResult>;
  listApplicationEnterpriseXnetServices(): Promise<ApplicationEnterpriseXnetServiceListResult>;
  saveApplicationEnterpriseXnetService(
    request: SaveApplicationEnterpriseXnetServiceRequest,
  ): Promise<ApplicationEnterpriseXnetServiceWriteResult>;
  checkApplicationEnterpriseXnetService(
    request: ApplicationEnterpriseXnetServiceRequest,
  ): Promise<ApplicationEnterpriseXnetServiceWriteResult>;
  checkAllApplicationEnterpriseXnetServices(
    request: CheckAllApplicationEnterpriseXnetServicesRequest,
  ): Promise<ApplicationEnterpriseXnetServiceListResult>;
  loadApplicationEnterpriseUsageDashboard(
    request: ApplicationEnterpriseUsageDashboardRequest,
  ): Promise<ApplicationEnterpriseUsageDashboardResult>;
  loadApplicationEnterpriseNeuroDashboard(
    request: ApplicationEnterpriseNeuroDashboardRequest,
  ): Promise<ApplicationEnterpriseNeuroDashboardResult>;
  searchApplicationEnterpriseNeuroSymbols(
    request: ApplicationEnterpriseNeuroSearchRequest,
  ): Promise<ApplicationEnterpriseNeuroSearchResult>;
  removeApplicationEnterpriseNeuroSymbol(
    request: ApplicationEnterpriseNeuroSymbolRequest,
  ): Promise<ApplicationEnterpriseNeuroRemoveResult>;
  runApplicationEnterpriseNeuroMaintenance(): Promise<ApplicationEnterpriseNeuroMaintenanceResult>;
  loadApplicationEnterpriseKnowledgeGraph(
    request: ApplicationEnterpriseKnowledgeGraphRequest,
  ): Promise<ApplicationEnterpriseKnowledgeGraphResult>;
  queryApplicationEnterpriseKnowledgeGraphEntity(
    request: ApplicationEnterpriseKnowledgeGraphEntityRequest,
  ): Promise<ApplicationEnterpriseKnowledgeGraphEntityResult>;
  invokeApplicationKernel(request: ApplicationKernelCommandRequest): Promise<ApplicationKernelCommandResult>;
  getApplicationModelAssetStatus(request: ApplicationModelAssetRequest): Promise<ApplicationModelAssetStatus>;
  downloadApplicationModelAsset(request: DownloadApplicationModelAssetRequest): Promise<ApplicationModelAssetStatus>;
  removeApplicationModelAsset(request: ApplicationModelAssetRequest): Promise<ApplicationModelAssetStatus>;
  onApplicationModelAssetProgress(listener: ApplicationModelAssetProgressListener): () => void;
  registerArtifacts(request: RegisterApplicationArtifactsRequest): Promise<ApplicationArtifactWriteResult>;
  deleteArtifacts(request: DeleteApplicationArtifactsRequest): Promise<DeleteApplicationArtifactsResult>;
  listTasks(request?: ListApplicationTasksRequest): Promise<ApplicationTaskSnapshot>;
  getTask(request: GetApplicationTaskRequest): Promise<ApplicationTaskDetail>;
  createTask(request: CreateApplicationTaskRequest): Promise<ApplicationTask>;
  refreshTaskExecutions(request: RefreshApplicationTaskExecutionsRequest): Promise<ApplicationTaskExecutionSnapshot>;
  getTaskExecution(request: ApplicationTaskExecutionRequest): Promise<ApplicationTaskExecutionDetail>;
  createDeveloperWorkbenchTaskExecution(request: CreateDeveloperWorkbenchTaskExecutionRequest): Promise<ApplicationTask>;
  dispatchTaskExecution(request: ApplicationTaskExecutionRequest): Promise<ApplicationTask>;
  startTaskExecution(request: StartApplicationTaskExecutionRequest): Promise<ApplicationTask>;
  resumeTaskExecution(request: ResumeApplicationTaskExecutionRequest): Promise<ApplicationTask>;
  cancelTaskExecution(request: ApplicationTaskExecutionRequest): Promise<ApplicationTask>;
  deleteTaskExecution(request: ApplicationTaskExecutionRequest): Promise<ApplicationTaskSnapshot>;
  onTaskExecutionChanged(listener: ApplicationTaskExecutionListener): () => void;
  startApplicationChatStream(
    request: StartApplicationChatStreamRequest,
  ): Promise<ApplicationChatStreamAcknowledgement>;
  completeApplicationChat(request: CompleteApplicationChatRequest): Promise<ApplicationChatResponse>;
  listApplicationChatModels(): Promise<ApplicationChatResponse>;
  abortApplicationChat(request: AbortApplicationChatRequest): Promise<ApplicationChatResponse>;
  executeApplicationChatTool(request: ExecuteApplicationChatToolRequest): Promise<ApplicationChatResponse>;
  resolveApplicationChatApproval(
    request: ResolveApplicationChatApprovalRequest,
  ): Promise<ApplicationChatResponse>;
  onApplicationChatStreamEvent(listener: ApplicationChatStreamListener): () => void;
  buildApplicationKnowledgeBase(
    request: ApplicationKnowledgeBaseScopeRequest,
  ): Promise<ApplicationKnowledgeBaseStatus>;
  getApplicationKnowledgeBaseStatus(
    request: ApplicationKnowledgeBaseScopeRequest,
  ): Promise<ApplicationKnowledgeBaseStatus>;
  removeApplicationKnowledgeBase(
    request: ApplicationKnowledgeBaseScopeRequest,
  ): Promise<ApplicationKnowledgeBaseMutationResult>;
  queryApplicationKnowledgeBase(
    request: ApplicationKnowledgeBaseQueryRequest,
  ): Promise<ApplicationKnowledgeBaseQueryResult>;
  listApplicationDesktopControlWindows(
    request: ApplicationDesktopControlWindowListRequest,
  ): Promise<ApplicationDesktopControlWindowListResult>;
  listApplicationDesktopControlMonitors(): Promise<ApplicationDesktopControlMonitorListResult>;
  getApplicationDesktopControlActiveWindow(): Promise<ApplicationDesktopControlActiveWindowResult>;
  listApplicationDesktopControlHistory(
    request: ApplicationDesktopControlHistoryRequest,
  ): Promise<ApplicationDesktopControlHistoryResult>;
  executeApplicationDesktopControlAction(
    request: ApplicationDesktopControlActionRequest,
  ): Promise<ApplicationDesktopControlActionResult>;
  probeApplicationToolchain(
    request: ApplicationToolchainProbeRequest,
  ): Promise<ApplicationToolchainProbeResult>;
  listApplicationDockerContainers(): Promise<ApplicationDockerContainerListResult>;
  pullApplicationDockerImage(
    request: ApplicationDockerImagePullRequest,
  ): Promise<ApplicationDockerMutationResult>;
  mutateApplicationDockerContainer(
    request: ApplicationDockerContainerMutationRequest,
  ): Promise<ApplicationDockerMutationResult>;
  getApplicationDeveloperWorkbenchOverview(): Promise<DeveloperWorkbenchOverview>;
  listApplicationDeveloperWorkbenchRepositories(): Promise<DeveloperWorkbenchRepositoriesResult>;
  searchApplicationDeveloperWorkbenchCode(
    request: DeveloperWorkbenchCodeSearchRequest,
  ): Promise<DeveloperWorkbenchCodeSearchResult>;
  listApplicationDeveloperWorkbenchSnapshots(): Promise<DeveloperWorkbenchSnapshotListResult>;
  createApplicationDeveloperWorkbenchSnapshot(
    request: CreateDeveloperWorkbenchSnapshotRequest,
  ): Promise<DeveloperWorkbenchSnapshotWriteResult>;
  importApplicationDeveloperWorkbenchSnapshot(
    request: ImportDeveloperWorkbenchSnapshotRequest,
  ): Promise<DeveloperWorkbenchSnapshotWriteResult>;
  getApplicationDeveloperWorkbenchSnapshot(
    request: DeveloperWorkbenchSnapshotRequest,
  ): Promise<DeveloperWorkbenchSnapshotDocumentResult>;
  restoreApplicationDeveloperWorkbenchSnapshot(
    request: DeveloperWorkbenchSnapshotRequest,
  ): Promise<DeveloperWorkbenchSnapshotMutationResult>;
  deleteApplicationDeveloperWorkbenchSnapshot(
    request: DeveloperWorkbenchSnapshotRequest,
  ): Promise<DeveloperWorkbenchSnapshotMutationResult>;
  applyApplicationDeveloperWorkbenchWorkspace(
    request: ApplyDeveloperWorkbenchWorkspaceRequest,
  ): Promise<ApplyDeveloperWorkbenchWorkspaceResult>;
  applyApplicationDeveloperWorkbenchMapping(
    request: ApplyDeveloperWorkbenchMappingRequest,
  ): Promise<ApplyDeveloperWorkbenchMappingResult>;
  getApplicationRecallBootstrap(): Promise<ApplicationRecallBootstrapResult>;
  searchApplicationRecall(request: ApplicationRecallSearchRequest): Promise<ApplicationRecallSearchResult>;
  getApplicationRecallTimeline(
    request: ApplicationRecallTimelineRequest,
  ): Promise<ApplicationRecallTimelineResult>;
  getApplicationRecallObservations(
    request: ApplicationRecallObservationsRequest,
  ): Promise<ApplicationRecallObservationsResult>;
  resumeApplicationRecall(
    request: ApplicationRecallResumeRequest,
  ): Promise<ApplicationRecallResumeResult>;
  rollbackApplicationRecall(
    request: ApplicationRecallRollbackRequest,
  ): Promise<ApplicationRecallRollbackResult>;
  publishApplicationRecallObservationFocus(
    request: ApplicationRecallObservationFocusRequest,
  ): Promise<ApplicationRecallObservationFocusResult>;
  getApplicationProviders(): Promise<ApplicationProviderSnapshot>;
  saveApplicationProviders(request: SaveApplicationProvidersRequest): Promise<ApplicationProviderSnapshot>;
  validateApplicationProvider(
    request: ValidateApplicationProviderRequest,
  ): Promise<ApplicationProviderValidationResult>;
  probeApplicationProviderEmbedding(
    request: ProbeApplicationProviderEmbeddingRequest,
  ): Promise<ApplicationProviderEmbeddingProbeResult>;
  createApplicationAgent(request: CreateApplicationAgentRequest): Promise<ApplicationAgentMutationResult>;
  removeApplicationAgent(request: RemoveApplicationAgentRequest): Promise<ApplicationAgentMutationResult>;
  inspectApplicationA2a(request: InspectApplicationA2aRequest): Promise<ApplicationA2aInspectionResult>;
  listApplicationMemoryRecords(
    request: ApplicationMemoryCollectionRequest,
  ): Promise<ApplicationMemoryRecordListResult>;
  updateApplicationMemoryRecord(
    request: UpdateApplicationMemoryRecordRequest,
  ): Promise<ApplicationMemoryMutationResult>;
  deleteApplicationMemoryRecord(
    request: ApplicationMemoryRecordRequest,
  ): Promise<ApplicationMemoryMutationResult>;
  removeApplicationMemoryCollection(
    request: ApplicationMemoryCollectionRequest,
  ): Promise<ApplicationMemoryMutationResult>;
  getLegacyRendererState(): Promise<LegacyRendererStateSnapshot>;
  saveLegacyRendererSettings(
    request: SaveLegacyRendererSettingsRequest,
  ): Promise<LegacyRendererStateSnapshot>;
  saveLegacyRendererConversations(
    request: SaveLegacyRendererConversationsRequest,
  ): Promise<LegacyRendererStateSnapshot>;
  saveLegacyRendererVrmConfig(
    request: SaveLegacyRendererVrmConfigRequest,
  ): Promise<LegacyRendererStateSnapshot>;
  onLegacyRendererStateChanged(listener: LegacyRendererStateChangedListener): () => void;
  getState(): Promise<DesktopCoreSnapshot>;
  listCapabilities(): Promise<readonly CapabilitySnapshot[]>;
  ensureCapability(request: EnsureCapabilityRequest): Promise<CapabilitySnapshot>;
  listFeaturePacks(request?: ListFeaturePacksRequest): Promise<FeaturePackDistributionSnapshot>;
  installFeaturePack(request: MutateFeaturePackRequest): Promise<FeaturePackMutationResult>;
  repairFeaturePack(request: MutateFeaturePackRequest): Promise<FeaturePackMutationResult>;
  uninstallFeaturePack(request: MutateFeaturePackRequest): Promise<FeaturePackMutationResult>;
  onFeaturePackProgress(listener: FeaturePackProgressListener): () => void;
  onStateChanged(listener: DesktopCoreStateListener): () => void;
}

/**
 * Determine whether an unknown IPC value is a supported capability identifier.
 *
 * @param value Value received from an untrusted process boundary.
 * @returns True when the value is a capability identifier in this protocol version.
 */
export function isCapabilityId(value: unknown): value is CapabilityId {
  return typeof value === "string" && CAPABILITY_IDS.some((candidate) => candidate === value);
}
