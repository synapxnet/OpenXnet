import {
  APPLICATION_SKILL_RUNTIME_CHANNELS,
  APPLICATION_SKILL_RUNTIME_SCHEMA,
  type ApplicationProjectSkillStatus,
  type ApplicationSkillCatalog,
  type ApplicationSkillContentResult,
  type ApplicationSkillDirectoryResult,
  type ApplicationSkillMutationResult,
  type ApplicationSkillMlopsUploadResult,
  type ApplicationSkillWriteResult,
} from "../contracts/application-skills-runtime";
import type { ApplicationSkillRuntimeService } from "../skills/application-skill-runtime";
import type { IpcMainLike } from "./register-core-ipc";

/** Skill Runtime IPC 注册依赖。 */
export interface RegisterApplicationSkillRuntimeIpcOptions {
  readonly ipcMain: IpcMainLike;
  readonly runtime: Pick<
    ApplicationSkillRuntimeService,
    | "listSkills"
    | "getSkillContent"
    | "installFromRepository"
    | "importArchive"
    | "crystallizeSkill"
    | "uploadSkillToMlops"
    | "removeSkill"
    | "getProjectStatus"
    | "syncProjectSkill"
    | "ensureSkillsDirectory"
  >;
  readonly authorizeEvent: (event: unknown) => void;
  readonly revealDirectory: (directoryPath: string) => Promise<string>;
}

/** 注册 Skill Runtime typed IPC；输入 Runtime、发送者授权和 shell 边界，返回清理函数。 */
export function registerApplicationSkillRuntimeIpc(options: RegisterApplicationSkillRuntimeIpcOptions): () => void {
  const { ipcMain, runtime, authorizeEvent, revealDirectory } = options;

  /** 列出全局技能；输入 IPC 事件，返回目录，未授权时不读取或补齐内置技能。 */
  function handleList(event: unknown): Promise<ApplicationSkillCatalog> {
    authorizeEvent(event);
    return runtime.listSkills();
  }

  /** 读取技能内容；输入 IPC 事件和稳定 ID，返回 Markdown，未授权时不读取文件。 */
  function handleContent(event: unknown, request: unknown): Promise<ApplicationSkillContentResult> {
    authorizeEvent(event);
    return runtime.getSkillContent(request);
  }

  /** 从仓库安装技能；输入 IPC 事件和固定 GitHub URL，返回安装结果，未授权时不访问网络。 */
  function handleInstallRepository(event: unknown, request: unknown): Promise<ApplicationSkillWriteResult> {
    authorizeEvent(event);
    return runtime.installFromRepository(request);
  }

  /** 导入本机技能 ZIP；输入 IPC 事件和 preload 文件项，返回安装结果，未授权或超限时写盘前抛错。 */
  function handleImportArchive(event: unknown, request: unknown): Promise<ApplicationSkillWriteResult> {
    authorizeEvent(event);
    return runtime.importArchive(request);
  }

  /** 结晶技能；输入 IPC 事件和有界工作流，返回写入结果，未授权时不创建文件。 */
  function handleCrystallize(event: unknown, request: unknown): Promise<ApplicationSkillWriteResult> {
    authorizeEvent(event);
    return runtime.crystallizeSkill(request);
  }

  /** 上传企业 Skill 候选到 XnetMLOps；输入 IPC 事件和固定 ID，返回草稿回执。 */
  function handleUploadMlops(event: unknown, request: unknown): Promise<ApplicationSkillMlopsUploadResult> {
    authorizeEvent(event);
    return runtime.uploadSkillToMlops(request);
  }

  /** 删除全局技能；输入 IPC 事件和稳定 ID，返回删除结果，未授权时不删除文件。 */
  function handleRemove(event: unknown, request: unknown): Promise<ApplicationSkillMutationResult> {
    authorizeEvent(event);
    return runtime.removeSkill(request);
  }

  /** 读取当前工作区技能；输入 IPC 事件，返回 Main-owned 工作区状态，Renderer 不提交路径。 */
  function handleProjectStatus(event: unknown): Promise<ApplicationProjectSkillStatus> {
    authorizeEvent(event);
    return runtime.getProjectStatus();
  }

  /** 同步当前工作区技能；输入 IPC 事件、技能 ID 和动作，返回结果，Renderer 不提交路径。 */
  function handleSyncProject(event: unknown, request: unknown): Promise<ApplicationSkillWriteResult> {
    authorizeEvent(event);
    return runtime.syncProjectSkill(request);
  }

  /** 打开全局技能目录；输入 IPC 事件，返回固定成功结果，未授权或 shell 失败时拒绝。 */
  async function handleRevealDirectory(event: unknown): Promise<ApplicationSkillDirectoryResult> {
    authorizeEvent(event);
    const directoryPath = await runtime.ensureSkillsDirectory();
    const errorMessage = await revealDirectory(directoryPath);
    if (errorMessage) throw new Error(errorMessage);
    return { schema: APPLICATION_SKILL_RUNTIME_SCHEMA, success: true };
  }

  const channels = APPLICATION_SKILL_RUNTIME_CHANNELS;
  Object.values(channels).forEach((channel) => ipcMain.removeHandler(channel));
  ipcMain.handle(channels.list, handleList);
  ipcMain.handle(channels.content, handleContent);
  ipcMain.handle(channels.installRepository, handleInstallRepository);
  ipcMain.handle(channels.importArchive, handleImportArchive);
  ipcMain.handle(channels.crystallize, handleCrystallize);
  ipcMain.handle(channels.uploadMlops, handleUploadMlops);
  ipcMain.handle(channels.remove, handleRemove);
  ipcMain.handle(channels.projectStatus, handleProjectStatus);
  ipcMain.handle(channels.syncProject, handleSyncProject);
  ipcMain.handle(channels.revealDirectory, handleRevealDirectory);

  /** 移除本适配器注册的全部 Skill IPC；无输入和返回，可重复调用。 */
  function cleanup(): void {
    Object.values(channels).forEach((channel) => ipcMain.removeHandler(channel));
  }

  return cleanup;
}
