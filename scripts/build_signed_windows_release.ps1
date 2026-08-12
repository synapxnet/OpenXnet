param(
    [switch]$SkipBackendBuild,
    [switch]$SkipSignatureCheck
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

function Has-Value([string]$value) {
    return -not [string]::IsNullOrWhiteSpace($value)
}

$hasPfxEnv = (Has-Value $env:WIN_CSC_LINK) -or (Has-Value $env:CSC_LINK)
$hasStoreSelector = (Has-Value $env:WIN_CSC_SHA1) -or (Has-Value $env:WIN_CSC_SUBJECT_NAME)

if (-not $hasPfxEnv -and -not $hasStoreSelector) {
    throw @"
No Windows code-signing certificate was configured.

Configure one of these before running this script:

PFX/CI route:
  `$env:WIN_CSC_LINK = 'D:\secure\OpenXnet-CodeSigning.pfx'
  `$env:WIN_CSC_KEY_PASSWORD = '<password>'

Windows certificate store / hardware-token route:
  `$env:WIN_CSC_SHA1 = '<certificate thumbprint>'
  # or
  `$env:WIN_CSC_SUBJECT_NAME = '<certificate subject name>'

Never commit certificate files, thumbprint-specific release notes, or passwords.
"@
}

if ($hasPfxEnv) {
    $link = if (Has-Value $env:WIN_CSC_LINK) { $env:WIN_CSC_LINK } else { $env:CSC_LINK }
    $password = if (Has-Value $env:WIN_CSC_KEY_PASSWORD) { $env:WIN_CSC_KEY_PASSWORD } else { $env:CSC_KEY_PASSWORD }

    if (-not (Has-Value $password)) {
        throw "WIN_CSC_KEY_PASSWORD or CSC_KEY_PASSWORD is required when using WIN_CSC_LINK/CSC_LINK."
    }

    $looksLikePath = -not ($link -match '^(https?://|data:|[A-Za-z0-9+/=]{80,})')
    if ($looksLikePath -and -not (Test-Path -LiteralPath $link)) {
        throw "The configured certificate file does not exist: $link"
    }

    $env:CSC_LINK = $link
    $env:CSC_KEY_PASSWORD = $password
}

if (-not $SkipBackendBuild) {
    npm run build:backend
}

npx electron-builder -w --config scripts/electron-builder.win-sign.config.cjs --publish never

if (-not $SkipSignatureCheck) {
    & (Join-Path $PSScriptRoot "check_windows_signature.ps1") -Strict
}
