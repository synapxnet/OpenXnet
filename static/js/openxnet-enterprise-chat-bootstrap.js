/*
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
企业会话模块注册 / Enterprise conversation module registration.
Author: maoyo | Department: 研发部 | Date: 2026-09-14
Version: 1.0.0 | Security Level: INTERNAL
__version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
*/
/** 在 Vue 挂载前注册企业会话状态和方法。 Register enterprise conversation state and methods before Vue mounts. */
(function registerEnterpriseChatExperience() {
  const experience = window.OpenXnetEnterpriseChatExperience;
  if (!experience) throw new Error('Enterprise conversation module is unavailable.');
  Object.assign(vue_data, experience.createState());
  Object.assign(vue_methods, experience.methods);
})();
