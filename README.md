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

## Security & Password Policy
- Only the **Admin** can create/reset passwords for Admin, Motorbike Captains, and Customers from the Admin Dashboard (**Passwords & Settings**, **Motorbike Riders**, **Customers Directory**).
- Change initial seeded passwords immediately upon first production login.

## Render Deployment Guide
1. Push repository to GitHub (verify `.env` and `my db*.txt` are NOT tracked).
2. In **Render Dashboard**, choose **New → Blueprint** (uses `render.yaml`) or **Web Service**:
   - **Build Command**: `pip install -r backend/requirements.txt && cd frontend && npm install && npm run build`
   - **Start Command**: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Add **Environment Variables** in Render:
   - `DATABASE_URL`: your Neon PostgreSQL connection string
   - `JWT_SECRET`: secure random secret
   - `APP_ENV`: `production`

## Android APK & Windows EXE Packaging
- **Android `.apk`**: Built from `mobile-apk/` via GitHub Actions (`MansehraBikeaya.apk`).
- **Windows `.exe`**: Built from `desktop-exe/` via PyInstaller + PyWebView (`MansehraBikeayaDesk.exe`).
- Both are published to GitHub Releases and linked directly on `/downloads`.
