# Admin Dashboard PayPal Update Instructions

## Replace Square with PayPal

### In `src/pages/admin/AdminDashboard.tsx`:

1. **Remove Square test function** (around line 918):
```typescript
// DELETE this entire function:
const testSquare = async () => {
  // ... entire function
}
```

2. **Remove squareStatus state** (around line 164):
```typescript
// DELETE:
const [squareStatus, setSquareStatus] = useState<any | null>(null)
```

3. **Replace case 'square'** (around line 1819):
```typescript
// REPLACE:
case 'square':
  return <SquarePanel />

// WITH:
case 'paypal':
  return <PayPalTestPanel />
```

4. **Remove Square test buttons** in the UI (search for "Test Square" buttons and remove them)

5. **Update tab label** if there's a tab button for 'square' - change to 'paypal' and label to "PayPal"

## Result

Admin Dashboard will show:
- PayPal Live Status panel instead of Square
- PayPal test button that calls `paypal-test-live` edge function
- No Square references remaining

