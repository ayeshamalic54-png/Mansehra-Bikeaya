# Mansehra Bikeaya (`Rider_App Mansehra`)

Motorbike Ride-Hailing, Parcel Delivery, Bazaar Errand, Rider Settlement (*Lain-Dain*) & Owner Profit/P&L Web Application built for **Mansehra**.

## Stack
- **Backend**: Python (FastAPI, SQLAlchemy, PyJWT, Bcrypt, Uvicorn)
- **Database**: Neon PostgreSQL (`DATABASE_URL` loaded via `.env` locally or Render Environment Variables)
- **Frontend**: React 18 + Vite + Tailwind CSS (`Plus Jakarta Sans` + `Roboto Mono`)

## Local Development Setup

### 1. Environment Variables
`.env` is excluded from Git (`.gitignore`). Configure your local `.env` using `.env.example` as reference (`DATABASE_URL`, `JWT_SECRET`).

### 2. Run Backend API
```powershell
cd backend
..\.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

### 3. Run Frontend Dev Server (or use built bundle via FastAPI)
```powershell
cd frontend
npm run dev
```
Or build frontend once so FastAPI serves both API and UI on `http://127.0.0.1:8000`:
```powershell
cd frontend
npm run build
```

## Demo Login Accounts (Local Seed)
- **Admin (Owner)**: `03001111111` / `admin123`
- **Motorbike Captain 1**: `03112222222` / `rider123`
- **Motorbike Captain 2**: `03123333333` / `rider123`
- **Customer**: `03334444444` / `user123`

## Render Deployment Guide
1. Push repository to GitHub (verify `.env` and `my db*.txt` are NOT tracked).
2. In **Render Dashboard**, choose **New → Blueprint** (uses `render.yaml`) or **Web Service**:
   - **Build Command**: `pip install -r backend/requirements.txt && cd frontend && npm install && npm run build`
   - **Start Command**: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Add **Environment Variables** in Render:
   - `DATABASE_URL`: your Neon PostgreSQL connection string
   - `JWT_SECRET`: secure random secret
   - `APP_ENV`: `production`

## Phase 2: Packaging `.apk` & `.exe`
- **Android `.apk`**: Wrap `frontend/dist` with Capacitor (`@capacitor/android`) and compile release `.apk`.
- **Windows `.exe`**: Wrap desktop portal with Electron (`electron-builder`).
- Publish release links in **Admin → App Releases** so they immediately appear on `/downloads`.
