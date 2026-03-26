"""
Customer Churn Prediction — FastAPI Application
"""

import os
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

# ─── Paths ───────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "Backend", "model")
STATIC_DIR = os.path.join(BASE_DIR, "frontend")

# ─── Load artefacts once at startup ──────────────────────────────────────────
model = joblib.load(os.path.join(MODEL_DIR, "churn_model.pkl"))
scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))
feature_columns = joblib.load(os.path.join(MODEL_DIR, "feature_columns.pkl"))

NUM_COLS = ["credit_score", "age", "tenure", "balance", "products_number", "estimated_salary"]

# ─── Training results (from notebook) ────────────────────────────────────────
TRAINING_RESULTS = [
    {"model": "Logistic Regression", "roc_auc": 0.7689, "f1": 0.4967, "precision": 0.4452, "recall": 0.5602, "accuracy": 0.7765},
    {"model": "Random Forest",       "roc_auc": 0.8601, "f1": 0.6066, "precision": 0.5762, "recall": 0.6404, "accuracy": 0.8490},
    {"model": "Gradient Boosting",   "roc_auc": 0.8713, "f1": 0.6255, "precision": 0.6163, "recall": 0.6351, "accuracy": 0.8545},
    {"model": "SVM",                 "roc_auc": 0.8492, "f1": 0.5965, "precision": 0.5636, "recall": 0.6331, "accuracy": 0.8415},
    {"model": "XGBoost",             "roc_auc": 0.8637, "f1": 0.6206, "precision": 0.5738, "recall": 0.6757, "accuracy": 0.8445},
    {"model": "LightGBM",            "roc_auc": 0.8581, "f1": 0.6109, "precision": 0.5697, "recall": 0.6585, "accuracy": 0.8420},
    {"model": "CatBoost",            "roc_auc": 0.8703, "f1": 0.6299, "precision": 0.6127, "recall": 0.6482, "accuracy": 0.8545},
    {"model": "Voting Ensemble",     "roc_auc": 0.8677, "f1": 0.6299, "precision": 0.5857, "recall": 0.6814, "accuracy": 0.8465},
]

# ─── Feature importance (from Gradient Boosting model) ──────────────────────
try:
    importances = model.feature_importances_
    FEATURE_IMPORTANCE = [
        {"feature": feat, "importance": round(float(imp), 4)}
        for feat, imp in sorted(zip(feature_columns, importances), key=lambda x: x[1], reverse=True)
    ]
except AttributeError:
    FEATURE_IMPORTANCE = []


# ─── Pydantic request / response models ─────────────────────────────────────
class PredictionRequest(BaseModel):
    credit_score: int = Field(..., ge=300, le=900, description="Credit score (300-900)")
    gender: int = Field(..., ge=0, le=1, description="0 = Female, 1 = Male")
    age: int = Field(..., ge=18, le=100, description="Customer age")
    tenure: int = Field(..., ge=0, le=10, description="Years with bank (0-10)")
    balance: float = Field(..., ge=0, description="Account balance")
    products_number: int = Field(..., ge=1, le=4, description="Number of products (1-4)")
    credit_card: int = Field(..., ge=0, le=1, description="Has credit card (0/1)")
    active_member: int = Field(..., ge=0, le=1, description="Is active member (0/1)")
    estimated_salary: float = Field(..., ge=0, description="Estimated salary")
    country: str = Field(..., description="Country: France, Germany, or Spain")


class PredictionResponse(BaseModel):
    churn_probability: float
    prediction: str
    risk_level: str


# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(title="Customer Churn Predictor", version="1.0.0")

# Allow requests from any origin (e.g. VS Code Live Server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/predict", response_model=PredictionResponse)
async def predict(req: PredictionRequest):
    """Return churn prediction for a single customer."""
    country = req.country.strip().title()
    if country not in ("France", "Germany", "Spain"):
        raise HTTPException(status_code=422, detail="Country must be France, Germany, or Spain")

    # Build a single-row DataFrame that mirrors training columns
    row = {
        "credit_score": req.credit_score,
        "gender": req.gender,
        "age": req.age,
        "tenure": req.tenure,
        "balance": req.balance,
        "products_number": req.products_number,
        "credit_card": req.credit_card,
        "active_member": req.active_member,
        "estimated_salary": req.estimated_salary,
        "country_France": country == "France",
        "country_Germany": country == "Germany",
        "country_Spain": country == "Spain",
    }
    df = pd.DataFrame([row])

    # Ensure column order matches training
    df = df[feature_columns]

    # Scale numeric columns
    df[NUM_COLS] = scaler.transform(df[NUM_COLS])

    # Predict
    proba = float(model.predict_proba(df)[0, 1])
    prediction = "Churned" if proba >= 0.5 else "Stayed"

    if proba >= 0.7:
        risk = "High"
    elif proba >= 0.4:
        risk = "Medium"
    else:
        risk = "Low"

    return PredictionResponse(
        churn_probability=round(proba, 4),
        prediction=prediction,
        risk_level=risk,
    )


@app.get("/api/model-info")
async def model_info():
    """Return model metadata and training results."""
    return {
        "best_model": "Gradient Boosting",
        "best_roc_auc": 0.8713,
        "best_f1": 0.6255,
        "training_results": TRAINING_RESULTS,
    }


@app.get("/api/feature-importance")
async def feature_importance():
    """Return feature importance list."""
    return {"features": FEATURE_IMPORTANCE}


# Serve static assets (Must be placed after API routes to avoid overlapping interception)
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
