import { mkdir } from "node:fs/promises";
import type { NetworkInterfaceInfo } from "node:os";
import path from "node:path";

import {
  parseRevealApplicationSystemDirectoryRequest,
  type ApplicationSystemNetworkAddressResult,
  type ApplyApplicationSystemProxyResult,
  type RevealApplicationSystemDirectoryResult,
} from "../contracts/application-system-runtime";
import type { SystemSettings } from "../contracts/application-settings";

/** Electron 会话接受的最小代理配置，避免 Runtime 依赖 Electron 类型。 */
export interface ApplicationSessionProxyConfiguration {
  readonly mode: "system" | "direct" | "fixed_servers";
  readonly proxyRules?: string;
}

/** System Runtime 读取设置、操作会话和打开目录所需的 Main 依赖。 */
export interface ApplicationSystemRuntimeOptions {
  readonly userDataDirectory: string;
  readonly extensionDirectory: string;
  readonly readSettings: () => SystemSettings;
  readonly applySessionProxy: (configuration: ApplicationSessionProxyConfiguration) => Promise<void>;
  readonly revealPath: (directoryPath: string) => Promise<string>;
  readonly invalidateRuntimes: () => Promise<void>;
  readonly listNetworkInterfaces: () => NodeJS.Dict<NetworkInterfaceInfo[]>;
  readonly environment?: NodeJS.ProcessEnv;
}

const PROXY_ENVIRONMENT_KEYS = [
  "http_proxy",
  "https_proxy",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "all_proxy",
] as const;

/** 在 Main 内应用系统设置和固定 OS 能力，不向 Renderer 暴露路径或代理值。 */
export class ApplicationSystemRuntimeService {
  private readonly userDataDirectory: string;
  private readonly extensionDirectory: string;
  private readonly environment: NodeJS.ProcessEnv;

  /** 创建固定根目录的系统 Runtime；输入 Main-owned 依赖，无 I/O 副作用。 */
  public constructor(private readonly options: ApplicationSystemRuntimeOptions) {
    this.userDataDirectory = path.resolve(options.userDataDirectory);
    this.extensionDirectory = path.resolve(options.extensionDirectory);
    this.environment = options.environment ?? process.env;
  }

  /** 应用 Main-owned 代理和镜像设置，并停止持有旧环境的运行时以便下次按需重启。 */
  public async applyProxy(): Promise<ApplyApplicationSystemProxyResult> {
    const settings = this.options.readSettings();
    const mode = this.parseProxyMode(settings.proxyMode);
    const configuration = mode === "manual"
      ? { mode: "fixed_servers" as const, proxyRules: this.parseManualProxy(settings.proxy) }
      : { mode: mode === "system" ? "system" as const : "direct" as const };
    await this.options.applySessionProxy(configuration);
    this.applyEnvironment(mode, configuration.proxyRules, settings.isChinaProxy === true);
    await this.options.invalidateRuntimes();
    return { success: true, mode, chinaMirror: settings.isChinaProxy === true };
  }

  /** 打开固定应用目录；输入枚举请求，成功返回无路径结果，OS 拒绝时抛出固定错误。 */
  public async revealDirectory(request: unknown): Promise<RevealApplicationSystemDirectoryResult> {
    const parsed = parseRevealApplicationSystemDirectoryRequest(request);
    const directoryPath = parsed.directory === "user-data"
      ? this.userDataDirectory
      : parsed.directory === "logs"
        ? path.join(this.userDataDirectory, "logs")
        : this.extensionDirectory;
    await mkdir(directoryPath, { recursive: true });
    const errorMessage = await this.options.revealPath(directoryPath);
    if (errorMessage) {
      throw new Error("Desktop system directory is unavailable.");
    }
    return { opened: true };
  }

  /** 读取第一个非内部 IPv4 地址；无可用网卡或结构异常时返回 loopback。 */
  public getNetworkAddress(): ApplicationSystemNetworkAddressResult {
    const interfaces = this.options.listNetworkInterfaces();
    for (const entries of Object.values(interfaces)) {
      for (const entry of entries ?? []) {
        if (
          !entry.internal
          && (entry.family === "IPv4" || String(entry.family) === "4")
          && this.isIpv4(entry.address)
        ) {
          return { address: entry.address };
        }
      }
    }
    return { address: "127.0.0.1" };
  }

  /** 校验代理模式；输入持久化字符串，返回固定枚举，未知值回落到系统代理。 */
  private parseProxyMode(value: string): "system" | "manual" | "none" {
    return value === "manual" || value === "none" ? value : "system";
  }

  /** 校验 HTTP/HTTPS 手动代理；输入设置文本，返回规范 URL，SOCKS 或路径型 URL 会失败。 */
  private parseManualProxy(value: string): string {
    let parsed: URL;
    try {
      parsed = new URL(String(value || "").trim());
    } catch {
      throw new TypeError("Desktop manual proxy is invalid.");
    }
    if (
      !["http:", "https:"].includes(parsed.protocol)
      || !parsed.hostname
      || parsed.pathname !== "/"
      || parsed.search
      || parsed.hash
    ) {
      throw new TypeError("Desktop manual proxy is invalid.");
    }
    return parsed.toString().replace(/\/$/, "");
  }

  /** 更新后续子进程继承的代理和中国镜像环境；输入规范模式和值，无返回。 */
  private applyEnvironment(
    mode: "system" | "manual" | "none",
    proxy: string | undefined,
    chinaMirror: boolean,
  ): void {
    for (const key of PROXY_ENVIRONMENT_KEYS) {
      if (mode === "manual" && proxy) {
        this.environment[key] = proxy;
      } else if (mode === "none") {
        this.environment[key] = "";
      } else {
        delete this.environment[key];
      }
    }
    if (chinaMirror) {
      this.environment.npm_config_registry = "https://registry.npmmirror.com/";
      this.environment.UV_INDEX_URL = "https://mirrors.aliyun.com/pypi/simple/";
    } else {
      delete this.environment.npm_config_registry;
      delete this.environment.UV_INDEX_URL;
    }
  }

  /** 判断字符串是否为四段十进制 IPv4；输入网卡地址，返回布尔值，无副作用。 */
  private isIpv4(value: string): boolean {
    const parts = value.split(".");
    return parts.length === 4 && parts.every((part) => {
      const number = Number(part);
      return /^\d{1,3}$/.test(part) && Number.isInteger(number) && number >= 0 && number <= 255;
    });
  }
}
