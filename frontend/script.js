const API_BASE = '/api';

let modelChartInstance = null;
let featureChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    // Fetch initial data
    fetchModelInfo();
    fetchFeatureImportance();

    // Attach event listeners
    const form = document.getElementById('prediction-form');
    if (form) {
        form.addEventListener('submit', handlePredict);
    }

    // Tab switching logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked button and target content
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');
            
            // Toggle dashboard pane visibility
            const dashboardPane = document.getElementById('dashboard-pane');
            const leftPane = document.querySelector('.tab-left-pane');
            
            if (dashboardPane && leftPane) {
                if (targetId === 'tab-predict') {
                    dashboardPane.classList.remove('hidden');
                    leftPane.classList.remove('full-width');
                } else {
                    dashboardPane.classList.add('hidden');
                    leftPane.classList.add('full-width');
                }
            }
        });
    });
});

/**
 * Fetch model information from the backend and populate the UI
 */
async function fetchModelInfo() {
    try {
        const res = await fetch(`${API_BASE}/model-info`);
        if (!res.ok) throw new Error('Failed to fetch model info');
        const data = await res.json();
        
        // Populate metrics
        document.getElementById('model-metrics').classList.remove('hidden');
        document.getElementById('val-best-model').textContent = data.best_model;
        document.getElementById('val-roc').textContent = data.best_roc_auc.toFixed(4);
        document.getElementById('val-f1').textContent = data.best_f1.toFixed(4);

        // Render chart if data is available
        if (data.training_results) {
            document.getElementById('charts-wrapper').classList.remove('hidden');
            renderModelChart(data.training_results);
        }
    } catch (error) {
        console.error('Error fetching model info:', error);
    }
}

/**
 * Fetch feature importances from the backend and render the chart
 */
async function fetchFeatureImportance() {
    try {
        const res = await fetch(`${API_BASE}/feature-importance`);
        if (!res.ok) throw new Error('Failed to fetch feature importance');
        const data = await res.json();
        
        if (data.features && data.features.length > 0) {
            document.getElementById('charts-wrapper').classList.remove('hidden');
            renderFeatureChart(data.features);
        }
    } catch (error) {
        console.error('Error fetching feature importance:', error);
    }
}

/**
 * Handle prediction form submission
 */
async function handlePredict(e) {
    e.preventDefault();
    
    // UI elements
    const btn = document.getElementById('predict-btn');
    const loading = document.getElementById('loading');
    const resultContainer = document.getElementById('result-container');
    
    // Set loading state
    btn.disabled = true;
    btn.style.opacity = '0.7';
    loading.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    
    // Gather form data
    const payload = {
        credit_score: parseInt(document.getElementById('credit_score').value),
        country: document.getElementById('country').value,
        gender: parseInt(document.getElementById('gender').value),
        age: parseInt(document.getElementById('age').value),
        tenure: parseInt(document.getElementById('tenure').value),
        balance: parseFloat(document.getElementById('balance').value),
        products_number: parseInt(document.getElementById('products_number').value),
        estimated_salary: parseFloat(document.getElementById('estimated_salary').value),
        credit_card: document.getElementById('credit_card').checked ? 1 : 0,
        active_member: document.getElementById('active_member').checked ? 1 : 0
    };

    try {
        const res = await fetch(`${API_BASE}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || 'Prediction failed');
        }
        
        const data = await res.json();
        showResult(data, payload);
    } catch (error) {
        console.error('Prediction error:', error);
        alert(`Error: ${error.message}`);
    } finally {
        // Reset UI state
        btn.disabled = false;
        btn.style.opacity = '1';
        loading.classList.add('hidden');
    }
}

/**
 * Render local radar chart for individual customer
 */
let localRadarInstance = null;
function renderLocalRadar(payload, riskLevel) {
    const ctx = document.getElementById('localRadarChart');
    if (!ctx) return;
    
    // Normalize values 0-100 to show risk/profile factors
    const data = [
        Math.min((payload.age / 80) * 100, 100),
        Math.min((payload.balance / 200000) * 100, 100),
        (payload.products_number / 4) * 100,
        (payload.tenure / 10) * 100,
        Math.max(((payload.credit_score - 300) / 600) * 100, 0)
    ];
    
    const color = riskLevel === 'High' ? 'rgba(239, 68, 68, 0.4)' : 
                  riskLevel === 'Medium' ? 'rgba(245, 158, 11, 0.4)' : 
                  'rgba(16, 185, 129, 0.4)';
    const borderColor = riskLevel === 'High' ? 'rgb(239, 68, 68)' : 
                        riskLevel === 'Medium' ? 'rgb(245, 158, 11)' : 
                        'rgb(16, 185, 129)';

    if (localRadarInstance) localRadarInstance.destroy();
    
    localRadarInstance = new Chart(ctx.getContext('2d'), {
        type: 'radar',
        data: {
            labels: ['Age', 'Balance', 'Products', 'Tenure', 'Credit Score'],
            datasets: [{
                label: 'Customer Profile Level',
                data: data,
                backgroundColor: color,
                borderColor: borderColor,
                pointBackgroundColor: borderColor,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(0,0,0,0.1)' },
                    grid: { color: 'rgba(0,0,0,0.1)' },
                    pointLabels: { font: { family: "'Inter', sans-serif" }, color: '#64748b' },
                    ticks: { display: false, min: 0, max: 100 }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });
}

/**
 * Display the prediction result mapping the payload to the UI
 */
function showResult(data, payload) {
    const resultContainer = document.getElementById('result-container');
    const resultCardInner = document.getElementById('result-card-inner');
    const riskBadge = document.getElementById('risk-badge');
    const probValue = document.getElementById('prob-value');
    const predictionText = document.getElementById('prediction-text');
    const riskCircle = document.getElementById('risk-circle');
    
    // Remove previous risk classes
    riskBadge.classList.remove('risk-danger', 'risk-warning', 'risk-success');
    resultCardInner.classList.remove('risk-danger', 'risk-warning', 'risk-success');
    
    resultContainer.classList.remove('hidden');
    
    // Format probability
    const probPercentage = (data.churn_probability * 100).toFixed(1);
    probValue.textContent = `${probPercentage}%`;
    
    // Set circle percentage variable for CSS conic-gradient animation
    riskCircle.style.setProperty('--percentage', `${probPercentage}%`);
    
    // Set styles based on risk level
    if (data.risk_level === 'High') {
        riskBadge.classList.add('risk-danger');
        riskBadge.textContent = 'High Churn Risk';
        predictionText.innerHTML = '<strong>Action Required:</strong> This customer is highly likely to leave the bank. Immediate intervention and targeted retention offers recommended.';
        riskCircle.style.setProperty('--risk-color', 'var(--danger)');
        resultCardInner.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    } else if (data.risk_level === 'Medium') {
        riskBadge.classList.add('risk-warning');
        riskBadge.textContent = 'Medium Churn Risk';
        predictionText.innerHTML = '<strong>Watch List:</strong> This customer shows signs of potential churn. Consider proactive communication.';
        riskCircle.style.setProperty('--risk-color', 'var(--warning)');
        resultCardInner.style.borderColor = 'rgba(245, 158, 11, 0.3)';
    } else {
        riskBadge.classList.add('risk-success');
        riskBadge.textContent = 'Low Churn Risk';
        predictionText.innerHTML = '<strong>Stable Customer:</strong> This customer is very likely to stay with the bank.';
        riskCircle.style.setProperty('--risk-color', 'var(--success)');
        resultCardInner.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    }
    
    // Render the radar chart for local explanation
    renderLocalRadar(payload, data.risk_level);

    // Scroll to results cleanly
    setTimeout(() => {
        resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

/**
 * Render the chart comparing all models' performance
 */
function renderModelChart(results) {
    const ctx = document.getElementById('modelChart');
    if (!ctx) return;
    
    // Split model names by space to make them multiline and upright
    const labels = results.map(r => r.model.split(' '));
    const rocData = results.map(r => r.roc_auc);
    const f1Data = results.map(r => r.f1);
    const accData = results.map(r => r.accuracy);
    
    if (modelChartInstance) modelChartInstance.destroy();
    
    modelChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: 'Accuracy',
                    data: accData,
                    borderColor: '#10b981',
                    backgroundColor: '#10b981',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.3,
                    pointBackgroundColor: '#ffffff',
                    pointRadius: 4
                },
                {
                    type: 'bar',
                    label: 'ROC AUC',
                    data: rocData,
                    backgroundColor: 'rgba(37, 99, 235, 0.8)',
                    borderColor: 'rgb(37, 99, 235)',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'F1 Score',
                    data: f1Data,
                    backgroundColor: 'rgba(71, 85, 105, 0.8)',
                    borderColor: 'rgb(71, 85, 105)',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#64748b', font: { family: "'Inter', sans-serif" } } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${(context.parsed.y * 100).toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 0.3,
                    grid: { color: '#e2e8f0' },
                    ticks: { color: '#64748b' }
                },
                x: {
                    grid: { display: false },
                    ticks: { 
                        color: '#64748b', 
                        font: { size: 10 },
                        maxRotation: 0,
                        minRotation: 0
                    }
                }
            }
        }
    });
}

/**
 * Render the feature importance horizontal bar chart
 */
function renderFeatureChart(features) {
    const ctx = document.getElementById('featureChart');
    if (!ctx) return;
    
    // Display top 8 features for clean visual
    const topFeatures = features.slice(0, 8);
    const labels = topFeatures.map(f => {
        // Humanize labels
        let label = f.feature.replace('country_', '');
        label = label.replace(/_/g, ' ');
        return label.charAt(0).toUpperCase() + label.slice(1);
    });
    const data = topFeatures.map(f => f.importance);
    
    // Heuristic direction mapping for tooltips/colors
    const directionMap = {
        'Age': 1, 'Products number': -1, 'Active member': -1,
        'Tenure': -1, 'Balance': 1, 'Germany': 1,
        'Gender': -1, 'Estimated salary': 0
    };
    
    const bgColors = labels.map(label => {
        const dir = directionMap[label] || 0;
        if (dir > 0) return 'rgba(239, 68, 68, 0.8)';
        if (dir < 0) return 'rgba(16, 185, 129, 0.8)';
        return 'rgba(100, 116, 139, 0.8)';
    });
    
    const borderColors = labels.map(label => {
        const dir = directionMap[label] || 0;
        if (dir > 0) return 'rgb(239, 68, 68)';
        if (dir < 0) return 'rgb(16, 185, 129)';
        return 'rgb(100, 116, 139)';
    });
    
    if (featureChartInstance) featureChartInstance.destroy();
    
    featureChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Importance Score',
                data: data,
                backgroundColor: bgColors,
                borderColor: borderColors,
                borderWidth: 1,
                borderRadius: 4,
                barThickness: 15
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = (context.parsed.x * 100).toFixed(1);
                            const dir = directionMap[context.label] || 0;
                            const effect = dir > 0 ? "(Increases churn risk)" : dir < 0 ? "(Decreases churn risk)" : "";
                            return [`Drives ${val}% of model decision`, effect];
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: '#e2e8f0' },
                    ticks: { color: '#64748b' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { family: "'Inter', sans-serif" } }
                }
            }
        }
    });
}
