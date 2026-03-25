param(
  [int]$Port = 4173,
  [string]$Root = "e:\trollcity-1\dist"
)

$ErrorActionPreference = 'Stop'

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".gif" = "image/gif"
  ".ico" = "image/x-icon"
  ".woff" = "font/woff"
  ".woff2" = "font/woff2"
  ".txt" = "text/plain; charset=utf-8"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
}

function Get-TargetPath([string]$requestPath) {
  $relative = [System.Uri]::UnescapeDataString(($requestPath -replace '^\/*', ''))
  if ([string]::IsNullOrWhiteSpace($relative)) {
    return Join-Path $Root 'index.html'
  }

  $candidate = Join-Path $Root $relative
  if (Test-Path -LiteralPath $candidate -PathType Leaf) {
    return $candidate
  }

  return Join-Path $Root 'index.html'
}

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
    $response = $context.Response
    $targetPath = Get-TargetPath $context.Request.Url.AbsolutePath

    if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
      $response.StatusCode = 404
      $buffer = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
      $response.OutputStream.Write($buffer, 0, $buffer.Length)
      $response.Close()
      continue
    }

    $ext = [System.IO.Path]::GetExtension($targetPath).ToLowerInvariant()
    $response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }

    $bytes = [System.IO.File]::ReadAllBytes($targetPath)
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
    $response.Close()
  } catch {
    try {
      if ($response) { $response.Close() }
    } catch {}
  }
}
