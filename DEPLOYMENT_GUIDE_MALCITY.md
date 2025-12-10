# 🚀 DEPLOYMENT GUIDEITROL - Maitrollcity **BUILD COMPLETE.com

## ✅ - READY FOR###:**
- **Production Build Summary DEPLOYMENT**

 Time**: 31.06 seconds
- **Total Size **Build**: 799.56 kB (main bundle)
- **Shop Pages Included**:
  - ✅ `ShopPartnerPage-DOHyeNrH.js` (13.59 kB, gzipped: 2.  - ✅ `37 kB)
ShopDashboard-DOrJ3qY21.24 kb.js` (B, gzipped: 2.59 kB)
- **All Assets Optimized**: CSS, JS, and images minified and compressed

## 📁 **DEPLOYMENT FILES LOCATION:**
```
/dist/ directory contains all production-ready files:
├── index.html (0.63 kB)
├── assets/
│   ├── ShopPartnerPage-DOH ✅
│   ├── ShopDashboard-DOrJ3qYb.js ✅yeNrH.js
│   ├── CreatorDashboard-BQH-RiGS.js ✅
│   └── [all other optimized assets]
└── [static files]
```

## 🌐 **DEPLOYMENT OPTIONS FOR MAITROL### **Option 1: Static Hosting (Recommended)**
**PlatformLCITY.COM:**

s**: Netlify, Vercel, Cloudflare Pages, GitHub Pages

**Steps:**
1. **Upload `/dist` your hosting platform
2. **Set build command**: None needed folder contents** to (pre-built)
3.**: `/dist` 
4. **Environment Variables**: Set in hosting platform **Set publish directory dashboard
5. **Custom Domain**: Pointrollcity.com to hosting platform

**Netlify Example:**
```bash
# Drag & mait drop thedist folder to Netlify
# Or use Net /lify CLI:
npm install -g netlify-cli
netlify deploy --prod --dir=distOption 2: Traditional Web Server
```

### ****Servers**: Apache, Nginx**
, IIS

**Steps1. **Copy:**
dist` contents** to web server root **Configure server** for SPA routing ( `/ directory
2.see config below)
3. **Set environment variables** in server config
4. **Enable gzip compression** for optimal performance

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server.com;
    root /var/www/maitrollcity.com;
    index index.html_name maitrollcity;

    # Enable gzip compression
    gzip on;
    gzip_types text/css application/javascript application/json;

    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    **Option 3: CDN Deployment }
}
```

###**
**Services**: AWS CloudFront, Azure, Google Cloud CDN

**Steps:**
1. **Upload to CDN static CDN** as
2. **Configure custom** mait website hosting3. **Set up SSL certificate** (Let's Encrypt orrollcity.com
 domain cloud provider)
4. **Configure caching rules** for optimal performance

## 🔧 **REQUIRED ENVIRONMENT VARIABLES:**

Set these in your hosting platform or server:

```bash
# Supabase Configuration (REQUIRED)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional: Admin Configuration
VITE_ADMIN_EMAIL=trollcity2025@gmail.com

# Optional: Feature Flags
VITE_ENABLE_SHOPIFY_INTEGRATION=true
```

## 🗄️ **DATABASE SETUP (Supabase):**

### **Required Tables for Shop Feature:**
```sql
-- Run these in Supabase SQL Editor

-- 1. Shop partners table
CREATE TABLE shop_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_domain TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'disconnected')),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created NOW(),
  updated TIME ZONE DEFAULT TIME ZONE DEFAULT NOW()
);

-- 2. Shop orders table
CREATE_at TIMESTAMP WITH  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
_at TIMESTAMP WITH TABLE shop_orders (
  shopify_order_id TEXT NOT NULL TEXT NOT NULL,
,
  total_usd DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT ',
  product_namestatus IN ('pending', 'paid', 'cancelled')),
  created_at TIMESTAMP WITH TIME Zpending' CHECK (  customer_name TEXTONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
. Shop payouts table
CREATE TABLE shop_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_id UUID REFERENCES auth);

-- 3 DELETE CASCADE,
  amount_usd DECIMAL(10_uuid(),
  seller.users(id) ON NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending',,2) NOT 'completed', ' TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Levelfailed')),
  method Security)
ALTER TABLE shop_partners ENABLE ROW LEVEL SECURITY;
 ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_payouts ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view own shop partner data" ON shop_partners
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own shop orders" ON shop_orders
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Users can view own shopALTER TABLE shop_orders_payouts
 payouts" ON shop (auth.uid() = seller_id);
```

## 🔗 **BACKEND ENDPOINTS TO IMPLEMENT:**

Create these API endpoints for full shop functionality:

```javascript
// /api/shopify/connect - OAuth initiation
app.get('/api/shopify/connect', (req, res) => {
  // Redirect to Shopify OAuth
});

// /api/shopify/callback - OAuth callback  
app.get('/api/shopify/callback', (req, res)  FOR SELECT USING => {
  // Handle Shopify OAuth response
});

// /api/shopify/webhook - Order webhooks
app.post('/api/shopify/webhook', (req, res) => {
  // Process Shopify order webhooks
});
```

## ✅ **DEPLOYMENT CHECKLIST:**

### **Pre-Deployment:**
- [x] Production- [x] Shop pages build completed successfully
ShopPartnerPage`, included in build (`- [x] All assets optimized and minified
- `ShopDashboard`)
 [x] Environment variables prepared
- [x] Database schema ready

### **During Deployment:**
- [ ] Upload `/dist` folder contents
- [ ] Configure environment variables
- [ ] Set up SSL certificate
- [ ] Configure custom domain (maitrollcity.com)
- [ ] Test basic functionality

### **Post-Deployment:**
- [ ] Verify shop pages load: `/shop/partner`, `/shop/dashboard`
- [ ] Test user ] Test database connections
- [ ] Verify all routes work correctly
- [ ] Check mobile responsiveness

## 🎯 **NEW SHOP FEATURES LIVE:**

Once deployed, users can access:
- **`/shop/partner`** - Connect Shopify stores with Troll City
- **`/shop/dashboard`** - View earnings, orders, and payouts
- **12 authentication
- [% Platform Fee** - Clearly displayed throughout
- **Real-time Analytics** - Sales tracking and earnings breakdown

## 📞 **SUPPORT:**

If you need help with deployment:
1. **Check hosting platform documentation**
2. **Verify environment variables are set**
3. **Test database connections**
4. **Ensure SSL certificate is valid**

**Ready for immediate deployment to maitrollcity.com! 🚀**