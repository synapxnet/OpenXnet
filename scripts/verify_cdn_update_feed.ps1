param(
  [string]$BaseUrl = "https://download.openxnet.synapxnet.com/releases/latest/",
  [string]$ReleaseDir = (Join-Path $PSScriptRoot "..\release"),
  [string]$FixedInstallerName = "OpenXnet-Setup-win-x64.exe"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Normalize-FeedUrl {
  param([string]$Url)
  $trimmed = ($Url -as [string]).Trim()
  if (-not $trimmed) {
    throw "BaseUrl is required."
  }
  if ($trimmed.EndsWith("/")) {
    return $trimmed
  }
  return "$trimmed/"
}

function Get-MatchValue {
  param(
    [string]$Content,
    [string]$Pattern,
    [string]$Name
  )
  $match = [regex]::Match($Content, $Pattern, "Multiline")
  if (-not $match.Success) {
    throw "latest.yml is missing $Name."
  }
  return $match.Groups[1].Value.Trim().Trim("'").Trim('"')
}

function Test-LocalFile {
  param(
    [string]$Path,
    [string]$Name
  )
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Missing local release file: $Name ($Path)"
  }
  return Get-Item -LiteralPath $Path
}

function Resolve-LocalReleaseFile {
  param(
    [string]$ReleaseDir,
    [string]$FeedPath,
    [string]$Name
  )
  $directPath = Join-Path $ReleaseDir $FeedPath
  if (Test-Path -LiteralPath $directPath -PathType Leaf) {
    return Get-Item -LiteralPath $directPath
  }

  $fileName = Split-Path $FeedPath -Leaf
  $fallbackPath = Join-Path $ReleaseDir $fileName
  if (Test-Path -LiteralPath $fallbackPath -PathType Leaf) {
    return Get-Item -LiteralPath $fallbackPath
  }

  throw "Missing local release file: $Name (tried $directPath and $fallbackPath)"
}

function Resolve-RemoteUrl {
  param(
    [string]$BaseUrl,
    [string]$FeedPath
  )
  $baseUri = [System.Uri]$BaseUrl
  return ([System.Uri]::new($baseUri, $FeedPath)).AbsoluteUri
}

function Test-RemoteHead {
  param(
    [string]$Url,
    [object]$ExpectedBytes
  )
  $response = Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec 30
  $contentLength = $response.Headers["Content-Length"]
  if ($null -ne $ExpectedBytes -and $contentLength) {
    $expected = [Int64]$ExpectedBytes
    $remoteBytes = [Int64]($contentLength | Select-Object -First 1)
    if ($remoteBytes -ne $expected) {
      throw "Size mismatch for $Url. remote=$remoteBytes local=$expected"
    }
  }
  return $response.StatusCode
}

$base = Normalize-FeedUrl $BaseUrl
$latestPath = Join-Path $ReleaseDir "latest.yml"
$latestFile = Test-LocalFile $latestPath "latest.yml"
$latestContent = Get-Content -LiteralPath $latestFile.FullName -Raw
$version = Get-MatchValue $latestContent "^version:\s*(.+?)\s*$" "version"
$installerPath = Get-MatchValue $latestContent "^path:\s*(.+?)\s*$" "path"

$versionedInstaller = Resolve-LocalReleaseFile $ReleaseDir $installerPath $installerPath
$blockmapPath = "$installerPath.blockmap"
$versionedBlockmap = Resolve-LocalReleaseFile $ReleaseDir $blockmapPath $blockmapPath
$fixedInstaller = Test-LocalFile (Join-Path $ReleaseDir $FixedInstallerName) $FixedInstallerName

$checks = @(
  @{ Name = "latest.yml"; Url = "$($base)latest.yml"; Method = "GET"; ExpectedBytes = $null },
  @{ Name = $installerPath; Url = (Resolve-RemoteUrl $base $installerPath); Method = "HEAD"; ExpectedBytes = [Int64]$versionedInstaller.Length },
  @{ Name = $blockmapPath; Url = (Resolve-RemoteUrl $base $blockmapPath); Method = "HEAD"; ExpectedBytes = [Int64]$versionedBlockmap.Length },
  @{ Name = $FixedInstallerName; Url = "$($base)$FixedInstallerName"; Method = "HEAD"; ExpectedBytes = [Int64]$fixedInstaller.Length }
)

$failures = New-Object System.Collections.Generic.List[string]

Write-Output "OpenXnet CDN update feed verification"
Write-Output "version=$version"
Write-Output "base=$base"

foreach ($check in $checks) {
  try {
    if ($check.Method -eq "GET") {
      $response = Invoke-WebRequest -Uri $check.Url -Method Get -TimeoutSec 30
      $remoteContent = if ($response.Content -is [byte[]]) {
        [System.Text.Encoding]::UTF8.GetString($response.Content)
      } else {
        [string]$response.Content
      }
      if ($remoteContent -notmatch [regex]::Escape("path: $installerPath")) {
        throw "Remote latest.yml does not point to $installerPath"
      }
      Write-Output "OK $($check.Name) status=$($response.StatusCode)"
    } else {
      $status = Test-RemoteHead $check.Url $check.ExpectedBytes
      Write-Output "OK $($check.Name) status=$status"
    }
  } catch {
    $message = "FAIL $($check.Name): $($_.Exception.Message)"
    $failures.Add($message) | Out-Null
    Write-Output $message
  }
}

if ($failures.Count -gt 0) {
  Write-Error "CDN update feed is incomplete. Upload latest.yml to $base, version assets to their feed paths, and $FixedInstallerName to $base"
  exit 1
}

Write-Output "CDN update feed is ready."
