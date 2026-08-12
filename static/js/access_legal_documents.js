(function attachOpenXnetAccessLegalDocuments(global) {
  const version = '2026-04-27';

  global.OPENXNET_ACCESS_LEGAL_VERSION = version;
  global.OPENXNET_ACCESS_LEGAL_DOCUMENTS = {
    zh: {
      terms: {
        title: 'OpenXnet 服务协议',
        summary: '请在注册、登录或使用 OpenXnet 账户服务、订阅服务、企业空间及相关功能前，认真阅读并充分理解本协议。',
        updatedAt: '2026-04-27',
        sections: [
          {
            heading: '一、协议适用范围',
            paragraphs: [
              '本协议适用于你访问、下载、安装、注册、登录、使用 OpenXnet 桌面端、服务端、账号服务、订阅服务、企业空间、模型配置及与之相关的网页、接口、运营支持与后续更新功能时的全部行为。',
              '你勾选“我已阅读并同意《服务协议》与《隐私协议》”并继续登录或注册，即表示你已阅读、理解并同意接受本协议及 OpenXnet 隐私协议的约束。',
              '本协议依据《中华人民共和国民法典》《中华人民共和国网络安全法》《中华人民共和国数据安全法》《中华人民共和国个人信息保护法》等法律法规制定。'
            ]
          },
          {
            heading: '二、账户注册、登录与安全',
            paragraphs: [
              '你在注册或登录 OpenXnet 账户时，应当提供真实、准确、完整且持续有效的注册信息，并确保你对所使用的手机号、邮箱、账号或其他身份凭证拥有合法控制权。',
              '你应妥善保管账号、密码、验证码、令牌及其他认证信息。因你保管不善、转借、泄露、共享或被第三方非法使用导致的风险与损失，由你自行承担；但因 OpenXnet 故意或重大过失造成的除外。',
              '如果你发现账号存在异常登录、未经授权访问、凭证泄露或其他安全事件，应立即停止相关操作并通过 OpenXnet 官方网站、产品内公告或后续公布的支持渠道通知我们。'
            ]
          },
          {
            heading: '三、服务内容与使用规则',
            paragraphs: [
              'OpenXnet 提供账户登录、订阅购买、模型配置、企业空间、工作区协作、知识管理、角色卡、工具调用、支付订单查询及与人工智能相关的辅助能力。不同版本、套餐、地区或设备下的服务内容可能有所差异。',
              '你在使用 OpenXnet 及相关模型、插件、工作区、浏览器自动化、文件操作或企业空间功能时，应遵守法律法规、监管要求、公序良俗以及你与第三方之间的合法义务，不得利用 OpenXnet 从事违法违规、侵权、骚扰、欺诈、规避安全控制、恶意抓取、破坏网络或其他不当行为。',
              '如你在 OpenXnet 中接入第三方模型、第三方 API、企业内部系统、支付网关、短信服务或其他外部服务，你应确保已获得相应授权，并遵守对应第三方服务条款、隐私政策及安全要求。'
            ]
          },
          {
            heading: '四、AI 输出、工作区内容与用户责任',
            paragraphs: [
              'OpenXnet 提供的回答、建议、代码、摘要、自动化结果、角色卡行为、工具调用结果及其他 AI 输出，可能存在不准确、不完整、延迟、偏差或不适用于特定场景的情况，不应被视为法律、医疗、金融、税务、审计、合规或其他专业意见。',
              '你应对自己输入、上传、同步、保存、分享、发布或委托 OpenXnet 处理的文本、图片、语音、工作区文件、知识库内容、企业资料及其他数据拥有合法权利，并对其内容真实性、合法性、完整性和可使用性负责。',
              '对于高风险或高度敏感场景，包括但不限于银行、支付、证券、医疗诊断、未公开商业机密、国家秘密及其他依法受限数据处理场景，你应自行审慎评估是否适合使用 OpenXnet。'
            ]
          },
          {
            heading: '五、订阅、计费与支付',
            paragraphs: [
              'OpenXnet 可能提供免费能力、订阅套餐、企业套餐、试用、续费、升级、降级或定制能力。具体的计费周期、价格、模型权益、额度、配额、退款规则和开通方式，以你购买页面、订单页面、套餐说明、后台配置及当时展示的规则为准。',
              '你理解并同意，部分支付、短信、额度同步、模型调用或身份映射能力可能由第三方服务商提供。第三方支付结果、回调延迟、额度同步时间、短信到达时间及第三方系统异常，不当然视为 OpenXnet 违约。',
              '如因你填写信息错误、账户异常、支付渠道受限、风控策略、第三方网关异常或其他非 OpenXnet 单方原因导致支付失败、开通延迟或权益同步延迟，OpenXnet 将在合理范围内协助核查，但不对超出合理控制范围的后果承担责任。'
            ]
          },
          {
            heading: '六、知识产权与许可',
            paragraphs: [
              'OpenXnet 及其相关软件、界面设计、商标标识、文档、运营内容、交互方案、非开源代码、组合编排、服务流程与产品结构中的知识产权，依法归 OpenXnet 或相关权利人所有。',
              '除非法律法规另有规定，或经权利人书面许可，你不得对 OpenXnet 进行反向工程、反向汇编、反向传播商业版本源码、批量复制、二次销售、恶意镜像、去标识化重包装、规避授权控制或以其他方式侵犯 OpenXnet 及第三方权利人的合法权益。',
              '对于你自行提交或配置到 OpenXnet 的内容，你保留相应权利；但为实现服务功能、故障排查、安全保障、订阅映射与合法合规处理之必要，你同意授予 OpenXnet 在服务期限内进行存储、处理、传输、展示与必要技术性使用的有限授权。'
            ]
          },
          {
            heading: '七、服务变更、中止与终止',
            paragraphs: [
              'OpenXnet 有权在符合法律法规及合理商业安排的前提下，对服务功能、页面结构、接口能力、套餐内容、可用模型、兼容版本、计费方式、权限体系、企业空间能力或支持渠道进行更新、优化、暂停、迁移或下线。',
              '如你违反法律法规、本协议、隐私协议、第三方规则或存在账号安全风险、支付风险、投诉纠纷、异常调用、恶意使用、侵权行为，OpenXnet 有权视情况采取提醒、限制功能、暂停服务、冻结权益、终止提供服务、撤销订单、屏蔽接口或追究法律责任等措施。',
              '你也可以根据产品当时提供的路径停止使用相关服务；但停止使用前已经产生的订阅、交易、应付款项、争议处理、合规留存义务及其他依法应继续履行的责任，不因你停止使用而当然免除。'
            ]
          },
          {
            heading: '八、责任限制',
            paragraphs: [
              '在适用法律允许的最大范围内，OpenXnet 将尽合理努力保障服务连续性与安全性，但不承诺服务在任何时间均绝对不中断、无瑕疵、无延迟、无错误、完全适配所有设备、系统、地区、网络环境、第三方模型或第三方接口。',
              '对于因不可抗力、网络故障、电信故障、黑客攻击、病毒事件、监管要求、第三方服务中断、支付通道异常、模型供应方策略变化、系统升级维护、你自身设备故障、操作不当或其他 OpenXnet 无法合理控制的原因导致的损失，OpenXnet 在法律允许范围内不承担责任。',
              '如 OpenXnet 依法应承担责任，其责任范围以导致该责任发生的直接损失为限；法律另有强制性规定的，从其规定。'
            ]
          },
          {
            heading: '九、适用法律与争议解决',
            paragraphs: [
              '本协议的订立、生效、解释、履行、变更及争议解决，均适用中华人民共和国法律。',
              '因本协议或 OpenXnet 服务引起的任何争议，双方应先友好协商；协商不成的，任一方可依法向 OpenXnet 运营主体所在地有管辖权的人民法院提起诉讼。'
            ]
          },
          {
            heading: '十、协议更新',
            paragraphs: [
              'OpenXnet 有权根据法律法规变化、产品升级、功能调整、运营策略或风险控制需要，对本协议进行更新，并通过登录页、产品内弹窗、网站公告或其他合理方式提示你。',
              '更新后的协议自公布或载明的生效日期起生效。如你在更新后继续登录、注册或使用相关服务，即视为你已接受更新后的协议内容。'
            ]
          }
        ]
      },
      privacy: {
        title: 'OpenXnet 隐私协议',
        summary: '本隐私协议用于说明 OpenXnet 如何收集、使用、存储、共享和保护你的个人信息，以及你享有的相关权利。',
        updatedAt: '2026-04-27',
        sections: [
          {
            heading: '一、适用范围与法律依据',
            paragraphs: [
              '本隐私协议适用于你在注册、登录、购买订阅、使用企业空间、管理个人中心、调用第三方模型、发起支付、接收短信验证码以及使用 OpenXnet 相关网页、接口和客户端过程中，OpenXnet 对个人信息的处理活动。',
              'OpenXnet 将依照《中华人民共和国个人信息保护法》《中华人民共和国网络安全法》《中华人民共和国数据安全法》及其他适用法律法规，遵循合法、正当、必要和诚信原则处理你的个人信息。'
            ]
          },
          {
            heading: '二、我们可能收集的个人信息类型',
            paragraphs: [
              '为实现注册、登录和账户管理，我们可能收集你的手机号、登录标识、密码摘要、短信验证码校验结果、昵称、邮箱、头像地址及账户状态信息。',
              '为实现订阅、支付、额度同步与售后支持，我们可能收集订单号、套餐信息、支付状态、支付渠道、开通状态、网关映射信息、额度使用情况以及与你订阅相关的客服处理记录。',
              '为保障服务稳定、安全与兼容性，我们可能处理设备与日志信息，例如设备标识、操作系统信息、应用版本、错误日志、接口调用日志、登录时间、IP 相关网络信息、令牌有效期及安全校验记录。',
              '你在工作区、知识库、角色卡、聊天、上传文件、截图、企业空间资料或第三方模型调用中主动输入或上传的内容，可能包含个人信息、企业信息或其他敏感数据。你应确保此类内容具有合法来源，并对提交范围负责。'
            ]
          },
          {
            heading: '三、我们如何使用你的个人信息',
            paragraphs: [
              '我们处理你的个人信息，主要用于账户注册与登录、身份验证、订阅开通、订单管理、额度同步、模型服务接入、企业空间权限控制、客户支持、安全审计、功能优化、故障排查、风控合规及法律法规要求的其他合法用途。',
              '如你选择接入第三方模型提供方、第三方 API、第三方支付网关、第三方短信服务或其他外部能力，为完成你主动发起的功能请求，我们可能按照你的操作指令将必要信息传输给相应第三方。'
            ]
          },
          {
            heading: '四、权限、令牌与本地存储',
            paragraphs: [
              'OpenXnet 可能在本地设备中存储登录令牌、会话信息、界面偏好、工作区配置、最近使用状态和必要缓存，以提升登录体验与功能连续性。',
              '如你启用浏览器控制、文件操作、工作区读取、企业空间、截图、通知、语音、支付或模型配置等能力，OpenXnet 可能按照你主动触发的操作请求相应权限。你可以根据操作系统、设备或产品设置关闭相关权限，但部分功能可能因此无法正常使用。'
            ]
          },
          {
            heading: '五、我们如何共享、委托处理与公开披露',
            paragraphs: [
              '我们不会因营销目的向无关第三方出售你的个人信息。',
              '在实现短信验证、支付处理、订阅开通、额度同步、第三方模型调用、云服务托管、安全防护或合规审计等必要场景下，我们可能委托合作方处理或与合作方共享必要信息，但会要求其仅在授权范围内处理，并采取相应安全保护措施。',
              '除法律法规另有要求、获得你单独同意、履行法定义务、保护你或其他主体重大合法权益所必需，或为处理你主动发起的服务请求所必需外，我们不会向无关第三方公开披露你的个人信息。'
            ]
          },
          {
            heading: '六、个人信息的存储与保护',
            paragraphs: [
              '我们会在实现本协议所述目的所必需的最短期限内保存你的个人信息，并依据业务需要、法定义务、审计要求、争议处理或安全留痕需要，合理确定不同信息的保存期限。',
              'OpenXnet 会采取访问控制、鉴权校验、最小权限、日志审计、传输加密、密码摘要、环境隔离及其他合理的技术与管理措施保护你的个人信息。但请你理解，互联网和软件环境并不存在绝对安全。'
            ]
          },
          {
            heading: '七、你的权利',
            paragraphs: [
              '在适用法律规定的范围内，你有权访问、更正、补充、删除你的个人信息，有权撤回同意、注销账户、获取相关规则说明，并有权对个人信息处理活动提出异议或投诉。',
              '如你希望行使相关权利，可通过 OpenXnet 官方网站、产品内后续公布的客服渠道或账号服务入口提交申请。我们会在符合法律法规要求的期限内进行核验与处理。'
            ],
            items: [
              '撤回同意不影响撤回前基于你同意开展的处理活动效力。',
              '在法律法规要求保留、履行合同义务或争议处理中必要的范围内，部分信息可能无法立即删除。'
            ]
          },
          {
            heading: '八、未成年人保护',
            paragraphs: [
              '若你是未满十八周岁的未成年人，应在监护人阅读并同意本隐私协议及相关规则后使用 OpenXnet。',
              '如我们发现未成年人在未取得监护人同意的情况下向我们提供了个人信息，我们将依法尽快采取删除、停止处理或其他适当措施。'
            ]
          },
          {
            heading: '九、跨境提供与第三方模型场景',
            paragraphs: [
              '如你在 OpenXnet 中主动配置境外模型服务、境外 API、境外云服务、境外支付或其他境外第三方能力，你理解为实现相应功能，相关请求数据可能按照你的指令传输至境外或由境外服务商处理。',
              '对于你主动选择接入的第三方服务商，其隐私保护义务、数据处理规则和安全能力由该第三方自行负责。我们建议你在接入前仔细阅读相应第三方的服务条款与隐私政策。'
            ]
          },
          {
            heading: '十、隐私协议更新',
            paragraphs: [
              '当法律法规、业务功能、处理目的、处理方式、共享对象或安全策略发生变化时，我们可能更新本隐私协议，并通过登录页、产品弹窗、站点公告或其他合理方式向你提示。',
              '更新后的隐私协议自公布或载明的生效日期起生效；如你在更新后继续注册、登录或使用相关服务，即视为你已阅读并接受更新后的隐私协议。'
            ]
          }
        ]
      }
    },
    en: {
      terms: {
        title: 'OpenXnet Terms of Service',
        summary: 'Please read these Terms carefully before you register, sign in to, or use OpenXnet account services, subscription services, enterprise workspace features, or any related functionality.',
        updatedAt: '2026-04-27',
        sections: [
          {
            heading: '1. Scope of These Terms',
            paragraphs: [
              'These Terms apply to your access to, download of, installation of, registration for, sign-in to, and use of OpenXnet desktop software, server software, account services, subscription services, enterprise workspace features, model configuration tools, related websites, APIs, operational support, and later updates.',
              'By checking the box confirming that you have read and agree to the Terms of Service and Privacy Policy, and then continuing to register or sign in, you acknowledge that you have read, understood, and agreed to be bound by these Terms and the OpenXnet Privacy Policy.',
              'These Terms are drafted with reference to applicable laws and regulations of the People\'s Republic of China, including the Civil Code, the Cybersecurity Law, the Data Security Law, and the Personal Information Protection Law.'
            ]
          },
          {
            heading: '2. Account Registration, Sign-In, and Security',
            paragraphs: [
              'When you register for or sign in to an OpenXnet account, you must provide true, accurate, complete, and up-to-date information, and you must have lawful control over the phone number, email address, account identifier, or any other credential you use.',
              'You are responsible for safeguarding your account, password, verification codes, tokens, and other authentication credentials. Risks and losses caused by your failure to safeguard them, by sharing them, or by unauthorized use by a third party are your responsibility, except where caused by OpenXnet’s intentional misconduct or gross negligence.',
              'If you discover abnormal access, unauthorized sign-in, credential leakage, or any other security incident, you should immediately stop the relevant activity and notify us through the OpenXnet official website, in-product notices, or later published support channels.'
            ]
          },
          {
            heading: '3. Services and Rules of Use',
            paragraphs: [
              'OpenXnet may provide account sign-in, subscription purchasing, model configuration, enterprise workspace access, workspace collaboration, knowledge management, staff role cards, tool invocation, payment order queries, and AI-related assistance. Available features may differ by version, plan, region, device, or deployment profile.',
              'When you use OpenXnet, related models, plugins, workspace features, browser automation, file operations, or enterprise workspace functions, you must comply with laws and regulations, regulatory requirements, public order and morals, and any obligations you owe to third parties. You may not use OpenXnet for unlawful, infringing, harassing, fraudulent, security-bypassing, malicious scraping, disruptive, or otherwise improper conduct.',
              'If you connect OpenXnet to third-party models, third-party APIs, enterprise internal systems, payment gateways, SMS providers, or other external services, you are responsible for ensuring that you have the necessary authorization and that you comply with the relevant third-party terms, privacy rules, and security requirements.'
            ]
          },
          {
            heading: '4. AI Output, Workspace Content, and Your Responsibility',
            paragraphs: [
              'Answers, suggestions, code, summaries, automated results, role-card behavior, tool outputs, and other AI-generated content provided through OpenXnet may be inaccurate, incomplete, delayed, biased, or unsuitable for a particular use case. They are not legal, medical, financial, tax, audit, compliance, or other professional advice.',
              'You represent that you have the necessary rights to input, upload, synchronize, store, share, publish, or ask OpenXnet to process any text, images, audio, workspace files, knowledge base materials, enterprise data, or other content, and you are responsible for the truthfulness, legality, completeness, and permitted use of that content.',
              'For high-risk or highly sensitive scenarios, including banking, payment, securities, medical diagnosis, unpublished trade secrets, state secrets, or other legally restricted data processing scenarios, you must independently assess whether OpenXnet is appropriate for your intended use.'
            ]
          },
          {
            heading: '5. Subscriptions, Billing, and Payment',
            paragraphs: [
              'OpenXnet may offer free capabilities, subscription plans, enterprise plans, trials, renewals, upgrades, downgrades, or custom services. The applicable billing cycle, price, model access, quota, usage entitlements, refund rules, and activation method are determined by the plan page, order page, plan description, backend configuration, and rules displayed at the time of purchase.',
              'You understand and agree that certain payment, SMS, quota synchronization, model invocation, or identity mapping capabilities may be provided by third-party service providers. Delays or failures in third-party payment results, callbacks, quota synchronization, or message delivery do not automatically constitute a breach by OpenXnet.',
              'If payment fails, activation is delayed, or entitlements are not synchronized because of incorrect information you provided, account issues, channel restrictions, fraud controls, third-party gateway failures, or other causes outside OpenXnet’s sole control, OpenXnet may provide reasonable assistance in investigation, but is not responsible for consequences beyond its reasonable control.'
            ]
          },
          {
            heading: '6. Intellectual Property and Permitted Use',
            paragraphs: [
              'OpenXnet and its software, interface design, trademarks, documentation, operational content, interaction design, non-open-source code, orchestration logic, service workflows, and product structure are protected by intellectual property laws and belong to OpenXnet or the relevant rights holders.',
              'Unless otherwise permitted by law or authorized in writing by the relevant rights holder, you may not reverse engineer, decompile, redistribute commercial versions, mass copy, resell, maliciously mirror, remove branding for repackaging, bypass license controls, or otherwise infringe the lawful rights and interests of OpenXnet or third parties.',
              'You retain your rights in content that you submit or configure into OpenXnet, but you grant OpenXnet a limited license during the service period to store, process, transmit, display, and technically use that content as necessary to provide the service, troubleshoot issues, support subscription mapping, maintain security, and satisfy lawful compliance obligations.'
            ]
          },
          {
            heading: '7. Service Changes, Suspension, and Termination',
            paragraphs: [
              'Subject to applicable law and reasonable business arrangements, OpenXnet may update, optimize, suspend, migrate, or discontinue service features, page structures, API capabilities, plan offerings, available models, supported versions, billing methods, permission systems, enterprise workspace capabilities, or support channels.',
              'If you violate applicable law, these Terms, the Privacy Policy, third-party rules, or if your use creates security, payment, complaint, abusive, or infringement risks, OpenXnet may issue warnings, limit features, suspend services, freeze entitlements, terminate access, revoke orders, block interfaces, or pursue legal remedies as appropriate.',
              'You may also stop using the relevant services through the product flow available at that time. However, any subscriptions, transactions, payment obligations, dispute handling, compliance retention duties, or other responsibilities that have already arisen are not automatically discharged merely because you stop using the service.'
            ]
          },
          {
            heading: '8. Limitation of Liability',
            paragraphs: [
              'To the maximum extent permitted by applicable law, OpenXnet will make reasonable efforts to maintain the continuity and security of the service, but does not guarantee that the service will always be uninterrupted, error-free, defect-free, delay-free, or fully compatible with every device, system, region, network condition, third-party model, or third-party interface.',
              'OpenXnet is not liable, to the extent permitted by law, for losses caused by force majeure, network failures, telecommunications failures, hacker attacks, malware incidents, regulatory requirements, third-party service interruptions, payment channel failures, changes by model providers, system maintenance, your device failures, your improper operations, or other causes beyond OpenXnet’s reasonable control.',
              'Where OpenXnet is legally required to bear liability, such liability shall be limited to direct losses caused by the event giving rise to that liability, unless mandatory law provides otherwise.'
            ]
          },
          {
            heading: '9. Governing Law and Dispute Resolution',
            paragraphs: [
              'These Terms, including their formation, effectiveness, interpretation, performance, amendment, and dispute resolution, are governed by the laws of the People\'s Republic of China.',
              'Any dispute arising from or relating to these Terms or the OpenXnet service should first be resolved through friendly consultation. If consultation fails, either party may bring proceedings before a court of competent jurisdiction at the location of the OpenXnet operating entity.'
            ]
          },
          {
            heading: '10. Updates to These Terms',
            paragraphs: [
              'OpenXnet may update these Terms as required by changes in law, product upgrades, feature adjustments, operational strategy, or risk control needs, and may notify you through the sign-in page, in-product dialog, website notice, or another reasonable method.',
              'The updated Terms take effect on the published effective date. If you continue to register, sign in, or use the service after the update takes effect, you are deemed to have accepted the updated Terms.'
            ]
          }
        ]
      },
      privacy: {
        title: 'OpenXnet Privacy Policy',
        summary: 'This Privacy Policy explains how OpenXnet collects, uses, stores, shares, and protects your personal information, and the rights you may exercise regarding that information.',
        updatedAt: '2026-04-27',
        sections: [
          {
            heading: '1. Scope and Legal Basis',
            paragraphs: [
              'This Privacy Policy applies to OpenXnet’s processing of personal information when you register, sign in, purchase subscriptions, use enterprise workspace features, manage your profile center, connect third-party models, initiate payments, receive SMS verification codes, or otherwise use OpenXnet websites, APIs, and client applications.',
              'OpenXnet processes personal information in accordance with applicable laws and regulations, including the Personal Information Protection Law, the Cybersecurity Law, and the Data Security Law of the People\'s Republic of China, and follows the principles of lawfulness, legitimacy, necessity, and good faith.'
            ]
          },
          {
            heading: '2. Categories of Personal Information We May Process',
            paragraphs: [
              'To support registration, sign-in, and account management, we may process your phone number, sign-in identifier, password hash, SMS verification results, nickname, email address, avatar URL, and account status information.',
              'To support subscriptions, payments, quota synchronization, and after-sales support, we may process order numbers, plan information, payment status, payment channels, activation status, gateway mapping data, quota usage data, and customer support records related to your subscription.',
              'To maintain service stability, security, and compatibility, we may process device and log information such as device identifiers, operating system information, application version, error logs, API invocation logs, sign-in time, IP-related network information, token validity data, and security verification records.',
              'Content that you actively input or upload into workspaces, knowledge bases, role cards, chats, uploaded files, screenshots, enterprise materials, or third-party model calls may contain personal information, enterprise information, or other sensitive data. You are responsible for ensuring that such content has a lawful source and that the scope you submit is appropriate.'
            ]
          },
          {
            heading: '3. How We Use Personal Information',
            paragraphs: [
              'We process personal information mainly to enable account registration and sign-in, identity verification, subscription activation, order management, quota synchronization, model service integration, enterprise workspace permission control, customer support, security auditing, feature optimization, troubleshooting, risk control, compliance, and other lawful purposes required by applicable law.',
              'If you choose to connect OpenXnet to a third-party model provider, third-party API, third-party payment gateway, third-party SMS provider, or another external capability, we may transfer the minimum necessary information to that provider according to your instructions in order to fulfill the function you requested.'
            ]
          },
          {
            heading: '4. Permissions, Tokens, and Local Storage',
            paragraphs: [
              'OpenXnet may store sign-in tokens, session information, interface preferences, workspace configuration, recent usage state, and necessary caches on your local device to improve sign-in continuity and feature usability.',
              'If you enable browser control, file operations, workspace reading, enterprise workspace features, screenshots, notifications, voice, payment, or model configuration features, OpenXnet may request the relevant permissions in response to your deliberate actions. You may disable these permissions through the operating system, device, or product settings, but some features may then become unavailable.'
            ]
          },
          {
            heading: '5. Sharing, Entrusted Processing, and Disclosure',
            paragraphs: [
              'We do not sell your personal information to unrelated third parties for marketing purposes.',
              'Where necessary to provide SMS verification, payment processing, subscription activation, quota synchronization, third-party model invocation, cloud hosting, security protection, or compliance auditing, we may entrust partners to process or share the minimum necessary information with them, subject to contractual and management restrictions requiring them to process the information only within the authorized scope and to take appropriate security measures.',
              'Except where required by law, separately authorized by you, necessary to fulfill a legal obligation, necessary to protect major lawful rights and interests of you or others, or necessary to process a service request that you initiated, we will not publicly disclose your personal information to unrelated third parties.'
            ]
          },
          {
            heading: '6. Storage and Protection',
            paragraphs: [
              'We retain personal information for the shortest period necessary to achieve the purposes described in this Policy, and may retain different categories of information for a longer period where required for business continuity, legal obligations, audit requirements, dispute handling, or security records.',
              'OpenXnet uses reasonable technical and organizational safeguards such as access controls, authentication checks, least-privilege controls, audit logging, secure transmission, password hashing, environment separation, and related measures to protect your personal information. However, no software or network environment can be guaranteed to be absolutely secure.'
            ]
          },
          {
            heading: '7. Your Rights',
            paragraphs: [
              'To the extent provided by applicable law, you may have the right to access, correct, supplement, or delete your personal information; withdraw consent; deactivate or deregister your account; request explanations of relevant rules; and object to certain processing activities or lodge complaints.',
              'If you wish to exercise your rights, you may submit a request through the OpenXnet official website, later announced in-product support channels, or the account service entry point. We will verify and process requests within the time period required by applicable law.'
            ],
            items: [
              'Withdrawal of consent does not affect the validity of processing carried out before the withdrawal.',
              'Where information must be retained by law, is necessary to perform contractual obligations, or is required for dispute handling, deletion may not be possible immediately.'
            ]
          },
          {
            heading: '8. Protection of Minors',
            paragraphs: [
              'If you are under the age of eighteen, you should use OpenXnet only after your guardian has read and agreed to this Privacy Policy and related rules.',
              'If we become aware that a minor has provided personal information without appropriate guardian consent where required, we will take prompt action as required by law, including deletion, cessation of processing, or other appropriate measures.'
            ]
          },
          {
            heading: '9. Cross-Border Transfers and Third-Party Model Scenarios',
            paragraphs: [
              'If you actively configure OpenXnet to use offshore model services, offshore APIs, offshore cloud services, offshore payment services, or other offshore third-party capabilities, you understand that data necessary to complete your requested function may be transmitted abroad or processed by offshore service providers according to your instructions.',
              'For third-party service providers that you choose to connect, their privacy obligations, data handling rules, and security capabilities are determined by those third parties. We strongly recommend that you review their terms and privacy policies before enabling them.'
            ]
          },
          {
            heading: '10. Policy Updates',
            paragraphs: [
              'We may update this Privacy Policy when laws change, business functions are adjusted, processing purposes or methods change, sharing counterparts are updated, or security strategies evolve, and we may notify you through the sign-in page, in-product notice, website notice, or another reasonable method.',
              'The updated Privacy Policy takes effect on the published effective date. If you continue to register, sign in, or use the relevant services after the update takes effect, you are deemed to have read and accepted the updated Privacy Policy.'
            ]
          }
        ]
      }
    }
  };
})(window);
