#!/usr/bin/env pwsh
# Deploy send-push-notification edge function

Write-Host "Deploying send-push-notification edge function..." -ForegroundColor Cyan

try {
    $result = supabase functions deploy send-push-notification --no-verify-jwt 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Successfully deployed send-push-notification function!" -ForegroundColor Green
    } else {
        Write-Host "❌ Deployment failed with exit code $LASTEXITCODE" -ForegroundColor Red
        Write-Host $result
        exit 1
    }
} catch {
    Write-Host "❌ Error during deployment: $_" -ForegroundColor Red
    exit 1
}
