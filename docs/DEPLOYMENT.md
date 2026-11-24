# LYFTR AI — Deployment Guide

Instructions for deploying the LYFTR AI full-stack application to public cloud hosting environments.

---

## Recommended Deployment Topology

| Tier | Provider | Service Type | Persistent Storage |
| :--- | :--- | :--- | :--- |
| **Frontend** | [Vercel](https://vercel.com) or [Netlify](https://netlify.com) | Static Single Page App | None (Edge CDN) |
| **Backend** | [Render](https://render.com) or [Railway](https://railway.app) | Docker Web Service | Persistent Volume at `/data` |

---

## 1. Backend Deployment (Render / Railway)

### Using Render Web Service
1. Create a new **Web Service** on Render and connect your GitHub repository.
2. Choose **Docker** as the runtime environment.
3. Set **Docker Context Directory** to `./backend`.
4. Set **DockerfilePath** to `Dockerfile`.
5. Add a **Persistent Disk**:
   - **Mount Path**: `/data`
   - **Size**: 1 GB
6. Configure the Environment Variables in Render:
   ```env
   PORT=8000
   DATABASE_URL=sqlite:////data/app.db
   ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app
   ENABLE_FAILURE_SIMULATION=true
   LLM_API_KEYS=sk-real-key-1,sk-real-key-2
   LLM_MODEL=gemini/gemini-2.0-flash
   DEFAULT_SYSTEM_PROMPT=You are a helpful AI assistant.
   LLM_TIMEOUT_SECONDS=60
   ```
7. Click **Deploy Web Service**.
8. Verify health endpoint:
   ```bash
   curl -s https://your-backend-app.onrender.com/health
   ```

---

## 2. Frontend Deployment (Vercel)

### Using Vercel
1. Import your GitHub repository in the Vercel dashboard.
2. Set **Root Directory** to `frontend`.
3. Set **Framework Preset** to `Vite`.
4. Configure Build Settings:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Configure Environment Variables:
   ```env
   VITE_API_BASE_URL=https://your-backend-app.onrender.com
   ```
6. Click **Deploy**.
7. Once deployed, copy your live frontend URL (e.g. `https://lyftr-ai.vercel.app`) and add it to `ALLOWED_ORIGINS` in your backend configuration.

---

## 3. Post-Deployment Verification Checklist

1. **Verify Backend Health**:
   ```bash
   curl -s https://your-backend-app.onrender.com/health
   # Must return {"status": "ok", "keys_configured": 2, "cache_enabled": true}
   ```
2. **Verify CORS**:
   Open browser DevTools on your live frontend URL and ensure no CORS policy errors occur when communicating with the backend API.
3. **Verify Failover Test Hook**:
   ```bash
   curl -s -X POST https://your-backend-app.onrender.com/chat \
     -H "Content-Type: application/json" \
     -H "X-Simulate-Failure: key_1=429" \
     -d '{"session_id": "s-prod-test", "message": "Verify failover"}'
   # Must return 200 with key_id: key_2 and fallback_attempts: 1
   ```
4. **Verify Persistent Disk**:
   Trigger a deployment or restart on Render, then verify that `/sessions/s-prod-test/messages` still returns the stored messages.

---

## Security Precautions
- Real API keys must **never** be checked into git or published in frontend bundles.
- `ENABLE_FAILURE_SIMULATION=true` is enabled specifically for evaluator demonstration.
- SQLite database resides in `/data/app.db` with strict non-root Linux permissions.
