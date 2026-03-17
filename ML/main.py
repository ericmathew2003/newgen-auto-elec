"""
Unified ML Service for Render deployment
Mounts all ML sub-apps under path prefixes on a single port.

  /cashflow  -> Cash Flow Prediction (cashflow_service.py)
  /fault     -> Fault Diagnosis (advanced_fault_diagnosis.py)
  /parts     -> Parts Vision (parts_vision_service.py)
  /health    -> Health check
"""

import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

# ── Main app ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="NewGen Auto ML Services",
    description="Unified ML API: Cash Flow Prediction, Fault Diagnosis, Parts Vision",
    version="1.0.0",
)

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5000",
    os.getenv("VERCEL_FRONTEND_URL", "https://newgen-auto-frontend.vercel.app"),
    os.getenv("VERCEL_BACKEND_URL", "https://newgen-auto-elec.vercel.app"),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "service": "NewGen Auto ML Services",
        "version": "1.0.0",
        "endpoints": {
            "cashflow": "/cashflow",
            "fault_diagnosis": "/fault",
            "parts_vision": "/parts",
            "docs": "/docs",
        },
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


# ── Mount sub-apps ────────────────────────────────────────────────────────────
# Each sub-app is a full FastAPI instance; mounting keeps their routes isolated.
try:
    from cashflow_service import app as cashflow_app
    app.mount("/cashflow", cashflow_app)
    print("✅ Cashflow service mounted at /cashflow")
except Exception as e:
    print(f"⚠️  Cashflow service failed to load: {e}")

try:
    from advanced_fault_diagnosis import app as fault_app
    app.mount("/fault", fault_app)
    print("✅ Advanced fault diagnosis service mounted at /fault")
except Exception as e:
    print(f"⚠️  Advanced fault diagnosis service failed to load: {e}")

try:
    from parts_vision_service import app as parts_app
    app.mount("/parts", parts_app)
    print("✅ Parts vision service mounted at /parts")
except Exception as e:
    print(f"⚠️  Parts vision service failed to load: {e}")


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", os.getenv("SERVICE_PORT", 8001)))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
