# Troll City - System Requirements Specification

## Overview
Troll City is a **web-based social streaming platform** that runs in modern web browsers. It's not a downloadable desktop game - users access it via a web browser at trollcity.com (or your deployed URL).

---

## For End Users (Client Requirements)

### Minimum Requirements (Basic Features)
| Component | Requirement |
|-----------|-------------|
| **Browser** | Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ |
| **Operating System** | Windows 10+, macOS 11+, iOS 14+, Android 10+ |
| **RAM** | 4 GB |
| **CPU** | Dual-core 2.0 GHz |
| **Internet** | 10 Mbps stable connection |
| **Storage** | 500 MB free (browser cache) |

### Recommended Requirements (Full Experience)
| Component | Requirement |
|-----------|-------------|
| **Browser** | Chrome 115+ (latest) |
| **Operating System** | Windows 11, macOS 13+ |
| **RAM** | 8 GB |
| **CPU** | Quad-core 3.0 GHz+ |
| **Internet** | 25 Mbps+ (for HD streaming) |
| **GPU** | Integrated Intel UHD 620 or better |

### For 3D City Features (TrollTown)
| Component | Requirement |
|-----------|-------------|
| **RAM** | 8 GB minimum, 16 GB recommended |
| **GPU** | Dedicated GPU recommended (NVIDIA GTX 1050+ / AMD RX 560+) |
| **Browser** | Chrome with hardware acceleration enabled |

### Mobile Requirements
| Device | Requirement |
|--------|-------------|
| **iOS** | iPhone 8 or newer, iOS 14+ |
| **Android** | 4GB RAM, Android 10+ |
| **Storage** | 200 MB app cache |

---

## For Server/Hosting (Production Infrastructure)

### Tier 1: Small Scale (1,000 - 10,000 users)
| Service | Specification |
|---------|---------------|
| **Frontend Hosting** | Vercel Pro (auto-scales) |
| **Database** | Supabase Pro ($25/month) |
| **Streaming** | LiveKit Cloud or Mux |
| **Storage** | Supabase Storage or Bunny CDN |
| **Edge Functions** | Supabase Edge Functions |

### Tier 2: Medium Scale (10,000 - 100,000 users)
| Service | Specification |
|---------|---------------|
| **Frontend** | Vercel Enterprise / AWS CloudFront |
| **Database** | Supabase Enterprise or dedicated PostgreSQL |
| **Streaming** | LiveKit self-hosted or Mux Enterprise |
| **Real-time** | Supabase Realtime + Redis (Upstash) |
| **CDN** | Bunny CDN / Cloudflare Enterprise |
| **Bandwidth** | 10 TB/month minimum |

### Tier 3: Large Scale (100,000+ users)
| Service | Specification |
|---------|---------------|
| **Infrastructure** | AWS EKS / GCP GKE (Kubernetes) |
| **Database** | PostgreSQL on AWS RDS Aurora |
| **Caching** | Redis ElastiCache / Upstash |
| **Streaming** | Custom LiveKit cluster |
| **CDN** | Multi-region Cloudflare |
| **Bandwidth** | 50-100 TB/month |
| **Estimated Cost** | $5,000+/month |

---

## Tech Stack Summary

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS
- Three.js / Babylon.js (3D graphics)
- LiveKit (video streaming)

### Backend Services
- Supabase (Database, Auth, Realtime, Edge Functions)
- Vercel (Frontend hosting)
- Mux (Video processing)
- Agora/LiveKit (Live streaming)
- Stripe/PayPal (Payments)

### External APIs
- PayPal SDK
- Stripe
- Google reCAPTCHA

---

## Bandwidth Estimates

| Activity | Bandwidth |
|----------|-----------|
| **Browsing/Chat** | 1-3 Mbps |
| **Watching Stream (SD)** | 3-5 Mbps |
| **Watching Stream (HD)** | 8-15 Mbps |
| **Broadcasting** | 10-20 Mbps |
| **3D City Exploration** | 5-10 Mbps |

---

## Browser Features Required
- WebSocket support
- WebRTC support
- IndexedDB (local storage)
- WebGL 2.0 (for 3D features)
- ES2020+ JavaScript

---

## Notes
- Troll City is a **Progressive Web App (PWA)** - can be installed on mobile devices
- No download required - runs entirely in browser
- Works on Chromebooks with limited functionality
- 3D city features require WebGL-capable devices

---

*Last Updated: March 2026*
