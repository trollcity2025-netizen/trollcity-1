# Troll City Mobile App - Base44 Specification

> Complete specification for building a native mobile app version of Troll City using Base44

---

## 📱 App Overview

**Troll City** is a comprehensive social media and entertainment platform that combines live streaming, social networking, virtual economy, family/clan systems, government simulation, and gamification elements. Think of it as a virtual city-state where users live, work, play, and govern together.

---

## 🔧 Technical Architecture

### Backend (Supabase)
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Authentication**: Email/password, OAuth providers
- **Storage**: File storage for media (avatars, images, videos)
- **Edge Functions**: Serverless functions for complex logic
- **Realtime**: Live updates for notifications, chat, streams

### Streaming (Agora)
- **WebRTC**: Real-time video/audio streaming
- **Categories**: General, Trollmers (subscriber streams), Gaming, Spiritual, Elections, etc.
- **Features**: Guest seats, viewer interaction, battle mode

### Real-time Messaging
- **Chat**: Public chat, family chat, direct messages
- **Notifications**: Push notifications, in-app alerts

---

## 👥 User Roles & Hierarchy

| Role | Description | Permissions |
|------|-------------|-------------|
| `user` | Regular citizen | Basic: browse, chat, watch streams, earn coins |
| `troll_officer` | Police force | Moderate: moderation, ticketing, some admin functions |
| `lead_troll_officer` | Police leadership | High: full moderation, officer management |
| `secretary` | Government admin | High: government functions, policy management |
| `president` | City leader | Supreme: all government powers |
| `pastor` | Religious leader | Spiritual content management |
| `admin` | System admin | Full platform control |

---

## 📋 Core Features & Pages

### 1. Authentication & Onboarding
- **Auth.tsx** - Login/signup with email, social login
- **ProfileSetup.tsx** - New user onboarding (avatar, username, bio)
- **PasswordReset.tsx** - Account recovery
- **TermsAgreement.tsx** - Legal acceptance

### 2. Profile & Identity
- **Profile.tsx** - User profile with posts, followers, following
- **AvatarCustomizer.tsx** - Avatar customization (items, accessories)
- **ProfileSettings.tsx** - Account settings, privacy, notifications
- **TrollIdentityLab.tsx** - Identity verification (AI verification)
- **VerificationPage.tsx** - Verification status/badges
- **BadgesPage.tsx** - Achievement badges display
- **Leaderboard.tsx** - Top users, families, content

### 3. Social Feed
- **TrollCityWall.tsx** - Main social feed (posts, images, videos)
- **Trollifications.tsx** - Content feed with reactions
- **ExploreFeed.tsx** - Discover new content/users
- **Following.tsx** - Feed from followed users
- **WallPostPage.tsx** - Individual post view with comments

### 4. Live Broadcasting (Key Feature)
- **LivePage.tsx** - Browse live streams
- **broadcast/SetupPage.tsx** - Start a broadcast (admin/lead_officer only)
- **broadcast/Call.tsx** - Active stream viewer with chat
- **Features**: Multiple categories, guest seats, battles, reactions

### 5. Families (Clans)
- **FamilyBrowse.tsx** - Discover families
- **FamilyProfilePage.tsx** - Family details
- **FamilyLounge.tsx** - Family member chat and activity
- **FamilyLeaderboard.tsx** - Family rankings
- **FamilyChatPage.tsx** - Family group chat
- **FamilyShop.tsx** - Family item store
- **FamilyWarsHub.tsx** - Family vs family competitions
- **FamilyApplication.tsx** - Apply to join a family

### 6. Government System
- **President.tsx** - President dashboard and policies
- **CityHall.tsx** - City government information
- **SecretaryConsole.tsx** - Secretary admin panel
- **OfficerVote.tsx** - Officer elections/voting
- **OfficerApplication.tsx** - Apply for officer positions
- **LeadOfficerApplication.tsx** - Apply for lead officer
- **PolicyCenter.tsx** - View and manage policies

### 7. Troll Officers (Police)
- **TrollOfficerLounge.tsx** - Officer dashboard
- **OfficerModeration.tsx** - Content/user moderation
- **OfficerScheduling.tsx** - Duty scheduling
- **OfficerOWCDashboard.tsx** - Officer work credits
- **JailPage.tsx** - View jailed users
- **JailVisitRoom.tsx** - Visit users in jail

### 8. Court System
- **TrollCourt.tsx** - Court cases and trials
- **CourtRoom.tsx** - Active courtroom proceedings
- **TrollCourtSession.tsx** - Court session viewer
- **FoundingOfficerTrial.tsx** - Special trials
- **InterviewRoom.tsx** - Pre-trial interviews

### 9. Economy & Commerce
- **TrollBank.tsx** - Banking (deposits, withdrawals, loans)
- **CoinStore.jsx** - Buy Troll Coins (premium currency)
- **CoinsComplete.tsx** - Coin purchase completion
- **Wallet.tsx** - View balance and transactions
- **ShopView.tsx** - Browse marketplace
- **SellOnTrollCity.tsx** - Seller dashboard
- **MyOrders.tsx** - Purchase orders
- **SellerOrders.tsx** - Seller order management
- **ActiveAssetsPage.tsx** - Owned digital assets

### 10. Real Estate & Vehicles
- **TrollsTownPage.tsx** - Virtual property browser
- **LivingPage.tsx** - Property management
- **CarDealership.tsx** - Vehicle purchases
- **RealEstateOffice.tsx** - Property transactions

### 11. Entertainment & Games
- **TrollGamesPage.tsx** - Mini-games
- **Trollifieds.tsx** - Short-form video content (TikTok-style)
- **Troting.tsx** - Video/music feed
- **PublicPool.tsx** - Public event space

### 12. Church & Religion
- **ChurchPage.tsx** - Religious content and services
- **PastorApplication.tsx** - Apply to become pastor

### 13. Talents & Creators
- **MaiTalentPage.tsx** - Talent show/competition
- **MaiTalentStage.tsx** - Live talent performances
- **MaiTalentTraining.tsx** - Talent skill training
- **MaiTalentTop10.tsx** - Top talents leaderboard
- **CreatorApplication.tsx** - Apply for creator program
- **CreatorDashboard.tsx** - Creator tools and analytics
- **CreatorOnboarding.tsx** - New creator setup

### 14. Empire Program
- **EmpirePartnerApply.tsx** - Apply for partner program
- **EmpirePartnerDashboard.tsx** - Partner management
- **CreatorSwitchProgram.tsx** - Switch between creator/partner

### 15. Earnings & Payouts
- **EarningsDashboard.tsx** - Earnings overview
- **EarningsPage.jsx** - Detailed earnings
- **EarningsPayout.tsx** - Request payouts
- **PayoutRequest.tsx** - Payout history
- **CashoutPage.tsx** - Cash out earnings
- **Cashouts.tsx** - Cashout history
- **MyEarnings.tsx** - Personal earnings view

### 16. Giveaways & Events
- **GiveawaysPage.tsx** - Active giveaways
- **UniverseEventPage.tsx** - Special events

### 17. Support & Help
- **Support.tsx** - Help center
- **ReportDetailsPage.tsx** - Report submission/status
- **Safety.tsx** - Safety resources

### 18. Taxes & Compliance
- **TaxOnboarding.tsx** - Tax setup for creators
- **TaxUpload.tsx** - Document upload
- **PaymentSettings.tsx** - Payment configuration

### 19. Daily Rewards & Login
- **Daily login wall** - Reward system for daily logins
- **Weekly rewards** - Bonus weekly rewards

### 20. Inventory & Items
- **UserInventory.tsx** - Virtual item inventory
- **GiftInventoryPage.jsx** - Gift items
- **GiftStorePage.jsx** - Gift purchase store
- **GiftCardsPage.tsx** - Gift card system

---

## 🗄️ Database Schema (Key Tables)

### Users & Profiles
- `profiles` - User profiles (id, username, avatar_url, role, bio, follower_count, etc.)
- `users` - Auth users (managed by Supabase)

### Social
- `posts` - Wall posts
- `comments` - Post comments
- `follows` - Follow relationships
- `reactions` - Post reactions

### Broadcasting
- `streams` - Live stream records
- `stream_viewers` - Viewer tracking
- `stream_guests` - Guest seat management
- `stream_messages` - Stream chat

### Families
- `families` - Family/clan records
- `family_members` - Family membership
- `family_chat_messages` - Family chat

### Economy
- `wallets` - User wallet balances
- `transactions` - Transaction history
- `orders` - Marketplace orders
- `products` - Marketplace products
- `assets` - Digital assets ownership

### Government
- `policies` - Government policies
- `elections` - Election records
- `votes` - Vote records
- `officer_schedule` - Officer duty schedule

### Court
- `court_cases` - Court case records
- `court_sessions` - Court session details
- `evidence` - Case evidence
- `verdicts` - Case verdicts

### Content
- `trollifications` - Short video content
- `reels` - Reels/video posts
- `talent_shows` - Talent competition entries

---

## 🎨 Design System

### Color Palette
- **Primary**: Purple (#8B5CF6)
- **Secondary**: Cyan (#06B6D4)
- **Accent**: Pink (#EC4899)
- **Background**: Dark slate (#0F172A)
- **Surface**: Slate (#1E293B)
- **Text Primary**: White
- **Text Secondary**: Gray (#94A3B8)
- **Success**: Green (#10B981)
- **Warning**: Yellow (#F59E0B)
- **Error**: Red (#EF4444)

### UI Framework
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Radix UI** for accessible components
- **Sonner** for toast notifications

---

## 🔌 API Integrations Required

1. **Supabase** - Backend database, auth, storage, realtime
2. **Agora** - WebRTC streaming
3. **Stripe/CashApp** - Payment processing (US-only features)
4. **AI Verification** - Identity verification service

---

## 📱 Mobile App Considerations

### Push Notifications
- Stream start alerts
- New followers
- Chat messages
- Court case updates
- Government announcements
- Family activity

### Camera & Media
- Live streaming capabilities
- Photo/video capture for posts
- Avatar photo upload

### Offline Support
- Cache recent feed posts
- Offline message queue

### Permissions Required
- Camera
- Microphone
- Photo library
- Notifications

---

## 📝 Implementation Notes

1. **Role-based access control** - Many features require specific roles
2. **Age restrictions** - Some content requires age verification
3. **Location** - Real estate based on virtual "districts"
4. **Real-time** - Heavy use of Supabase realtime for chat/notifications
5. **Monetization** - Troll Coins, subscriptions, creator payouts

---

## 🚀 Quick Start for Base44

1. **Import Supabase schema** - Use the existing PostgreSQL database
2. **Set up Agora** - Configure WebRTC streaming
3. **Build authentication** - Supabase Auth integration
4. **Implement role system** - Match existing role hierarchy
5. **Build pages** - Start with core features (feed, profile, streams)
6. **Add payments** - Troll Coins, payouts (if US-only)
7. **Test thoroughly** - Government features, court system are complex

---

## 📞 Key Contact Points

- **Broadcast System**: See `BROADCAST_SYSTEM_COMPLETE_FIXES.sql`
- **Coin System**: See `COIN_SYSTEM_ARCHITECTURE.md`
- **Court System**: See `create_court_tables.sql`
- **Family System**: See `create_tromody_tables.sql`
- **Level System**: See `create_level_system.sql`

---

*Generated for Base44 app conversion - Last updated: February 2026*
