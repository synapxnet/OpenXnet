import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";

import { DESKTOP_CORE_PROTOCOL_VERSION, type CapabilityId } from "../contracts/capability";
import {
  FEATURE_PACK_CURRENT_SCHEMA,
  FeaturePackError,
  parseFeaturePackCurrentPointer,
  parseFeaturePackManifest,
  type FeaturePackFile,
  type FeaturePackManifest,
} from "./feature-pack";

/** Construction options for a platform-scoped feature-pack store. */
export interface FeaturePackManagerOptions {
  readonly rootDirectory: string;
  readonly desktopProtocolVersion?: string;
  readonly platform?: NodeJS.Platform;
  readonly architecture?: string;
}

/** A validated feature-pack version ready for runtime activation. */
export interface InstalledFeaturePack {
  readonly manifest: FeaturePackManifest;
  readonly rootDirectory: string;
  readonly entrypointPath: string;
}

/** Options controlling how a validated source replaces an installed version. */
export interface InstallFeaturePackOptions {
  readonly replaceExisting?: boolean;
}

/** Health information for one version present in the private Feature Pack store. */
export interface InstalledFeaturePackVersion {
  readonly version: string;
  readonly active: boolean;
  readonly valid: boolean;
  readonly errorCode?: string;
}

/**
 * Validate, install, select, and roll back independently distributed feature packs.
 */
export class FeaturePackManager {
  private readonly rootDirectory: string;
  private readonly desktopProtocolVersion: string;
  private readonly platform: NodeJS.Platform;
  private readonly architecture: string;

  /**
   * Create a manager bound to one application-owned install root.
   *
   * @param options Store path and compatibility values.
   */
  public constructor(options: FeaturePackManagerOptions) {
    this.rootDirectory = path.resolve(options.rootDirectory);
    this.desktopProtocolVersion = options.desktopProtocolVersion ?? DESKTOP_CORE_PROTOCOL_VERSION;
    this.platform = options.platform ?? process.platform;
    this.architecture = options.architecture ?? process.arch;
  }

  /**
   * Inspect a feature-pack directory without modifying installation state.
   *
   * @param packDirectory Directory containing manifest.json and payload files.
   * @returns Validated pack metadata and resolved entrypoint.
   */
  public async inspectDirectory(packDirectory: string): Promise<InstalledFeaturePack> {
    const resolvedDirectory = path.resolve(packDirectory);
    const manifest = await this.readManifest(resolvedDirectory);
    this.assertCompatible(manifest);
    await this.verifyPackContents(resolvedDirectory, manifest);
    return {
      manifest,
      rootDirectory: resolvedDirectory,
      entrypointPath: path.join(resolvedDirectory, ...manifest.entrypoint.split("/")),
    };
  }

  /**
   * Install a validated directory and atomically select it as the active version.
   *
   * @param sourceDirectory Staged pack directory supplied by an installer or updater.
   * @returns Installed and active feature pack.
   */
  public async installFromDirectory(
    sourceDirectory: string,
    options: InstallFeaturePackOptions = {},
  ): Promise<InstalledFeaturePack> {
    const sourcePack = await this.inspectDirectory(sourceDirectory);
    const capabilityRoot = this.getCapabilityRoot(sourcePack.manifest.id);
    const versionsRoot = path.join(capabilityRoot, "versions");
    const targetDirectory = path.join(versionsRoot, sourcePack.manifest.version);
    const stagingDirectory = path.join(versionsRoot, `.installing-${randomUUID()}`);
    const backupDirectory = path.join(versionsRoot, `.replacing-${randomUUID()}`);
    let targetExisted = false;
    let targetPromoted = false;
    let backupCreated = false;
    await fs.mkdir(versionsRoot, { recursive: true });

    try {
      try {
        await fs.access(targetDirectory);
        targetExisted = true;
      } catch (error) {
        if (!this.isMissingPathError(error)) {
          throw error;
        }
      }

      if (targetExisted && options.replaceExisting !== true) {
        const installedPack = await this.inspectDirectory(targetDirectory);
        await this.writeCurrentPointer(installedPack.manifest.id, installedPack.manifest.version);
        return installedPack;
      }

      await fs.cp(sourcePack.rootDirectory, stagingDirectory, {
        recursive: true,
        force: false,
        errorOnExist: true,
      });
      await this.inspectDirectory(stagingDirectory);
      if (targetExisted) {
        await fs.rename(targetDirectory, backupDirectory);
        backupCreated = true;
      }
      await fs.rename(stagingDirectory, targetDirectory);
      targetPromoted = true;

      const installedPack = await this.inspectDirectory(targetDirectory);
      await this.writeCurrentPointer(installedPack.manifest.id, installedPack.manifest.version);
      await fs.rm(backupDirectory, { recursive: true, force: true });
      backupCreated = false;
      return installedPack;
    } catch (error) {
      if (targetPromoted) {
        await fs.rm(targetDirectory, { recursive: true, force: true });
      }
      if (backupCreated) {
        await fs.rename(backupDirectory, targetDirectory);
      }
      throw error;
    } finally {
      await fs.rm(stagingDirectory, { recursive: true, force: true });
      await fs.rm(backupDirectory, { recursive: true, force: true });
    }
  }

  /**
   * Enumerate installed version directories and validate each version independently.
   *
   * @param capabilityId Capability whose private version store should be inspected.
   * @returns Deterministic version health records without exposing install paths.
   */
  public async listInstalledVersions(
    capabilityId: CapabilityId,
  ): Promise<readonly InstalledFeaturePackVersion[]> {
    const versionsRoot = path.join(this.getCapabilityRoot(capabilityId), "versions");
    let currentVersion: string | null = null;
    try {
      currentVersion = await this.readCurrentVersion(capabilityId);
    } catch (error) {
      if (!(error instanceof FeaturePackError)) {
        throw error;
      }
      // A damaged pointer must not prevent inventory, repair, or uninstall.
    }
    let entries;
    try {
      entries = await fs.readdir(versionsRoot, { withFileTypes: true });
    } catch (error) {
      if (this.isMissingPathError(error)) {
        return [];
      }
      throw error;
    }

    const versions: InstalledFeaturePackVersion[] = [];
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isDirectory() || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(entry.name)) {
        continue;
      }
      try {
        const pack = await this.inspectDirectory(path.join(versionsRoot, entry.name));
        if (pack.manifest.id !== capabilityId || pack.manifest.version !== entry.name) {
          throw new FeaturePackError(
            "INVALID_MANIFEST",
            "Installed Feature Pack metadata does not match its store location.",
          );
        }
        versions.push({
          version: entry.name,
          active: currentVersion === entry.name,
          valid: true,
        });
      } catch (error) {
        versions.push({
          version: entry.name,
          active: currentVersion === entry.name,
          valid: false,
          errorCode: error instanceof FeaturePackError ? error.code : "INVALID_PACK_CONTENT",
        });
      }
    }
    return versions;
  }

  /**
   * Remove every installed version and active pointer for one capability.
   *
   * @param capabilityId Capability whose private store should be removed.
   */
  public async removeCapability(capabilityId: CapabilityId): Promise<void> {
    const capabilityRoot = this.getCapabilityRoot(capabilityId);
    const removingRoot = path.join(
      this.rootDirectory,
      `.removing-${capabilityId}-${randomUUID()}`,
    );
    try {
      await fs.rename(capabilityRoot, removingRoot);
    } catch (error) {
      if (this.isMissingPathError(error)) {
        return;
      }
      throw error;
    }
    await fs.rm(removingRoot, { recursive: true, force: true });
  }

  /**
   * Discover current pack metadata without performing the expensive payload hash pass.
   *
   * This method is intended only for startup registration. Call resolveCurrent before
   * activation so no payload is executed without full integrity verification.
   *
   * @param capabilityId Capability whose installed metadata should be discovered.
   * @returns Compatible pack metadata, or null when no version is selected.
   */
  public async discoverCurrent(capabilityId: CapabilityId): Promise<InstalledFeaturePack | null> {
    const packDirectory = await this.resolveCurrentDirectory(capabilityId);
    if (packDirectory === null) {
      return null;
    }
    const manifest = await this.readManifest(packDirectory);
    this.assertCompatible(manifest);
    if (manifest.id !== capabilityId) {
      throw new FeaturePackError("INVALID_MANIFEST", "Feature-pack capability does not match its install path.");
    }
    const entrypointPath = path.join(packDirectory, ...manifest.entrypoint.split("/"));
    const runtimeExecutablePath = path.join(
      packDirectory,
      ...manifest.runtimeExecutable.split("/"),
    );
    for (const requiredPath of [entrypointPath, runtimeExecutablePath]) {
      const stats = await fs.stat(requiredPath);
      if (!stats.isFile()) {
        throw new FeaturePackError("INVALID_PACK_CONTENT", "Feature-pack launch path is not a regular file.");
      }
    }
    return { manifest, rootDirectory: packDirectory, entrypointPath };
  }

  /**
   * Resolve and validate the currently selected pack for a capability.
   *
   * @param capabilityId Capability whose active pack should be loaded.
   * @returns Active validated pack, or null when the capability is not installed.
   */
  public async resolveCurrent(capabilityId: CapabilityId): Promise<InstalledFeaturePack | null> {
    const packDirectory = await this.resolveCurrentDirectory(capabilityId);
    if (packDirectory === null) {
      return null;
    }
    return this.inspectDirectory(packDirectory);
  }

  /**
   * Resolve the version directory named by a capability's active pointer.
   *
   * @param capabilityId Capability whose current pointer should be read.
   * @returns Absolute version directory, or null when no pointer exists.
   */
  private async resolveCurrentDirectory(capabilityId: CapabilityId): Promise<string | null> {
    const version = await this.readCurrentVersion(capabilityId);
    return version === null
      ? null
      : path.join(this.getCapabilityRoot(capabilityId), "versions", version);
  }

  /**
   * Read and validate the active version pointer without resolving its directory.
   *
   * @param capabilityId Capability whose pointer should be read.
   * @returns Selected version, or null when no pointer exists.
   */
  private async readCurrentVersion(capabilityId: CapabilityId): Promise<string | null> {
    const pointerPath = path.join(this.getCapabilityRoot(capabilityId), "current.json");
    let source: string;
    try {
      source = await fs.readFile(pointerPath, "utf8");
    } catch (error) {
      if (this.isMissingPathError(error)) {
        return null;
      }
      throw error;
    }

    let value: unknown;
    try {
      value = JSON.parse(source) as unknown;
    } catch (error) {
      throw new FeaturePackError("INVALID_MANIFEST", `Invalid feature-pack pointer: ${pointerPath}`, {
        cause: error,
      });
    }
    const pointer = parseFeaturePackCurrentPointer(value, capabilityId);
    return pointer.version;
  }

  /**
   * Switch the active pointer to an already installed compatible version.
   *
   * @param capabilityId Capability being rolled back or advanced.
   * @param version Installed version to select.
   * @returns Newly active validated pack.
   */
  public async selectVersion(capabilityId: CapabilityId, version: string): Promise<InstalledFeaturePack> {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(version)) {
      throw new FeaturePackError("INVALID_MANIFEST", "Feature-pack version is not safe for an install path.");
    }
    const packDirectory = path.join(this.getCapabilityRoot(capabilityId), "versions", version);
    let pack: InstalledFeaturePack;
    try {
      pack = await this.inspectDirectory(packDirectory);
    } catch (error) {
      if (this.isMissingPathError(error)) {
        throw new FeaturePackError(
          "PACK_NOT_INSTALLED",
          `Feature pack '${capabilityId}' version '${version}' is not installed.`,
          { cause: error },
        );
      }
      throw error;
    }
    if (pack.manifest.id !== capabilityId) {
      throw new FeaturePackError("INVALID_MANIFEST", "Installed feature-pack capability does not match its path.");
    }
    await this.writeCurrentPointer(capabilityId, version);
    return pack;
  }

  /**
   * Read and parse manifest.json from one pack root.
   *
   * @param packDirectory Candidate feature-pack directory.
   * @returns Validated manifest structure.
   */
  private async readManifest(packDirectory: string): Promise<FeaturePackManifest> {
    const manifestPath = path.join(packDirectory, "manifest.json");
    let source: string;
    try {
      source = await fs.readFile(manifestPath, "utf8");
    } catch (error) {
      throw new FeaturePackError("INVALID_MANIFEST", `Unable to read feature-pack manifest: ${manifestPath}`, {
        cause: error,
      });
    }
    try {
      return parseFeaturePackManifest(JSON.parse(source) as unknown);
    } catch (error) {
      if (error instanceof FeaturePackError) {
        throw error;
      }
      throw new FeaturePackError("INVALID_MANIFEST", `Invalid JSON in feature-pack manifest: ${manifestPath}`, {
        cause: error,
      });
    }
  }

  /**
   * Enforce desktop protocol, platform, and architecture constraints.
   *
   * @param manifest Parsed feature-pack manifest.
   */
  private assertCompatible(manifest: FeaturePackManifest): void {
    if (manifest.desktopProtocolVersion !== this.desktopProtocolVersion) {
      throw new FeaturePackError(
        "INCOMPATIBLE_PROTOCOL",
        `Feature pack requires desktop protocol ${manifest.desktopProtocolVersion}; current is ${this.desktopProtocolVersion}.`,
      );
    }
    if (!manifest.platforms.includes(this.platform)) {
      throw new FeaturePackError(
        "INCOMPATIBLE_PLATFORM",
        `Feature pack does not support platform '${this.platform}'.`,
      );
    }
    if (!manifest.architectures.includes(this.architecture)) {
      throw new FeaturePackError(
        "INCOMPATIBLE_ARCHITECTURE",
        `Feature pack does not support architecture '${this.architecture}'.`,
      );
    }
  }

  /**
   * Verify that all and only declared payload files exist with matching hashes.
   *
   * @param packDirectory Validated feature-pack root.
   * @param manifest Parsed manifest describing payload contents.
   */
  private async verifyPackContents(
    packDirectory: string,
    manifest: FeaturePackManifest,
  ): Promise<void> {
    const actualFiles = await this.collectPackFiles(packDirectory);
    const expectedFiles = new Set(["manifest.json", ...manifest.files.map((file) => file.path)]);
    if (actualFiles.includes("manifest.sig")) {
      expectedFiles.add("manifest.sig");
    }
    if (actualFiles.length !== expectedFiles.size || actualFiles.some((file) => !expectedFiles.has(file))) {
      throw new FeaturePackError(
        "INVALID_PACK_CONTENT",
        "Feature-pack contents do not exactly match the integrity manifest.",
      );
    }

    for (const file of manifest.files) {
      await this.verifyFile(packDirectory, file);
    }
  }

  /**
   * Enumerate regular files while rejecting symbolic links and unsupported entries.
   *
   * @param directory Directory currently being traversed.
   * @param relativeDirectory POSIX path relative to the feature-pack root.
   * @returns Sorted regular-file paths relative to the pack root.
   */
  private async collectPackFiles(directory: string, relativeDirectory = ""): Promise<readonly string[]> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const relativePath = relativeDirectory === ""
        ? entry.name
        : `${relativeDirectory}/${entry.name}`;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new FeaturePackError("INVALID_PACK_CONTENT", `Symbolic links are not allowed: ${relativePath}`);
      }
      if (entry.isDirectory()) {
        files.push(...await this.collectPackFiles(absolutePath, relativePath));
      } else if (entry.isFile()) {
        files.push(relativePath);
      } else {
        throw new FeaturePackError("INVALID_PACK_CONTENT", `Unsupported pack entry: ${relativePath}`);
      }
    }
    return files.sort();
  }

  /**
   * Verify one declared payload file without loading it entirely into memory.
   *
   * @param packDirectory Feature-pack root.
   * @param file Expected size and SHA-256 descriptor.
   */
  private async verifyFile(packDirectory: string, file: FeaturePackFile): Promise<void> {
    const filePath = path.join(packDirectory, ...file.path.split("/"));
    const stats = await fs.stat(filePath);
    if (!stats.isFile() || stats.size !== file.size) {
      throw new FeaturePackError("INVALID_PACK_CONTENT", `Feature-pack file size mismatch: ${file.path}`);
    }
    const hash = await this.hashFile(filePath);
    if (hash !== file.sha256) {
      throw new FeaturePackError("INVALID_PACK_CONTENT", `Feature-pack file hash mismatch: ${file.path}`);
    }
  }

  /**
   * Calculate a lower-case SHA-256 digest for a potentially large file.
   *
   * @param filePath Absolute file path to hash.
   * @returns Hexadecimal SHA-256 digest.
   */
  private async hashFile(filePath: string): Promise<string> {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    for await (const chunk of stream) {
      hash.update(chunk as Buffer);
    }
    return hash.digest("hex");
  }

  /**
   * Persist the active-version pointer through a same-directory atomic rename.
   *
   * @param capabilityId Feature-pack capability being selected.
   * @param version Installed version to activate.
   */
  private async writeCurrentPointer(capabilityId: CapabilityId, version: string): Promise<void> {
    const capabilityRoot = this.getCapabilityRoot(capabilityId);
    const pointerPath = path.join(capabilityRoot, "current.json");
    const temporaryPath = path.join(capabilityRoot, `.current-${randomUUID()}.json`);
    const pointer = {
      schema: FEATURE_PACK_CURRENT_SCHEMA,
      id: capabilityId,
      version,
    };
    await fs.mkdir(capabilityRoot, { recursive: true });
    await fs.writeFile(temporaryPath, `${JSON.stringify(pointer, null, 2)}\n`, "utf8");
    try {
      await fs.rename(temporaryPath, pointerPath);
    } finally {
      await fs.rm(temporaryPath, { force: true });
    }
  }

  /**
   * Resolve the private store root for one capability identifier.
   *
   * @param capabilityId Feature-pack capability.
   * @returns Absolute capability store directory.
   */
  private getCapabilityRoot(capabilityId: CapabilityId): string {
    return path.join(this.rootDirectory, capabilityId);
  }

  /**
   * Determine whether an unknown filesystem error means a path is missing.
   *
   * @param error Unknown error from a Node filesystem operation.
   * @returns True for ENOENT failures.
   */
  private isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
  }

  /**
   * Determine whether an unknown filesystem error is an install race collision.
   *
   * @param error Unknown error from a Node filesystem operation.
   * @returns True when another process already created the target version.
   */
  private isAlreadyExistsError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error && (error.code === "EEXIST" || error.code === "ENOTEMPTY");
  }
}
