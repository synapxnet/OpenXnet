# -*- mode: python ; coding: utf-8 -*-
import platform
from PyInstaller.utils.hooks import collect_submodules

DESKTOP_EXCLUDED_PY_MODULES = {
    'py.connector_chat_client',
    'py.connector_settings',
    'py.connector_voice_client',
    'py.dingtalk_bot_manager',
    'py.discord_bot_manager',
    'py.feishu_bot_manager',
    'py.mcp_clients',
    'py.mcp_runtime',
    'py.qq_bot_manager',
    'py.server_task_api',
    'py.slack_bot_manager',
    'py.task_scheduler',
    'py.telegram_bot_manager',
    'py.telegram_client',
    'py.workers.configured_voice_engine',
    'py.workers.connector_worker',
    'py.workers.demo_worker',
    'py.workers.desktop_control_worker',
    'py.workers.document_engine',
    'py.workers.document_worker',
    'py.workers.live_worker',
    'py.workers.mcp_worker',
    'py.workers.memory_worker',
    'py.workers.persistent_vector_engine',
    'py.workers.task_execution_worker',
    'py.workers.vector_engine',
    'py.workers.vector_worker',
    'py.workers.voice_audio',
    'py.workers.voice_engine',
    'py.workers.voice_worker',
}


def include_desktop_python_module(module_name):
    """筛选 Desktop 基础包允许收集的 Python 模块，排除独立 Server 与 Feature Pack 实现。"""

    return module_name not in DESKTOP_EXCLUDED_PY_MODULES


# 全平台禁用签名配置
universal_disable_sign = {
    'codesign_identity': None,
    'entitlements_file': None,
    'signing_requirements': '',
    'exclude_binaries': True
}

a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('config/settings_template.json', 'config'),
        ('config/locales.json', 'config'),
        ('tiktoken_cache', 'tiktoken_cache'),
        ('skills', 'skills'),
    ],
    hiddenimports=[
        'pydantic.deprecated.decorator',
        'tiktoken_ext',
        'tiktoken_ext.openai_public',
        'imageio_ffmpeg', 
        'aiofiles',
        'shortuuid',
        'pyautogui',
        'pyperclip',
        # 自动收集 py/ 下的所有模块（包括 live_router, skills, context 等 53 个模块）
        *collect_submodules('py', filter=include_desktop_python_module),
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'sherpa_onnx',
        'soundfile',
        'edge_tts',
        'elevenlabs',
        'imageio_ffmpeg',
        'pydub',
        'pyttsx3',
        'tetos',
        'onnxruntime',
        'tokenizers',
        'transformers',
        'faiss',
        'botpy',
        'dingtalk_stream',
        'discord',
        'googleapiclient',
        'lark_oapi',
        'langchain_google_community',
        'slack_sdk',
        'PyPDF2',
        'docx',
        'mem0',
        'numpy',
        'odf',
        'openpyxl',
        'pptx',
        'pypdf',
        'qdrant_client',
        'scipy',
        'striprtf',
        'xlrd',
        'rank_bm25',
        'greenlet',
        'fastapi_mcp',
        'httpx_sse',
        'httpx_ws',
        'mcp',
        'mcp_alchemy',
        'oracledb',
        'orjson',
        'psycopg2',
        'pymssql',
        'pymysql',
        'sqlalchemy',
        'sse_starlette',
        'boto3',
        'botocore',
        'anthropic',
        'claude_agent_sdk',
        'cryptography',
        'e2b.sandbox.mcp',
        'google.cloud.modelarmor',
        'google.cloud.texttospeech',
        'grpc',
        'grpc_status',
        'hf_xet',
        'huggingface_hub',
        'langchain',
        'langchain_classic',
        'langchain_community',
        'langchain_core',
        'langchain_exa',
        'langchain_ollama',
        'langchain_openai',
        'langchain_text_splitters',
        'langsmith',
        'flask',
        'google.auth',
        'google.oauth2',
        'pyasn1',
        'pythoncom',
        'python_a2a',
        'python_a2a.client.llm.bedrock',
        'python_a2a.langchain',
        'python_a2a.mcp',
        's3transfer',
        'safetensors',
        'selenium',
        'trio',
        'trio_websocket',
        'websocket',
        'werkzeug',
        'pywin32_system32',
        'pywintypes',
        'win32api',
        'win32com',
        'win32evtlog',
        'win32evtlogutil',
        'win32gui',
        'win32process',
        'win32trace',
        'win32traceutil',
        'win32ui',
        'zstandard',
        'py.mcp_clients',
        'py.mcp_runtime',
        'py.connector_chat_client',
        'py.connector_settings',
        'py.connector_voice_client',
        'py.dingtalk_bot_manager',
        'py.discord_bot_manager',
        'py.feishu_bot_manager',
        'py.qq_bot_manager',
        'py.server_task_api',
        'py.slack_bot_manager',
        'py.task_scheduler',
        'py.telegram_bot_manager',
        'py.telegram_client',
        'py.workers.mcp_worker',
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

task_worker_analysis = Analysis(
    ['py/workers/task_execution_worker.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        'httpx',
        'py.sub_agent',
        'py.task_center',
        'py.task_delivery_policy',
        'py.task_execution_events',
        'py.task_execution_preflight',
        'py.task_execution_session',
        'py.task_terminal_delivery',
        'py.task_worker_store',
        'py.workers.protocol',
        'py.workers.runtime',
        'py.workers.task_execution_worker',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'boto3',
        'botocore',
        'anthropic',
        'claude_agent_sdk',
        'cryptography',
        'docx',
        'fastapi',
        'langchain',
        'langchain_core',
        'langchain_openai',
        'langsmith',
        'flask',
        'google.auth',
        'google.oauth2',
        'mem0',
        'openai',
        'openpyxl',
        'orjson',
        'numpy',
        'pptx',
        'pydub',
        'pypdf',
        'PyPDF2',
        'pyasn1',
        'pythoncom',
        'python_a2a',
        'py.delivery',
        'py.overlay_router',
        'py.routes',
        'py.server_task_api',
        'py.task_execution_broker_api',
        'py.task_scheduler',
        'qdrant_client',
        'torch',
        'transformers',
        'trio',
        'trio_websocket',
        'websocket',
        'werkzeug',
        'pywin32_system32',
        'pywintypes',
        'win32api',
        'win32com',
        'win32evtlog',
        'win32evtlogutil',
        'win32gui',
        'win32process',
        'win32trace',
        'win32traceutil',
        'win32ui',
        'zstandard',
    ],
    noarchive=False,
    optimize=1,
)
task_worker_pyz = PYZ(task_worker_analysis.pure)
task_worker_exe = EXE(
    task_worker_pyz,
    task_worker_analysis.scripts,
    [],
    exclude_binaries=True,
    name='task-worker',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
)

# 修改基础配置
base_exe_config = {
    'debug': False,
    'strip': False,
    'upx': True,
    'bootloader_ignore_signals': False,
    'disable_windowed_traceback': False,
    **universal_disable_sign
}

# The execution engine shares the provider/tool dependency closure with the
# compatibility server, but owns a separate executable and runtime profile.
execution_engine_exe = EXE(
    pyz,
    a.scripts,
    [],
    name='execution-engine',
    **base_exe_config
)

if platform.system() == 'Darwin':
    # macOS 特殊配置
    exe = EXE(
        pyz,
        a.scripts,
        [],
        name='server',
        argv_emulation=True,
        icon='static/source/icon.png',
        **base_exe_config
    )
    coll = COLLECT(
        exe,
        execution_engine_exe,
        task_worker_exe,
        a.binaries,
        a.datas,
        task_worker_analysis.binaries,
        task_worker_analysis.datas,
        name='server',
        upx_exclude=[],
        **universal_disable_sign
    )
    # macOS 专用 .app 配置
    app = BUNDLE(
        coll,
        name='server.app',
        icon='static/source/icon.png',
        bundle_identifier='com.superagent.party',
        info_plist={
            'NSHighResolutionCapable': 'True',
            'LSBackgroundOnly': 'True',
            'NSAppleScriptEnabled': 'NO'
        },
        **universal_disable_sign
    )
elif platform.system() == 'Windows':
    # Windows 特殊配置
    exe = EXE(
        pyz,
        a.scripts,
        [],
        name='server',
        icon='static/source/icon.ico',  # 使用 .ico 格式图标
        **base_exe_config
    )
    coll = COLLECT(
        exe,
        execution_engine_exe,
        task_worker_exe,
        a.binaries,
        a.datas,
        task_worker_analysis.binaries,
        task_worker_analysis.datas,
        name='server',
        upx_exclude=[],
        **universal_disable_sign
    )
else:
    # Linux 配置
    exe = EXE(
        pyz,
        a.scripts,
        [],
        name='server',
        **base_exe_config
    )
    coll = COLLECT(
        exe,
        execution_engine_exe,
        task_worker_exe,
        a.binaries,
        a.datas,
        task_worker_analysis.binaries,
        task_worker_analysis.datas,
        name='server',
        upx_exclude=[],
        **universal_disable_sign
    )
