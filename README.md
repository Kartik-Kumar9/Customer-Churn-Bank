# Customer Churn Prediction

This repository contains an end-to-end Machine Learning web application designed to predict whether a bank customer will stay or churn. The project incorporates data preprocessing, exploratory data analysis, robust model combinations, and a FastAPI backend with an interactive web frontend.

## Key Features

- **Exploratory Data Analysis (EDA)**: Detailed insights into the dataset and customer demographics.
- **Model Training**: Evaluated multiple algorithms, including Logistic Regression, Random Forest, SVM, XGBoost, LightGBM, CatBoost, and a Voting Ensemble.
- **Predictive API**: A REST API built with FastAPI that returns churn probability, risk level, and prediction for a single customer.
- **Interactive UI**: A stunning web UI fetching predictions and feature importance through HTTP routes.
- **Evaluation Visualizations**: ROC, Precision-Recall curves, confusion matrices, and feature importances calculated on the dataset.

## Directory Structure

```plaintext
C:\PROJECTS\Customer Churn Bank\
├── main.py                    # The FastAPI application serving REST endpoints and static files
├── requirements.txt           # Python application dependencies
├── Backend/
│   └── model/                 # Joblib serialized model artifacts (churn_model, scaler, feature_columns)
├── Dataset/                   # Data used for training and testing
├── frontend/                  # Web interface pages (HTML, CSS, JS) and avatars
├── noteboook/                 # Jupyter notebooks: EDA.ipynb and Model_training.ipynb
└── plots/                     # Output visualizations from model training
```

## Running the Application

1. Make sure to have Python installed. You can install project dependencies using `pip`:
   ```bash
   pip install -r requirements.txt
   ```
2. Start the application backend and frontend by running standard `uvicorn`:
   ```bash
   uvicorn main:app --reload
   ```
3. Open a browser and visit `http://127.0.0.1:8000/`. You can browse the Swagger API documentation seamlessly via `http://127.0.0.1:8000/docs`.

## Model Evaluation & Visualizations

During the machine learning pipeline execution, multiple classification models were tested. The performance and trade-offs of these algorithms are visualized below.

### 1. Model Comparisons
Comparison of training results to balance out the F1 score, precision, and recall alongside accuracy and ROC-AUC scores.
![Model Comparison](plots/model_comparison.png)

### 2. ROC Curves
The ROC curves demonstrate the trade-off between the true positive rate and false positive rate.
![ROC Curves](plots/roc_curves.png)

### 3. Precision-Recall Curves
Crucial for handling class imbalance, to observe how positive classification thresholds perform across models.
![Precision-Recall Curves](plots/Precision-Recall_Curves.png)

### 4. Confusion Matrices
Illustrating the performance metrics and error rates for correct predictions against actual class distributions.
![Confusion Matrices](plots/confusion_matrices.png)

### 5. Feature Importance
Highlights the predictive power of different client metrics (such as `age`, `balance`, `num_products`, etc.), driven by our Gradient Boosting algorithms.
![Feature Importance](plots/feature_importance.png)

## Technologies Used

- **Web Backend Framework**: FastAPI, Uvicorn
- **Machine Learning**: Scikit-Learn, Pandas, Numpy, Joblib
- **Frontend**: HTML5, CSS3, JavaScript
