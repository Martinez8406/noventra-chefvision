# Zwalnia porty dev ChefVision (3000 Vite, 3001 fallback, 3002 API)
$ports = 3000, 3001, 3002
$killed = @()

foreach ($port in $ports) {
  $connections = netstat -ano | Select-String ":$port\s" | Select-String 'LISTENING'
  foreach ($line in $connections) {
    $parts = ($line -replace '\s+', ' ').Trim().Split(' ')
    $processId = $parts[-1]
    if ($processId -match '^\d+$' -and $processId -ne '0' -and $killed -notcontains $processId) {
      try {
        Stop-Process -Id ([int]$processId) -Force -ErrorAction Stop
        $killed += $processId
        Write-Host "[kill-dev-ports] Port $port -> zatrzymano PID $processId"
      } catch {
        Write-Host "[kill-dev-ports] Port $port -> nie udalo sie zatrzymac PID $processId"
      }
    }
  }
}

if ($killed.Count -eq 0) {
  Write-Host '[kill-dev-ports] Porty 3000-3002 sa wolne.'
} else {
  Write-Host "[kill-dev-ports] Gotowe. Zatrzymano procesow: $($killed.Count)"
}
