param(
    [string[]]$Path = @(
        ".\release\OpenXnet-Setup-*-win-*.exe",
        ".\release\OpenXnet-Setup-win-*.exe",
        ".\release\win-unpacked\OpenXnet.exe"
    ),
    [switch]$Strict
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$files = New-Object System.Collections.Generic.List[System.IO.FileInfo]
$seen = New-Object System.Collections.Generic.HashSet[string]

foreach ($item in $Path) {
    $matches = Get-ChildItem -Path $item -File -ErrorAction SilentlyContinue
    foreach ($match in $matches) {
        if ($seen.Add($match.FullName)) {
            $files.Add($match)
        }
    }
}

if ($files.Count -eq 0) {
    throw "No files matched the signature check paths."
}

$results = foreach ($file in $files) {
    $signature = Get-AuthenticodeSignature -FilePath $file.FullName
    [pscustomobject]@{
        File = $file.FullName
        Status = $signature.Status
        Signer = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { "" }
        Issuer = if ($signature.SignerCertificate) { $signature.SignerCertificate.Issuer } else { "" }
        NotAfter = if ($signature.SignerCertificate) { $signature.SignerCertificate.NotAfter } else { $null }
    }
}

$results | Format-Table -AutoSize

$invalid = @($results | Where-Object { $_.Status -ne "Valid" })
if ($Strict -and $invalid.Count -gt 0) {
    throw "Signature check failed: $($invalid.Count) file(s) are not Valid."
}
