# 🎮 Troll City - Broadcasting App

A production-ready broadcasting application with a troll-themed twist! Built with React, TypeScript, Supabase, and Agora for real-time streaming.

## 🌟 Features

- **Live Streaming**: Broadcast and view streams using Agora Web SDK
- **Troll Theme**: Deep purple, neon green, and gold styling throughout
- **Coin System**: Virtual currency for gifts, purchases, and games
- **Insurance**: Protect yourself from kicks and bans
- **Cashouts**: Convert earned coins to real money via Square
- **Admin Dashboard**: Moderation tools for admins and moderators
- **Real-time Chat**: Supabase realtime for instant messaging
- **Square Payments**: Secure payment processing (no PayPal!)

## 🚀 Tech Stack

### Frontend
- React 18 + TypeScript
- Vite for fast development
- Tailwind CSS for styling
- Zustand for state management
- React Router for navigation
- Lucide React for icons

### Backend & Services
- Supabase (Auth, Database, Realtime)
- Agora Web SDK for streaming
- Square for payments
- Node.js + Express API

### Database
- PostgreSQL via Supabase
- Realtime subscriptions

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Agora account and App ID
- Square Developer account
- Vercel account (for deployment)

## 🔧 Environment Setup

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Set up your environment variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# LiveKit Configuration
VITE_LIVEKIT_APP_ID=your_livekit_app_id
VITE_BACKEND_TOKEN_SERVER_URL=http://localhost:3001/api/livekit-token

# Square Configuration
VITE_SQUARE_APPLICATION_ID=your_square_application_id
VITE_SQUARE_LOCATION_ID=your_square_location_id
VITE_SQUARE_ENVIRONMENT=sandbox

# Backend Configuration
SQUARE_ACCESS_TOKEN=your_square_access_token
SQUARE_ENVIRONMENT=sandbox
```

## 🏗️ Database Setup

1. Create a new Supabase project
2. Apply the migration files in the `supabase/migrations` directory
3. Set up Row Level Security policies (included in migrations)

## 🚀 Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

This will start both the frontend and backend servers:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## 📦 Building for Production

1. Build the application:
```bash
npm run build
```

2. Preview the production build:
```bash
npm run preview
```

## 🚀 Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy!

## 🎨 Troll City Theme

The app uses a distinctive troll-themed color scheme:
- **Primary**: Deep purple (#2e1065 to #8b5cf6)
- **Secondary**: Neon green (#00ff41 to #22c55e)
- **Accent**: Gold (#ffd700 to #fbbf24)

## 💰 Coin System

### Coin Packages
- Baby Troll: 500 coins for $6.49
- Little Troller: 1,440 coins for $12.99
- Mischief Pack: 3,280 coins for $19.99
- Troll Family Pack: 7,700 coins for $49.99
- Troll Empire Pack: 25,400 coins for $139.99
- Mega Troll King Pack: 51,800 coins for $279.99

## 🔐 User Roles

- **User**: Standard users who can stream, chat, and purchase coins
- **Moderator**: Can kick/ban users and moderate content
- **Admin**: Full access to admin dashboard and all features

## 📱 API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login

### Payments (Square)
- `POST /api/payments/create-payment` - Create payment
- `POST /api/payments/webhook` - Square webhook handler

### Streaming (LiveKit)
- `POST /api/livekit/token` - Generate LiveKit token

## 🧪 Testing

Run the TypeScript type checker:
```bash
npm run check
```

Run ESLint:
```bash
npm run lint
```

---

**Happy Trolling! 🎮👑**
"# Test change for git push demonstration"  
