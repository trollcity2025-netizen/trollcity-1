# PowerShell script to deploy all Supabase Edge Functions
$functions = @(
    "payments",
    "charge-stored-card",
    "admin",
    "admin-reset",
    "battles",
    "moderation",
    "troll-events",
    "wheel",
    "livekit-token",
    "create-square-checkout",
    "verify-square-payment",
    "square-webhook",
    "process-referral-bonuses",
    "auto-clock-out",
    "streams-maintenance",
    "payments-status",
    "sendEmail",
    "add-card",
    "create-square-customer",
    "livekit-webhooks",
    "payouts",
    "platform-fees",
    "rtmp-relay",
    "square",
    "square-save-card",
    "spin-wheel",
    "wheel-spin",
    "wheel-spins-left",
    "auth",
    "live",
    "calc_post_earnings",
    "adminScheduler",
    "troll-battle",
    "mux-create-stream"
)

Write-Host "🚀 Deploying all Supabase Edge Functions..." -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failCount = 0
$failedFunctions = @()

foreach ($func in $functions) {
    Write-Host "📦 Deploying: $func" -ForegroundColor Yellow
    $output = npx supabase functions deploy $func --yes 2>&1
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host "✅ Successfully deployed: $func" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "❌ Failed to deploy: $func" -ForegroundColor Red
        $failCount++
        $failedFunctions += $func
    }
    Write-Host ""
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📊 Deployment Summary:" -ForegroundColor Cyan
Write-Host "  ✅ Successful: $successCount" -ForegroundColor Green
Write-Host "  ❌ Failed: $failCount" -ForegroundColor Red

if ($failedFunctions.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed functions:" -ForegroundColor Red
    foreach ($func in $failedFunctions) {
        Write-Host "  - $func" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✨ Deployment complete!" -ForegroundColor Cyan
