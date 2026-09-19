/*
Copyright (C) 2026 Synapxnet. All rights reserved.
This file is Synapxnet Proprietary and Confidential. It is strictly
forbidden to copy, distribute, or use without explicit authorization.
人工审批弹窗生命周期 / Human approval popup lifecycle.
Author: maoyo | Department: 研发部 | Date: 2026-09-18
Version: 1.3.0 | Security Level: INTERNAL
__version__: 1.3.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
__maintainer__: maoyo | __email__: synapxnet@gmail.com
*/
/** 在挂载前注册审批状态和账户生命周期。 / Register approval state and account lifecycle before mounting. */
(function registerEnterpriseApprovalNotices() {
  const notices = window.OpenXnetEnterpriseApprovalNotices;
  if (!notices) throw new Error('Enterprise approval notices are unavailable.');
  Object.assign(vue_data, notices.createState());
  Object.assign(vue_methods, notices.methods);
  window.OpenXnetEnterpriseApprovalLifecycle = {
    computed: {
      /** 用企业权限及稳定账号标识区分通知会话。 / Separate notice sessions using enterprise access and stable account identity. */
      enterpriseApprovalAccountKey() {
        if (this.canUseEnterprise !== true) return '';
        return String(this.authState?.profile?.id || this.authState?.profile?.phone || 'authenticated-enterprise');
      },
      /** 渲染冻结的审批摘要，不依赖当前选中事件。 / Render the frozen approval summary independently of selected incidents. */
      enterpriseApprovalNoticeView() { return this.getEnterpriseApprovalNoticeViewModel(); },
      /** 以安全摘要渲染多项审批便签。 / Render multiple approval tabs using safe summaries. */
      enterpriseApprovalNoticeTabs() { return this.getEnterpriseApprovalNoticeTabs(); },
    },
    watch: {
      enterpriseApprovalAccountKey: {
        immediate: true,
        /** 账户或权限变化时废弃旧队列与未完成的读取。 / Discard the previous queue and outstanding reads on account or access changes. */
        handler(key) { this.restartEnterpriseApprovalObservation(key); },
      },
    },
    methods: {
      /** 登录后读取待审批，退出后停止观察，迟到响应不会恢复旧账户内容。 / Read approvals after login and stop on logout, rejecting late responses from previous accounts. */
      restartEnterpriseApprovalObservation(key) {
        this.stopEnterpriseApprovalObservation();
        this.resetEnterpriseApprovalNotices(Boolean(key));
        if (!key) return;
        const generation = this.competitionProgressPollGeneration;
        Promise.resolve().then(/** 只读取当前会话的真实运行快照。 / Read the actual run snapshot for the current session only. */ async () => {
          if (generation !== this.competitionProgressPollGeneration || this.canUseEnterprise !== true) return;
          try {
            const snapshot = await this.getApplicationCompetitionRuntime().getApplicationCompetitionSnapshot();
            if (generation === this.competitionProgressPollGeneration && this.enterpriseApprovalAccountKey === key) this.applyOperationsRuntimeSnapshot(snapshot);
          } catch {
            if (generation === this.competitionProgressPollGeneration) this.scheduleOperationsRuntimePoll();
          }
        });
      },
      /** 释放只读轮询并使所有旧读取失效。 / Release read-only polling and invalidate every prior read. */
      stopEnterpriseApprovalObservation() {
        this.competitionProgressPollGeneration = (this.competitionProgressPollGeneration || 0) + 1;
        if (this.competitionProgressPollTimer) window.clearTimeout(this.competitionProgressPollTimer);
        this.competitionProgressPollTimer = null;
        this.operationsNoticeBaseline = null;
        this.competitionBusyAction = '';
        this.competitionLoading = false;
        this.competitionMemoryLoading = false;
        this.enterpriseChatTaskStarting = false;
        this.enterpriseChatSending = false;
        this.enterpriseChatPending = {};
      },
      /** 阻止提交期间关闭，并将正常关闭记录为稍后处理。 / Prevent closing during submission and record normal dismissal as deferment. */
      beforeCloseEnterpriseApprovalNotice(done) {
        if (this.enterpriseApprovalNoticeBusy) return;
        this.closeEnterpriseApprovalNotice();
        done();
      },
    },
    /** 销毁时关闭观察和弹窗，保留后端待批请求。 / Stop observation and close the popup on teardown, preserving backend requests. */
    beforeUnmount() {
      this.stopEnterpriseApprovalObservation();
      this.resetEnterpriseApprovalNotices(false);
    },
  };
})();
