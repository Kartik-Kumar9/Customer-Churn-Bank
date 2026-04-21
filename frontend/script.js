const API_BASE = '/api';

let modelChartInstance = null;
let featureChartInstance = null;
let trainingResults = [];   // cache for selected-model stats
let activeMetric = 'roc_auc'; // currently selected metric pill

document.addEventListener('DOMContentLoaded', () => {
    // Fetch initial data
    fetchModelInfo();
    fetchFeatureImportance();
    fetchAvailableModels();

    // Attach event listeners
    const form = document.getElementById('prediction-form');
    if (form) {
        form.addEventListener('submit', handlePredict);
    }

    // Metric description content
    const metricDescriptions = {
        roc_auc: {
            title: 'ROC AUC',
            icon: 'fa-bullseye',
            color: '#2563eb',
            body: 'ROC AUC (Area Under the Receiver Operating Characteristic Curve) measures how well the model separates churners from loyal customers across all decision thresholds. A score of 1.0 means perfect separation; 0.5 means random guessing. For churn prediction, a high AUC means the bank can rank customers by risk and intervene before the most at-risk ones leave.'
        },
        f1: {
            title: 'F1 Score',
            icon: 'fa-check-double',
            color: '#10b981',
            body: 'F1 Score is the harmonic mean of Precision and Recall. In churn prediction, misses are costly — a churned customer is a lost revenue stream. F1 balances the cost of false alarms (contacting non-churners) against missed churners, making it the most actionable single metric for retention campaigns.'
        },
        accuracy: {
            title: 'Accuracy',
            icon: 'fa-percent',
            color: '#f59e0b',
            body: 'Accuracy is the share of all predictions (churn + non-churn) the model gets right. Because most bank customers do NOT churn (~80%), a naive model that always predicts "stay" would score ~80%. Accuracy is best read alongside F1 and AUC to avoid being misled by class imbalance.'
        },
        precision: {
            title: 'Precision',
            icon: 'fa-crosshairs',
            color: '#8b5cf6',
            body: 'Precision answers: of all customers the model flagged as churners, how many actually churned? High precision reduces wasted retention budget — fewer offers sent to customers who were never going to leave. Important when intervention cost (e.g., a discount) is high.'
        },
        recall: {
            title: 'Recall',
            icon: 'fa-magnet',
            color: '#ef4444',
            body: 'Recall (Sensitivity) answers: of all actual churners, how many did the model catch? High recall ensures almost no churner slips through undetected. Critical when the cost of losing a customer far outweighs the cost of a false alarm, which is typically the case in high-value banking segments.'
        }
    };

    // Metric pill click handlers
    document.querySelectorAll('.metric-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.metric-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            activeMetric = pill.getAttribute('data-metric');
            if (trainingResults.length > 0) renderModelChart(trainingResults, activeMetric);
            // Show description panel
            showMetricDescription(activeMetric, metricDescriptions);
        });
    });

    // Initialise description panel with default metric
    setTimeout(() => showMetricDescription(activeMetric, metricDescriptions), 0);

    // Tab switching logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');
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

        // Populate best-model metrics (model-metrics card is always visible now)
        document.getElementById('val-best-model').textContent = data.best_model;
        document.getElementById('val-roc').textContent = data.best_roc_auc.toFixed(4);
        document.getElementById('val-f1').textContent = data.best_f1.toFixed(4);

        // Cache results and render chart
        if (data.training_results) {
            trainingResults = data.training_results;
            document.getElementById('charts-wrapper').classList.remove('hidden');
            renderModelChart(trainingResults, activeMetric);
            // Populate selected-model stats for the current dropdown value
            const sel = document.getElementById('model-select');
            updateSelectedModelStats(sel ? sel.value : data.best_model);
        }
    } catch (error) {
        console.error('Error fetching model info:', error);
    }
}

/**
 * Fetch available models from the backend and populate the dropdown
 */
async function fetchAvailableModels() {
    try {
        const res = await fetch(`${API_BASE}/models`);
        if (!res.ok) return;
        const data = await res.json();
        const select = document.getElementById('model-select');
        if (!select || !data.models || data.models.length === 0) return;

        select.innerHTML = '';
        data.models.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            if (name === 'Gradient Boosting') opt.selected = true;
            select.appendChild(opt);
        });

        // Update stats panel whenever the user changes the dropdown
        select.addEventListener('change', () => updateSelectedModelStats(select.value));
    } catch (error) {
        console.error('Error fetching models:', error);
    }
}

/**
 * Show stats (ROC AUC, F1, Accuracy) for the selected model
 */
function updateSelectedModelStats(modelName) {
    if (!trainingResults || trainingResults.length === 0) return;
    const result = trainingResults.find(r => r.model === modelName);
    if (!result) return;
    const selRoc = document.getElementById('sel-roc');
    const selF1 = document.getElementById('sel-f1');
    const selAcc = document.getElementById('sel-acc');
    if (selRoc) selRoc.textContent = result.roc_auc.toFixed(4);
    if (selF1) selF1.textContent = result.f1.toFixed(4);
    if (selAcc) selAcc.textContent = result.accuracy.toFixed(4);
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
        active_member: document.getElementById('active_member').checked ? 1 : 0,
        model_name: document.getElementById('model-select')?.value || 'Gradient Boosting'
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
 * Render a donut gauge chart for churn probability
 */
let gaugeDonutInstance = null;
function renderGaugeDonut(probability, riskLevel) {
    const ctx = document.getElementById('gaugeDonut');
    if (!ctx) return;

    const pct = Math.round(probability * 100 * 10) / 10;
    const rest = 100 - pct;

    const riskColor = riskLevel === 'High' ? '#ef4444' :
        riskLevel === 'Medium' ? '#f59e0b' : '#10b981';
    const trackColor = riskLevel === 'High' ? 'rgba(239,68,68,0.12)' :
        riskLevel === 'Medium' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)';

    if (gaugeDonutInstance) gaugeDonutInstance.destroy();

    gaugeDonutInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [pct, rest],
                backgroundColor: [riskColor, trackColor],
                borderWidth: 0,
                hoverOffset: 0
            }]
        },
        options: {
            responsive: false,
            cutout: '72%',
            rotation: -90,
            circumference: 360,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            animation: { animateRotate: true, duration: 900 }
        }
    });
}

/**
 * Display the prediction result mapping the payload to the UI
 */
function showResult(data, payload) {
    const resultContainer = document.getElementById('result-container');
    const riskBadge = document.getElementById('risk-badge');
    const probValue = document.getElementById('prob-value');
    const predictionText = document.getElementById('prediction-text');
    const actionPanel = document.getElementById('risk-action-panel');
    const actionIcon = document.getElementById('action-panel-icon');
    const actionHeading = document.getElementById('action-panel-heading');

    // Format probability
    const probPercentage = (data.churn_probability * 100).toFixed(1);

    // Show result container
    resultContainer.classList.remove('hidden');

    // Update gauge probability text
    probValue.textContent = `${probPercentage}%`;

    // Render the donut gauge
    renderGaugeDonut(data.churn_probability, data.risk_level);

    // Update key stats
    const statProb = document.getElementById('stat-probability');
    const statRisk = document.getElementById('stat-risk-level');
    const statModel = document.getElementById('stat-model-used');
    if (statProb) statProb.textContent = `${probPercentage}%`;
    if (statRisk) statRisk.textContent = data.risk_level;
    if (statModel) statModel.textContent = payload.model_name || 'Gradient Boosting';

    // Remove previous classes
    riskBadge.classList.remove('risk-danger', 'risk-warning', 'risk-success');
    actionPanel.classList.remove('panel-danger', 'panel-warning', 'panel-success');
    actionIcon.classList.remove('icon-warning', 'icon-success');

    if (data.risk_level === 'High') {
        riskBadge.classList.add('risk-danger');
        riskBadge.textContent = 'High Churn Risk';
        actionHeading.textContent = 'Action Required';
        predictionText.textContent = 'This customer is highly likely to leave the bank. Immediate intervention and targeted retention offers recommended.';
        actionPanel.classList.add('panel-danger');
        actionIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
    } else if (data.risk_level === 'Medium') {
        riskBadge.classList.add('risk-warning');
        riskBadge.textContent = 'Medium Churn Risk';
        actionHeading.textContent = 'Watch List';
        predictionText.textContent = 'This customer shows signs of potential churn. Consider proactive communication.';
        actionPanel.classList.add('panel-warning');
        actionIcon.classList.add('icon-warning');
        actionIcon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
    } else {
        riskBadge.classList.add('risk-success');
        riskBadge.textContent = 'Low Churn Risk';
        actionHeading.textContent = 'Stable Customer';
        predictionText.textContent = 'This customer is very likely to stay with the bank. No immediate action needed.';
        actionPanel.classList.add('panel-success');
        actionIcon.classList.add('icon-success');
        actionIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
    }

    // Render the radar chart
    renderLocalRadar(payload, data.risk_level);

    // Smooth scroll to results
    setTimeout(() => {
        resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

/**
 * Show metric description panel
 */
function showMetricDescription(metric, descriptions) {
    const panel = document.getElementById('metric-desc-panel');
    if (!panel) return;
    const info = descriptions[metric];
    if (!info) return;
    panel.innerHTML = `
        <div class="metric-desc-icon" style="background:${info.color}20; color:${info.color}">
            <i class="fas ${info.icon}"></i>
        </div>
        <h3 class="metric-desc-title" style="color:${info.color}">${info.title}</h3>
        <p class="metric-desc-body">${info.body}</p>
    `;
    panel.classList.add('visible');
}

/**
 * Render the chart comparing all models' performance
 */
function renderModelChart(results, metric) {
    const ctx = document.getElementById('modelChart');
    if (!ctx) return;

    metric = metric || 'roc_auc';

    // Single color per metric (all bars same color for the selected metric)
    const metricColors = {
        roc_auc: { bg: 'rgba(37,  99, 235, 0.82)', bd: 'rgb(37,  99, 235)' },
        f1: { bg: 'rgba(16, 185, 129, 0.82)', bd: 'rgb(16, 185, 129)' },
        accuracy: { bg: 'rgba(245,158,  11, 0.82)', bd: 'rgb(245,158,  11)' },
        precision: { bg: 'rgba(139, 92, 246, 0.82)', bd: 'rgb(139, 92, 246)' },
        recall: { bg: 'rgba(239, 68, 68,  0.82)', bd: 'rgb(239, 68, 68)' }
    };
    const color = metricColors[metric] || metricColors.roc_auc;

    const metricLabels = {
        roc_auc: 'ROC AUC', f1: 'F1 Score', accuracy: 'Accuracy',
        precision: 'Precision', recall: 'Recall'
    };

    const labels = results.map(r => r.model.split(' '));
    const metricData = results.map(r => r[metric] !== undefined ? r[metric] : 0);

    if (modelChartInstance) modelChartInstance.destroy();

    modelChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: metricLabels[metric] || metric,
                data: metricData,
                backgroundColor: color.bg,
                borderColor: color.bd,
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `${metricLabels[metric] || metric}: ${(context.parsed.y * 100).toFixed(2)}%`;
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
        let label = f.feature.replace('country_', '');
        label = label.replace(/_/g, ' ');
        return label.charAt(0).toUpperCase() + label.slice(1);
    });
    const data = topFeatures.map(f => f.importance);

    // Direction: +1 increases churn, -1 decreases, 0 neutral
    const directionMap = {
        'Age': 1, 'Products number': -1, 'Active member': -1,
        'Tenure': -1, 'Balance': 1, 'Germany': 1,
        'Gender': -1, 'Estimated salary': 0, 'Credit score': -1,
        'Credit card': 0
    };

    // Feature description map
    const featureDescMap = {
        'Age': {
            icon: 'fa-birthday-cake', color: '#ef4444',
            effect: 'Increases churn risk',
            body: 'Older customers are paradoxically more likely to churn in this dataset. Middle-aged and senior customers may have more demanding service expectations or better access to competitive offers from rival banks.'
        },
        'Balance': {
            icon: 'fa-wallet', color: '#ef4444',
            effect: 'Increases churn risk',
            body: 'Customers with higher account balances tend to churn more. High-balance customers are more financially savvy, actively seek better returns, and are targeted by competitors with premium offers.'
        },
        'Germany': {
            icon: 'fa-map-marker-alt', color: '#ef4444',
            effect: 'Increases churn risk',
            body: 'Customers based in Germany show significantly higher churn rates than those in France or Spain. This likely reflects stronger local banking competition and higher consumer expectations in the German market.'
        },
        'Products number': {
            icon: 'fa-cubes', color: '#10b981',
            effect: 'Decreases churn risk',
            body: 'Customers using more bank products (loans, cards, savings) are far less likely to churn. Multiple products create switching costs and a deeper financial relationship — the customer has more to lose by leaving.'
        },
        'Active member': {
            icon: 'fa-user-check', color: '#10b981',
            effect: 'Decreases churn risk',
            body: 'Actively engaged customers — those who regularly log in, transact, or interact — almost never churn. Engagement is the single strongest signal of loyalty; disengagement is often the first warning sign before a customer leaves.'
        },
        'Tenure': {
            icon: 'fa-hourglass-half', color: '#10b981',
            effect: 'Decreases churn risk',
            body: 'The longer a customer has been with the bank, the less likely they are to leave. Long tenure builds inertia — customers accumulate products, credit history, and convenience that makes switching increasingly unattractive.'
        },
        'Gender': {
            icon: 'fa-venus-mars', color: '#10b981',
            effect: 'Minor protective effect',
            body: 'Gender has a mild association with churn in this dataset. Female customers show slightly higher churn rates, though this likely correlates with other demographic factors rather than gender alone being a direct driver.'
        },
        'Credit score': {
            icon: 'fa-star-half-alt', color: '#10b981',
            effect: 'Decreases churn risk',
            body: 'Customers with higher credit scores tend to stay longer. A strong credit score often reflects financial stability and satisfaction — these customers have less reason to seek alternatives and more to lose by disrupting their credit history.'
        },
        'Estimated salary': {
            icon: 'fa-money-bill-wave', color: '#64748b',
            effect: 'Neutral',
            body: 'Estimated salary has relatively little impact on churn in this model. Income level alone does not predict loyalty — what matters more is how engaged the customer is and how many products they hold.'
        },
        'Credit card': {
            icon: 'fa-credit-card', color: '#64748b',
            effect: 'Neutral',
            body: 'Holding a credit card with the bank has minimal effect on churn prediction. While it adds a product tie-in, credit cards are often standalone relationships that do not deepen overall banking engagement significantly.'
        }
    };

    const bgColors = labels.map(label => {
        const dir = directionMap[label] ?? 0;
        if (dir > 0) return 'rgba(239, 68, 68, 0.82)';
        if (dir < 0) return 'rgba(16, 185, 129, 0.82)';
        return 'rgba(100, 116, 139, 0.82)';
    });

    const borderColors = labels.map(label => {
        const dir = directionMap[label] ?? 0;
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
                borderRadius: 6,
                barThickness: 26
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
                        label: function (context) {
                            const val = (context.parsed.x * 100).toFixed(1);
                            const dir = directionMap[context.label] ?? 0;
                            const effect = dir > 0 ? '↑ Increases churn risk' : dir < 0 ? '↓ Decreases churn risk' : '→ Neutral';
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
                    ticks: { display: false },   // hidden — replaced by HTML pills
                    afterFit(scale) { scale.width = 0; }  // collapse y-axis margin
                }
            }
        }
    });

    // Build HTML pill buttons that replace the y-axis labels
    const pillsCol = document.getElementById('feature-pills-col');
    if (pillsCol) {
        pillsCol.innerHTML = '';
        labels.forEach((label, i) => {
            const dir = directionMap[label] ?? 0;
            const color = dir > 0 ? '#ef4444' : dir < 0 ? '#10b981' : '#64748b';
            const btn = document.createElement('button');
            btn.className = 'feat-axis-pill';
            btn.textContent = label;
            btn.style.setProperty('--pill-color', color);
            btn.addEventListener('click', () => {
                pillsCol.querySelectorAll('.feat-axis-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                showFeatureDescription(label, featureDescMap);
            });
            pillsCol.appendChild(btn);
        });
    }
}

/**
 * Show feature description panel
 */
function showFeatureDescription(label, descMap) {
    const panel = document.getElementById('feature-desc-panel');
    if (!panel) return;
    const info = descMap[label];
    if (!info) return;
    panel.innerHTML = `
        <div class="metric-desc-icon" style="background:${info.color}20; color:${info.color}">
            <i class="fas ${info.icon}"></i>
        </div>
        <h3 class="metric-desc-title" style="color:${info.color}">${label}</h3>
        <span class="feat-effect-badge" style="background:${info.color}15; color:${info.color}; border-color:${info.color}40">${info.effect}</span>
        <p class="metric-desc-body">${info.body}</p>
    `;
    panel.classList.add('visible');
}

