$Base = "https://wcstat.orangecloud.vn"
$fail = 0

function Test-Url {
  param([string]$Name, [string]$Url, [int[]]$ExpectStatus = @(200), [scriptblock]$Assert = $null)
  try {
    $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -MaximumRedirection 5
    $ok = $ExpectStatus -contains $r.StatusCode
    if (-not $ok) {
      Write-Output "FAIL $Name -> $($r.StatusCode) (expected $($ExpectStatus -join ','))"
      $script:fail++
      return $null
    }
    if ($Assert) {
      & $Assert $r
    }
    Write-Output "OK   $Name -> $($r.StatusCode)"
    return $r
  } catch {
    Write-Output "FAIL $Name -> $($_.Exception.Message)"
    $script:fail++
    return $null
  }
}

Write-Output "=== Core APIs ==="
$homeResp = Test-Url "GET /api/home" "$Base/api/home" -Assert {
  param($r)
  $j = $r.Content | ConvertFrom-Json
  if (-not $j.data.dashboard) { throw "missing dashboard" }
  if (-not $j.data.schedule.matches) { throw "missing schedule" }
  if ($j.data.schedule.matches.Count -ne 104) { throw "expected 104 matches, got $($j.data.schedule.matches.Count)" }
}
$matchId = $null
if ($homeResp) {
  $hj = $homeResp.Content | ConvertFrom-Json
  $matchId = $hj.data.dashboard.featuredMatch.id
  if (-not $matchId) {
    $matchId = $hj.data.schedule.matches[0].id
  }
}

Test-Url "GET /api/health" "$Base/api/health"
Test-Url "GET /api/schedule" "$Base/api/schedule" -Assert {
  param($r)
  $j = $r.Content | ConvertFrom-Json
  if ($j.data.total -ne 104) { throw "schedule total $($j.data.total)" }
}
Test-Url "GET /api/dashboard" "$Base/api/dashboard"
Test-Url "GET /api/news" "$Base/api/news?page=1&pageSize=8&hot=3" -Assert {
  param($r)
  $j = $r.Content | ConvertFrom-Json
  if ($j.data.hot.Count -gt 3) { throw "hot count $($j.data.hot.Count)" }
}

if ($matchId) {
  Write-Output "`n=== Match $matchId ==="
  Test-Url "GET match" "$Base/api/matches/$matchId"
  Test-Url "GET probability" "$Base/api/matches/$matchId/probability"
  Test-Url "GET history" "$Base/api/matches/$matchId/history"
  Test-Url "GET preview" "$Base/api/matches/$matchId/preview"
  Test-Url "GET hints" "$Base/api/matches/$matchId/hints"
  Test-Url "SPA match page" "$Base/matches/$matchId"
  Test-Url "SPA analysis page" "$Base/matches/$matchId/analysis"
} else {
  Write-Output "WARN no matchId for match tests"
  $fail++
}

Write-Output "`n=== Discovery ==="
Test-Url "homepage Link" "$Base/" -Assert {
  param($r)
  if (-not $r.Headers['Link']) { throw "missing Link header" }
}
Test-Url "robots.txt" "$Base/robots.txt"
Test-Url "sitemap.xml" "$Base/sitemap.xml"
Test-Url "api-catalog" "$Base/.well-known/api-catalog"
Test-Url "oauth-protected-resource" "$Base/.well-known/oauth-protected-resource"
Test-Url "oauth-authorization-server" "$Base/.well-known/oauth-authorization-server"
Test-Url "auth.md" "$Base/auth.md"

Write-Output "`n=== Static ==="
Test-Url "favicon" "$Base/favicon-32x32.png"
Test-Url "SPA home" "$Base/"

if ($fail -gt 0) {
  Write-Output "`n$fail check(s) FAILED"
  exit 1
}
Write-Output "`nAll smoke checks passed"
