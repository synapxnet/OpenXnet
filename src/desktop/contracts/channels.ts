/** IPC channels owned by the Desktop Core compatibility layer. */
export const DESKTOP_CORE_CHANNELS = {
  getState: "openxnet:desktop-core:get-state",
  listCapabilities: "openxnet:desktop-core:list-capabilities",
  ensureCapability: "openxnet:desktop-core:ensure-capability",
  listFeaturePacks: "openxnet:desktop-core:list-feature-packs",
  installFeaturePack: "openxnet:desktop-core:install-feature-pack",
  repairFeaturePack: "openxnet:desktop-core:repair-feature-pack",
  uninstallFeaturePack: "openxnet:desktop-core:uninstall-feature-pack",
  featurePackProgress: "openxnet:desktop-core:feature-pack-progress",
  stateChanged: "openxnet:desktop-core:state-changed",
} as const;
