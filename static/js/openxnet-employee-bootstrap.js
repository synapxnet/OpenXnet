/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 用途：接入员工工作台状态与动作。 Purpose: Register employee workbench state and actions.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
/** 在Vue挂载前接入员工体验模块。 Register the employee experience before mounting Vue. */
(function registerEmployeeExperience() {
  const experience = window.OpenXnetEmployeeExperience;
  if (!experience) throw new Error('Employee experience module is unavailable.');
  Object.assign(vue_data, experience.createState());
  Object.assign(vue_methods, experience.methods);
})();
