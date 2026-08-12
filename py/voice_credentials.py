# -*- coding: utf-8 -*-
"""Apply Main-scoped voice vendor credentials only inside the trusted backend."""

from __future__ import annotations

import base64
from copy import deepcopy
import json
import os
from typing import Any, Dict, Mapping, MutableMapping


VOICE_CREDENTIAL_ENV = "OPENXNET_VOICE_CREDENTIALS_B64"
VOICE_CREDENTIAL_SCHEMA = "openxnet.voice-credentials.runtime.v1"
VOICE_DEFAULT_SCOPE = "default"
VOICE_CREDENTIAL_FIELDS = (
    "azureSpeechKey",
    "volcAppId",
    "volcAccessKey",
    "volcSecretKey",
    "volcAppKey",
    "baiduApiKey",
    "baiduSecretKey",
    "minimaxApiKey",
    "minimaxGroupId",
    "xunfeiAppId",
    "xunfeiApiKey",
    "xunfeiApiSecret",
    "fishApiKey",
    "googleServiceAccount",
    "elevenLabsApiKey",
)
MAX_VOICE_CREDENTIAL_BOOTSTRAP_BYTES = 2 * 1024 * 1024
MAX_VOICE_SCOPE_COUNT = 129
MAX_VOICE_SCOPE_LENGTH = 256
MAX_VOICE_SECRET_LENGTH = 128 * 1024

_cached_credentials: Dict[str, Dict[str, str]] | None = None
_runtime_credentials_enabled: bool | None = None


def _contains_invalid_characters(value: str, *, allow_text_whitespace: bool = False) -> bool:
    """Return whether one credential contains forbidden control characters."""

    for character in value:
        codepoint = ord(character)
        if codepoint == 127 or codepoint == 0:
            return True
        if codepoint < 32 and not (allow_text_whitespace and character in "\t\n\r"):
            return True
    return False


def _parse_scope(value: Any) -> str:
    """Parse one exact default or named voice scope."""

    if not isinstance(value, str) or value != value.strip():
        raise RuntimeError("Voice credential scope is invalid.")
    if (
        not value
        or len(value) > MAX_VOICE_SCOPE_LENGTH
        or _contains_invalid_characters(value)
    ):
        raise RuntimeError("Voice credential scope is invalid.")
    return value


def _parse_secret(field: str, value: Any) -> str:
    """Parse one bounded voice credential field from Main."""

    if not isinstance(value, str):
        raise RuntimeError("Voice credential entry is invalid.")
    secret = value.strip()
    if (
        not secret
        or len(secret) > MAX_VOICE_SECRET_LENGTH
        or _contains_invalid_characters(
            secret,
            allow_text_whitespace=field == "googleServiceAccount",
        )
    ):
        raise RuntimeError("Voice credential entry is invalid.")
    if field == "googleServiceAccount":
        try:
            document = json.loads(secret)
        except Exception as error:
            raise RuntimeError("Google voice service-account credential is invalid.") from error
        if not isinstance(document, Mapping):
            raise RuntimeError("Google voice service-account credential is invalid.")
    return secret


def _load_runtime_credentials() -> Dict[str, Dict[str, str]]:
    """Decode and cache the bounded voice credential envelope from Main."""

    global _cached_credentials, _runtime_credentials_enabled
    if _cached_credentials is not None:
        return deepcopy(_cached_credentials)

    encoded = str(os.environ.pop(VOICE_CREDENTIAL_ENV, "") or "").strip()
    _runtime_credentials_enabled = bool(encoded)
    if not encoded:
        _cached_credentials = {}
        return {}
    try:
        decoded = base64.b64decode(encoded, validate=True)
        if len(decoded) > MAX_VOICE_CREDENTIAL_BOOTSTRAP_BYTES:
            raise ValueError("Voice credential bootstrap exceeds its byte budget.")
        payload = json.loads(decoded.decode("utf-8"))
    except Exception as error:
        raise RuntimeError("Voice credential bootstrap is invalid.") from error
    if not isinstance(payload, Mapping) or set(payload) != {"schema", "credentials"}:
        raise RuntimeError("Voice credential bootstrap fields are invalid.")
    if payload.get("schema") != VOICE_CREDENTIAL_SCHEMA:
        raise RuntimeError("Voice credential bootstrap schema is invalid.")
    raw_credentials = payload.get("credentials")
    if not isinstance(raw_credentials, Mapping) or len(raw_credentials) > MAX_VOICE_SCOPE_COUNT:
        raise RuntimeError("Voice credential bootstrap scopes are invalid.")

    credentials: Dict[str, Dict[str, str]] = {}
    for raw_scope, raw_fields in raw_credentials.items():
        scope = _parse_scope(raw_scope)
        if not isinstance(raw_fields, Mapping):
            raise RuntimeError("Voice credential scope entry is invalid.")
        fields: Dict[str, str] = {}
        for raw_field, raw_secret in raw_fields.items():
            if raw_field not in VOICE_CREDENTIAL_FIELDS:
                raise RuntimeError("Voice credential field is invalid.")
            fields[raw_field] = _parse_secret(raw_field, raw_secret)
        if fields:
            credentials[scope] = fields
    _cached_credentials = credentials
    return deepcopy(credentials)


def voice_runtime_credentials_enabled() -> bool:
    """Return whether Main supplied the process-scoped voice credential boundary."""

    if _runtime_credentials_enabled is None:
        _load_runtime_credentials()
    return bool(_runtime_credentials_enabled)


def apply_voice_credentials_to_scope(
    config: MutableMapping[str, Any],
    scope: str = VOICE_DEFAULT_SCOPE,
    *,
    preserve_existing: bool = False,
) -> MutableMapping[str, Any]:
    """Hydrate one default or named TTS configuration in process memory."""

    credentials = _load_runtime_credentials()
    if not voice_runtime_credentials_enabled():
        return config
    normalized_scope = _parse_scope(scope)
    fields = credentials.get(normalized_scope, {})
    for field in VOICE_CREDENTIAL_FIELDS:
        if fields.get(field):
            config[field] = fields[field]
        elif not preserve_existing:
            config[field] = ""
        config[f"{field}_configured"] = field in fields
    return config


def apply_voice_credentials(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Hydrate default and named TTS vendor credentials into settings memory."""

    tts_settings = settings.get("ttsSettings")
    if not isinstance(tts_settings, MutableMapping):
        return settings
    apply_voice_credentials_to_scope(tts_settings, VOICE_DEFAULT_SCOPE)
    named_voices = tts_settings.get("newtts")
    if isinstance(named_voices, Mapping):
        for scope, config in named_voices.items():
            if isinstance(config, MutableMapping):
                try:
                    apply_voice_credentials_to_scope(config, str(scope))
                except RuntimeError:
                    continue
    return settings


def redact_voice_credentials_for_persistence(settings: Mapping[str, Any]) -> Dict[str, Any]:
    """Return detached settings without Main-managed voice vendor secrets."""

    detached = deepcopy(dict(settings))
    if not voice_runtime_credentials_enabled():
        return detached
    credentials = _load_runtime_credentials()
    tts_settings = detached.get("ttsSettings")
    if not isinstance(tts_settings, MutableMapping):
        return detached

    def redact_scope(scope: str, config: MutableMapping[str, Any]) -> None:
        """Clear one TTS scope while retaining configured flags."""

        configured_fields = credentials.get(scope, {})
        for field in VOICE_CREDENTIAL_FIELDS:
            config[field] = ""
            config[f"{field}_configured"] = field in configured_fields

    redact_scope(VOICE_DEFAULT_SCOPE, tts_settings)
    named_voices = tts_settings.get("newtts")
    if isinstance(named_voices, Mapping):
        for scope, config in named_voices.items():
            if isinstance(config, MutableMapping):
                redact_scope(str(scope), config)
    return detached


def build_tetos_voice_config(
    provider: str,
    config: Mapping[str, Any],
    scope: str = VOICE_DEFAULT_SCOPE,
) -> Dict[str, Any]:
    """Fill one Tetos request config from its scoped runtime credentials."""

    result = dict(config)
    credentials = _load_runtime_credentials()
    if not voice_runtime_credentials_enabled():
        return result
    fields = credentials.get(_parse_scope(scope), {})
    mappings = {
        "azure": {"speech_key": "azureSpeechKey"},
        "baidu": {"api_key": "baiduApiKey", "secret_key": "baiduSecretKey"},
        "minimax": {"api_key": "minimaxApiKey", "group_id": "minimaxGroupId"},
        "xunfei": {
            "app_id": "xunfeiAppId",
            "api_key": "xunfeiApiKey",
            "api_secret": "xunfeiApiSecret",
        },
        "fish": {"api_key": "fishApiKey"},
    }
    for target, source in mappings.get(str(provider or "").lower(), {}).items():
        if not str(result.get(target) or "").strip() and fields.get(source):
            result[target] = fields[source]
    if str(provider or "").lower() == "google" and not result.get("service_account"):
        service_account = fields.get("googleServiceAccount", "")
        if service_account:
            result["service_account"] = json.loads(service_account)
    return result


def _reset_voice_credentials_cache_for_tests() -> None:
    """Reset process credential state for isolated unit tests."""

    global _cached_credentials, _runtime_credentials_enabled
    _cached_credentials = None
    _runtime_credentials_enabled = None
