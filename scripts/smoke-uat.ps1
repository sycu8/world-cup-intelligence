param([string]$Base = "https://wc-tactical-uat.sycu-lee.workers.dev")
$fail = 0

function Test-Url {
  param([string]$Name, [string]$Url, [int[]]$ExpectStatus = @(200), [scriptblock]$Assert = $null)
  try {
    $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -MaximumRedirection 5
    $ok = $ExpectStatus -contains $r.StatusCode
    if (-not $ok) {
      Write-Output "FAIL $Name -> $($r.StatusCode)"
      $script:fail++
      return $null
    }
    if ($Assert) { & $Assert $r }
    Write-Output "OK   $Name -> $($r.StatusCode)"
    return $r
  } catch {
    Write-Output "FAIL $Name -> $($_.Exception.Message)"
    $script:fail++
    return $null
  }
}

Write-Output "=== UAT smoke: $Base ==="

$h = Test-Url "health" "$Base/api/health"
if ($h) {
  $j = $h.Content | ConvertFrom-Json
  if ($j.environment -ne "uat") {
    Write-Output "FAIL health environment -> $($j.environment) (expected uat)"
    $script:fail++
  }
}

Test-Url "home" "$Base/"
$sm = Test-Url "sitemap" "$Base/sitemap.xml"
if ($sm -and $sm.Content -notmatch "lich-thi-dau-world-cup-2026") {
  Write-Output "FAIL sitemap missing SEO path"
  $script:fail++
}
Test-Url "seo-schedule" "$Base/lich-thi-dau-world-cup-2026"
Test-Url "matches-api" "$Base/api/schedule"

if ($fail -gt 0) { exit 1 }
Write-Output "All UAT smoke checks passed."
