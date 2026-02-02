#!/bin/bash

# ===================================================
# EDGE FUNCTIONS DEPLOYMENT SCRIPT
# ===================================================
# TrollCity2 - Deploy all edge functions to Supabase
# Date: 2025-12-09
# ===================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    print_error "Supabase CLI is not installed. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Check if user is logged in to Supabase
if ! supabase projects list &> /dev/null; then
    print_error "Not logged in to Supabase. Please run:"
    echo "supabase login"
    exit 1
fi

print_status "Starting edge functions deployment for TrollCity2..."

# Define arrays of functions to deploy
PAYPAL_FUNCTIONS=(
    "paypal-create-order"
    "paypal-complete-order"
    "paypal-capture-order"
    "paypal-payout-process"
    "paypal-payout-request"
    "paypal-verify-transaction"
)

OFFICER_FUNCTIONS=(
    "officer-actions"
    "officer-auto-clockout"
    "officer-get-assignment"
    "officer-join-stream"
    "officer-leave-stream"
    "officer-report-abuse"
    "officer-touch-activity"
)

VERIFICATION_FUNCTIONS=(
    "verify-user-complete"
    "verify-user-paypal"
)

SYSTEM_FUNCTIONS=(
    "toggle-ghost-mode"
    "shadow-ban-user"
    "submit-training-response"
)

UTILITY_FUNCTIONS=(
    "adminScheduler"
    "moderation"
    "mux-create-stream"
    "payouts"
    "platform-fees"
    "sendEmail"
    "streams-maintenance"
    "troll-battle"
    "battles"
    "troll-events"
    "ping"
)

# Function to deploy a single function
deploy_function() {
    local func_name=$1
    local category=$2
    
    print_status "Deploying $category function: $func_name"
    
    if supabase functions deploy "$func_name" --no-verify-jwt; then
        print_success "✓ $func_name deployed successfully"
    else
        print_error "✗ Failed to deploy $func_name"
        return 1
    fi
}

# Function to deploy a category of functions
deploy_category() {
    local category_name=$1
    shift
    local functions=("$@")
    
    print_status "Deploying $category_name functions..."
    
    local success_count=0
    local total_count=${#functions[@]}
    
    for func in "${functions[@]}"; do
        if deploy_function "$func" "$category_name"; then
            ((success_count++))
        fi
    done
    
    print_status "Category '$category_name': $success_count/$total_count functions deployed"
    
    if [ $success_count -eq $total_count ]; then
        print_success "All $category_name functions deployed successfully!"
        return 0
    else
        print_warning "$total_count - $success_count = $((total_count - success_count)) functions failed to deploy"
        return 1
    fi
}

# Deploy all categories
total_success=0
total_functions=0

# PayPal Functions
print_status "=== DEPLOYING PAYPAL FUNCTIONS ==="
deploy_category "PayPal" "${PAYPAL_FUNCTIONS[@]}"
paypal_success=$?
((total_functions += ${#PAYPAL_FUNCTIONS[@]}))
if [ $paypal_success -eq 0 ]; then
    ((total_success += ${#PAYPAL_FUNCTIONS[@]}))
fi

echo ""

# Officer Functions
print_status "=== DEPLOYING OFFICER FUNCTIONS ==="
deploy_category "Officer" "${OFFICER_FUNCTIONS[@]}"
officer_success=$?
((total_functions += ${#OFFICER_FUNCTIONS[@]}))
if [ $officer_success -eq 0 ]; then
    ((total_success += ${#OFFICER_FUNCTIONS[@]}))
fi

echo ""

# LiveKit Functions
print_status "=== DEPLOYING LIVEKIT FUNCTIONS ==="
deploy_category "LiveKit" "${LIVEKIT_FUNCTIONS[@]}"
livekit_success=$?
((total_functions += ${#LIVEKIT_FUNCTIONS[@]}))
if [ $livekit_success -eq 0 ]; then
    ((total_success += ${#LIVEKIT_FUNCTIONS[@]}))
fi

echo ""

# Verification Functions
print_status "=== DEPLOYING VERIFICATION FUNCTIONS ==="
deploy_category "Verification" "${VERIFICATION_FUNCTIONS[@]}"
verification_success=$?
((total_functions += ${#VERIFICATION_FUNCTIONS[@]}))
if [ $verification_success -eq 0 ]; then
    ((total_success += ${#VERIFICATION_FUNCTIONS[@]}))
fi

echo ""

# System Functions
print_status "=== DEPLOYING SYSTEM FUNCTIONS ==="
deploy_category "System" "${SYSTEM_FUNCTIONS[@]}"
system_success=$?
((total_functions += ${#SYSTEM_FUNCTIONS[@]}))
if [ $system_success -eq 0 ]; then
    ((total_success += ${#SYSTEM_FUNCTIONS[@]}))
fi

echo ""

# Utility Functions
print_status "=== DEPLOYING UTILITY FUNCTIONS ==="
deploy_category "Utility" "${UTILITY_FUNCTIONS[@]}"
utility_success=$?
((total_functions += ${#UTILITY_FUNCTIONS[@]}))
if [ $utility_success -eq 0 ]; then
    ((total_success += ${#UTILITY_FUNCTIONS[@]}))
fi

echo ""

# Final Summary
print_status "=== DEPLOYMENT SUMMARY ==="
print_status "Total functions attempted: $total_functions"
print_status "Successfully deployed: $total_success"
print_status "Failed deployments: $((total_functions - total_success))"

if [ $total_success -eq $total_functions ]; then
    print_success "🎉 ALL EDGE FUNCTIONS DEPLOYED SUCCESSFULLY!"
    print_success "Your TrollCity2 application is ready for production!"
else
    print_warning "⚠️ Some functions failed to deploy. Please check the errors above."
    print_warning "You can manually deploy failed functions using:"
    echo "supabase functions deploy <function-name> --no-verify-jwt"
fi

# Display deployment status
echo ""
print_status "=== NEXT STEPS ==="
print_status "1. Set environment variables for edge functions:"
echo "   - PAYPAL_CLIENT_ID"
echo "   - PAYPAL_CLIENT_SECRET" 
echo "   - PAYPAL_ENVIRONMENT (sandbox or production)"
echo "   - OPENAI_API_KEY (for AI verification)"
echo "   - OBSERVER_AI_URL (optional)"
echo ""
print_status "2. Test the deployed functions:"
echo "   - Test PayPal payment flow"
echo "   - Test officer system functions"
echo "   - Test verification functions"
echo ""
print_status "3. Set up cron jobs (optional):"
echo "   - officer-auto-clockout (every 5 minutes)"
echo "   - ai-detect-ghost-inactivity (every 10 minutes)"
echo ""

print_status "Edge functions deployment completed!"