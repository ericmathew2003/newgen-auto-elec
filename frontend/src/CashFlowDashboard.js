import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CashFlowAnalytics from './CashFlowAnalytics';
import WhatIfSimulation from './WhatIfSimulation';

const ML_API_URL = 'http://localhost:8001';

const CashFlowDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);
  const [daysAhead, setDaysAhead] = useState(30);
  const [activeTab, setActiveTab] = useState('overview');
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  
  // New state for analytics
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [paymentPatterns, setPaymentPatterns] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  
  // Track viewed tabs to hide badges after viewing
  const [viewedAnomalies, setViewedAnomalies] = useState(false);
  const [viewedRecommendations, setViewedRecommendations] = useState(false);
  const [viewedPatterns, setViewedPatterns] = useState(false);

  useEffect(() => {
    fetchPrediction();
    fetchAnalytics();
  }, [daysAhead]);
  
  // Mark tabs as viewed when opened
  useEffect(() => {
    if (activeTab === 'anomalies' && anomalies.length > 0) {
      setViewedAnomalies(true);
    }
    if (activeTab === 'recommendations' && prediction?.recommendations?.length > 0) {
      setViewedRecommendations(true);
    }
    if (activeTab === 'patterns' && prediction?.patterns?.patterns?.length > 0) {
      setViewedPatterns(true);
    }
  }, [activeTab, anomalies.length, prediction]);
  
  // Reset viewed states when new data is fetched
  useEffect(() => {
    setViewedAnomalies(false);
  }, [anomalies]);
  
  useEffect(() => {
    setViewedRecommendations(false);
    setViewedPatterns(false);
  }, [prediction]);

  const fetchPrediction = async () => {
    setLoading(true);
    setError(null);
    setDismissedAlerts([]); // Reset dismissed alerts when fetching new predictions
    try {
      const response = await axios.post(`${ML_API_URL}/predict`, {
        days_ahead: daysAhead
      });
      setPrediction(response.data);
    } catch (err) {
      // If prediction fails, try training first
      if (err.response?.status === 500 || !prediction) {
        console.log('Prediction failed, attempting to train model first...');
        try {
          const trainResponse = await axios.post(`${ML_API_URL}/train`);
          
          // Check if training was successful
          if (!trainResponse.data.success) {
            setError(`Insufficient data: ${trainResponse.data.message}. You have ${trainResponse.data.data_points} days of data, but need at least 30 days of transaction history.`);
            setLoading(false);
            return;
          }
          
          // Retry prediction after training
          const retryResponse = await axios.post(`${ML_API_URL}/predict`, {
            days_ahead: daysAhead
          });
          setPrediction(retryResponse.data);
        } catch (trainErr) {
          setError(trainErr.response?.data?.detail || 'Failed to fetch prediction. Make sure ML service is running on port 8001.');
          console.error('Error training and predicting:', trainErr);
        }
      } else {
        setError(err.response?.data?.detail || 'Failed to fetch prediction. Make sure ML service is running on port 8001.');
        console.error('Error fetching prediction:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const trainModel = async () => {
    setLoading(true);
    try {
      await axios.post(`${ML_API_URL}/train`);
      alert('Model trained successfully!');
      fetchPrediction();
    } catch (err) {
      alert('Failed to train model: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const [customersRes, suppliersRes, patternsRes, anomaliesRes, alertsRes] = await Promise.all([
        axios.get(`${ML_API_URL}/analytics/customers?days=90`).catch(() => ({ data: { top_customers: [] } })),
        axios.get(`${ML_API_URL}/analytics/suppliers?days=90`).catch(() => ({ data: { top_suppliers: [] } })),
        axios.get(`${ML_API_URL}/analytics/payment-patterns?days=90`).catch(() => ({ data: { late_payers: [] } })),
        axios.get(`${ML_API_URL}/analytics/anomalies?days=90`).catch(() => ({ data: { anomalies: [] } })),
        axios.get(`${ML_API_URL}/alerts/history?limit=50`).catch(() => ({ data: { alerts: [] } }))
      ]);

      setCustomers(customersRes.data.top_customers || []);
      setSuppliers(suppliersRes.data.top_suppliers || []);
      setPaymentPatterns(patternsRes.data.late_payers || []);
      setAnomalies(anomaliesRes.data.anomalies || []);
      setAlertHistory(alertsRes.data.alerts || []);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  const runWhatIfSimulation = async (scenarios) => {
    try {
      const response = await axios.post(`${ML_API_URL}/predict`, {
        days_ahead: daysAhead,
        scenarios: scenarios
      });
      
      return response.data.scenario_analysis;
    } catch (err) {
      console.error('Error running simulation:', err);
      alert('Failed to run simulation: ' + (err.response?.data?.detail || err.message));
      return null;
    }
  };

  const clearAlerts = async () => {
    if (!window.confirm('Are you sure you want to clear all alert history?')) {
      return;
    }
    
    try {
      await axios.delete(`${ML_API_URL}/alerts/clear`);
      setAlertHistory([]);
      alert('Alert history cleared successfully!');
    } catch (err) {
      console.error('Error clearing alerts:', err);
      alert('Failed to clear alerts: ' + (err.response?.data?.detail || err.message));
    }
  };

  const dismissAlert = (alertIndex) => {
    setDismissedAlerts([...dismissedAlerts, alertIndex]);
  };

  const getRiskColor = (level) => {
    const colors = {
      'LOW': 'text-green-600 bg-green-50',
      'MEDIUM': 'text-yellow-600 bg-yellow-50',
      'HIGH': 'text-orange-600 bg-orange-50',
      'CRITICAL': 'text-red-600 bg-red-50'
    };
    return colors[level] || 'text-gray-600 bg-gray-50';
  };

  const getAlertColor = (type) => {
    const colors = {
      'CRITICAL': 'border-red-500 bg-red-50',
      'WARNING': 'border-yellow-500 bg-yellow-50',
      'INFO': 'border-blue-500 bg-blue-50'
    };
    return colors[type] || 'border-gray-500 bg-gray-50';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading && !prediction) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading cash flow prediction...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error Loading Prediction</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchPrediction}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!prediction) return null;

  const { summary, risk_assessment, alerts, recommendations, predictions, patterns } = prediction;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cash Flow Prediction</h1>
          <p className="text-gray-600 mt-1">AI-powered 30-day cash flow forecast</p>
        </div>
        <div className="flex gap-3">
          <select
            value={daysAhead}
            onChange={(e) => setDaysAhead(Number(e.target.value))}
            className="px-4 py-2 border rounded-lg"
          >
            <option value={7}>7 Days</option>
            <option value={15}>15 Days</option>
            <option value={30}>30 Days</option>
            <option value={60}>60 Days</option>
          </select>
          <button
            onClick={trainModel}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Train Model
          </button>
          <button
            onClick={fetchPrediction}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Current Balance</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(summary.current_balance)}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Predicted Balance ({daysAhead} days)</div>
          <div className={`text-2xl font-bold ${summary.predicted_final_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(summary.predicted_final_balance)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {summary.net_change >= 0 ? '+' : ''}{formatCurrency(summary.net_change)}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Min Balance</div>
          <div className={`text-2xl font-bold ${summary.min_balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
            {formatCurrency(summary.min_balance)}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Risk Level</div>
          <div className={`text-2xl font-bold ${getRiskColor(risk_assessment.risk_level)}`}>
            {risk_assessment.risk_level}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Score: {risk_assessment.risk_score}/100
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts && alerts.filter((_, idx) => !dismissedAlerts.includes(idx)).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <span className="text-red-600 mr-2">⚠️</span>
            Alerts ({alerts.filter((_, idx) => !dismissedAlerts.includes(idx)).length})
          </h2>
          <div className="space-y-3">
            {alerts.slice(0, 5).map((alert, idx) => (
              !dismissedAlerts.includes(idx) && (
                <div key={idx} className={`border-l-4 p-4 rounded ${getAlertColor(alert.type)} relative`}>
                  <button
                    onClick={() => dismissAlert(idx)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Dismiss alert"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div className="flex items-start justify-between pr-8">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{alert.title}</div>
                      <div className="text-sm text-gray-700 mt-1">{alert.message}</div>
                      <div className="text-sm text-gray-600 mt-2">
                        <span className="font-medium">Action:</span> {alert.action}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 ml-4">
                      Day {alert.day}
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <div className="flex space-x-8 px-6">
            {['overview', 'predictions', 'recommendations', 'patterns', 'anomalies', 'whatif', 'analytics'].map((tab) => {
              // Get count for specific tabs
              let count = 0;
              let showBadge = false;
              let badgeColor = 'bg-blue-600';
              
              if (tab === 'anomalies' && anomalies && anomalies.length > 0 && !viewedAnomalies) {
                count = anomalies.length;
                showBadge = true;
                // Color based on severity
                const hasCritical = anomalies.some(a => a.severity === 'CRITICAL');
                const hasHigh = anomalies.some(a => a.severity === 'HIGH');
                badgeColor = hasCritical ? 'bg-red-600' : hasHigh ? 'bg-orange-600' : 'bg-yellow-600';
              } else if (tab === 'recommendations' && recommendations && recommendations.length > 0 && !viewedRecommendations) {
                count = recommendations.length;
                showBadge = true;
                badgeColor = 'bg-green-600';
              } else if (tab === 'patterns' && patterns && patterns.patterns && patterns.patterns.length > 0 && !viewedPatterns) {
                count = patterns.patterns.length;
                showBadge = true;
                badgeColor = 'bg-purple-600';
              }
              
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 px-2 border-b-2 font-medium text-sm relative ${
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span className="flex items-center">
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {showBadge && (
                      <span className={`ml-2 px-2 py-0.5 text-xs font-bold text-white rounded-full ${badgeColor} ${
                        activeTab === tab ? 'animate-pulse' : ''
                      }`}>
                        {count}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Cash Flow Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Total Inflow</span>
                      <span className="font-semibold text-green-600">{formatCurrency(summary.total_inflow)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Total Outflow</span>
                      <span className="font-semibold text-red-600">{formatCurrency(summary.total_outflow)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Net Change</span>
                      <span className={`font-semibold ${summary.net_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(summary.net_change)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">Avg Daily Inflow</span>
                      <span className="font-semibold">{formatCurrency(summary.avg_daily_inflow)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">Avg Daily Outflow</span>
                      <span className="font-semibold">{formatCurrency(summary.avg_daily_outflow)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Risk Assessment</h3>
                  <div className="space-y-3">
                    <div className={`p-4 rounded-lg ${getRiskColor(risk_assessment.risk_level)}`}>
                      <div className="text-sm font-medium mb-1">Overall Risk</div>
                      <div className="text-2xl font-bold">{risk_assessment.risk_level}</div>
                      <div className="text-sm mt-2">{risk_assessment.overall_assessment}</div>
                    </div>
                    
                    {risk_assessment.risk_factors && risk_assessment.risk_factors.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-700">Risk Factors:</div>
                        {risk_assessment.risk_factors.map((factor, idx) => (
                          <div key={idx} className="text-sm bg-gray-50 p-3 rounded">
                            <div className="font-medium text-gray-900">{factor.factor}</div>
                            <div className="text-gray-600 text-xs mt-1">{factor.description}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Business Insights - Industry Specific */}
              {prediction.business_insights && prediction.business_insights.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3 flex items-center">
                    <span className="text-blue-600 mr-2">🏪</span>
                    Business Health Metrics
                    {prediction.industry && (
                      <span className="ml-2 text-sm font-normal text-gray-500">({prediction.industry})</span>
                    )}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {prediction.business_insights.map((insight, idx) => (
                      <div key={idx} className={`p-4 rounded-lg border-2 ${
                        insight.status === 'good' ? 'border-green-200 bg-green-50' :
                        insight.status === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                        'border-red-200 bg-red-50'
                      }`}>
                        <div className="text-sm text-gray-600 mb-1">{insight.metric}</div>
                        <div className={`text-2xl font-bold ${
                          insight.status === 'good' ? 'text-green-700' :
                          insight.status === 'warning' ? 'text-yellow-700' :
                          'text-red-700'
                        }`}>
                          {insight.value}
                        </div>
                        <div className="mt-2 flex items-center">
                          <span className={`w-2 h-2 rounded-full mr-2 ${
                            insight.status === 'good' ? 'bg-green-500' :
                            insight.status === 'warning' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}></span>
                          <span className="text-xs text-gray-600">
                            {insight.status === 'good' ? 'Healthy' :
                             insight.status === 'warning' ? 'Needs Attention' :
                             'Critical'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Predictions Tab */}
          {activeTab === 'predictions' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Daily Predictions</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Inflow</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outflow</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Flow</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {predictions.map((pred) => (
                      <tr key={pred.day} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{pred.day}</td>
                        <td className="px-4 py-3 text-sm">{pred.date}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600">
                          {formatCurrency(pred.predicted_inflow)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-red-600">
                          {formatCurrency(pred.predicted_outflow)}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${pred.net_flow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(pred.net_flow)}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-semibold ${pred.predicted_balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                          {formatCurrency(pred.predicted_balance)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          {pred.confidence.toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recommendations Tab */}
          {activeTab === 'recommendations' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">AI Recommendations</h3>
              {recommendations && recommendations.length > 0 ? (
                <div className="space-y-4">
                  {recommendations.map((rec, idx) => (
                    <div key={idx} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                            rec.priority === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                            rec.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {rec.priority}
                          </span>
                          <span className="ml-2 text-xs text-gray-500">{rec.category}</span>
                        </div>
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-2">{rec.recommendation}</h4>
                      <p className="text-sm text-gray-600 mb-3">{rec.description}</p>
                      <div className="bg-green-50 border border-green-200 rounded p-3 mb-3">
                        <div className="text-xs font-medium text-green-800 mb-1">Expected Impact</div>
                        <div className="text-sm text-green-700">{rec.expected_impact}</div>
                      </div>
                      {rec.action_items && rec.action_items.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-gray-700 mb-2">Action Items:</div>
                          <ul className="list-disc list-inside space-y-1">
                            {rec.action_items.map((item, i) => (
                              <li key={i} className="text-sm text-gray-600">{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No specific recommendations at this time.</p>
                  <p className="text-sm mt-2">Your cash flow appears healthy!</p>
                </div>
              )}
            </div>
          )}

          {/* Patterns Tab */}
          {activeTab === 'patterns' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Detailed Cash Flow Patterns</h3>
              {patterns && patterns.status === 'success' && patterns.patterns.length > 0 ? (
                <div className="space-y-4">
                  {patterns.patterns.map((pattern, idx) => (
                    <div key={idx} className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 text-2xl mr-3">
                          {pattern.type.includes('Weekly') ? '📅' :
                           pattern.type.includes('Trend') ? '📈' :
                           pattern.type.includes('Volatility') || pattern.type.includes('Stable') ? '📊' :
                           pattern.type.includes('Balance') ? '⚖️' :
                           pattern.type.includes('Peak') ? '🎯' : '📊'}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-1">{pattern.type}</h4>
                          <p className="text-sm text-gray-700 mb-2">{pattern.description}</p>
                          <div className="bg-white border border-blue-200 rounded p-3 mb-3">
                            <div className="text-xs font-medium text-blue-800 mb-1">💡 Insight</div>
                            <div className="text-sm text-gray-700">{pattern.insight}</div>
                          </div>
                          
                          {/* Show detailed breakdown if available */}
                          {pattern.details && pattern.details.weekly_breakdown && (
                            <div className="mt-3 bg-white rounded p-3 border border-gray-200">
                              <div className="text-xs font-medium text-gray-700 mb-2">Weekly Breakdown:</div>
                              <div className="grid grid-cols-7 gap-1 text-xs">
                                {pattern.details.weekly_breakdown.map((day, dayIdx) => (
                                  <div key={dayIdx} className={`p-2 rounded text-center ${
                                    day.avg_net >= 0 ? 'bg-green-50' : 'bg-red-50'
                                  }`}>
                                    <div className="font-medium text-gray-700">{day.day.substring(0, 3)}</div>
                                    <div className={`text-xs font-semibold ${
                                      day.avg_net >= 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {formatCurrency(day.avg_net)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Show best/worst days if available */}
                          {pattern.details && pattern.details.best_days && (
                            <div className="mt-3 grid grid-cols-2 gap-3">
                              <div className="bg-green-50 rounded p-3 border border-green-200">
                                <div className="text-xs font-medium text-green-800 mb-2">🏆 Best Days</div>
                                {pattern.details.best_days.slice(0, 3).map((day, i) => (
                                  <div key={i} className="text-xs mb-1">
                                    <span className="text-gray-600">{day.date}:</span>
                                    <span className="font-semibold text-green-700 ml-1">{formatCurrency(day.net_flow)}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="bg-red-50 rounded p-3 border border-red-200">
                                <div className="text-xs font-medium text-red-800 mb-2">⚠️ Worst Days</div>
                                {pattern.details.worst_days.slice(0, 3).map((day, i) => (
                                  <div key={i} className="text-xs mb-1">
                                    <span className="text-gray-600">{day.date}:</span>
                                    <span className="font-semibold text-red-700 ml-1">{formatCurrency(day.net_flow)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Show balance details if available */}
                          {pattern.details && pattern.details.total_inflow && (
                            <div className="mt-3 bg-white rounded p-3 border border-gray-200">
                              <div className="grid grid-cols-3 gap-3 text-xs">
                                <div>
                                  <div className="text-gray-600">Total Inflow</div>
                                  <div className="font-semibold text-green-600">{formatCurrency(pattern.details.total_inflow)}</div>
                                </div>
                                <div>
                                  <div className="text-gray-600">Total Outflow</div>
                                  <div className="font-semibold text-red-600">{formatCurrency(pattern.details.total_outflow)}</div>
                                </div>
                                <div>
                                  <div className="text-gray-600">Net Position</div>
                                  <div className={`font-semibold ${pattern.details.net_position >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(pattern.details.net_position)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Insufficient data to identify patterns.</p>
                  <p className="text-sm mt-2">Need at least 7 days of transaction history.</p>
                </div>
              )}
            </div>
          )}

          {/* Anomalies Tab - Intelligent Anomaly Detection */}
          {activeTab === 'anomalies' && (
            <div>
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-800 flex items-center">
                  <span className="text-purple-600 mr-3">🔍</span>
                  Anomaly Detection - Unusual Transactions
                </h3>
                <p className="text-gray-600 mt-2">
                  Intelligent detection of unusual cash flow patterns with business context analysis
                </p>
              </div>

              {anomalies && anomalies.length > 0 ? (
                <div className="space-y-4">
                  {anomalies.map((anomaly, idx) => (
                    <div key={idx} className={`border-l-4 p-5 rounded-lg shadow-sm ${
                      anomaly.severity === 'CRITICAL' ? 'border-red-500 bg-red-50' :
                      anomaly.severity === 'HIGH' ? 'border-orange-500 bg-orange-50' :
                      anomaly.severity === 'MEDIUM' ? 'border-yellow-500 bg-yellow-50' :
                      anomaly.severity === 'WARNING' ? 'border-yellow-500 bg-yellow-50' :
                      'border-blue-500 bg-blue-50'
                    }`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <span className={`px-3 py-1 text-xs font-bold rounded-full mr-2 ${
                              anomaly.severity === 'CRITICAL' ? 'bg-red-600 text-white' :
                              anomaly.severity === 'HIGH' ? 'bg-orange-600 text-white' :
                              anomaly.severity === 'MEDIUM' ? 'bg-yellow-600 text-white' :
                              anomaly.severity === 'WARNING' ? 'bg-yellow-500 text-white' :
                              'bg-blue-600 text-white'
                            }`}>
                              {anomaly.severity}
                            </span>
                            <span className="text-sm font-semibold text-gray-800">
                              {anomaly.type.replace(/_/g, ' ')}
                            </span>
                            {anomaly.z_score && (
                              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded">
                                Z-Score: {anomaly.z_score}
                              </span>
                            )}
                          </div>
                          <div className="text-base font-medium text-gray-900 mb-2">
                            {anomaly.description}
                          </div>
                          <div className="text-xs text-gray-600 mb-3">
                            <span className="font-medium">Expected range:</span> {anomaly.expected_range}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-lg font-bold text-gray-900">
                            ₹{anomaly.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{anomaly.date}</div>
                        </div>
                      </div>

                      {/* Transaction Details */}
                      {anomaly.journal_serial && (
                        <div className="mt-3 pt-3 border-t border-gray-300">
                          <div className="text-xs font-semibold text-gray-700 mb-2">📋 Transaction Details</div>
                          <div className="grid grid-cols-2 gap-3 text-xs bg-white bg-opacity-50 p-3 rounded">
                            <div>
                              <span className="font-semibold text-gray-700">Journal Serial:</span>
                              <span className="ml-2 text-gray-900 font-mono">{anomaly.journal_serial}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-700">Document Type:</span>
                              <span className="ml-2 text-gray-900">{anomaly.document_type}</span>
                            </div>
                            {anomaly.document_ref && (
                              <div>
                                <span className="font-semibold text-gray-700">Reference:</span>
                                <span className="ml-2 text-gray-900">{anomaly.document_ref}</span>
                              </div>
                            )}
                            {anomaly.line_count && (
                              <div>
                                <span className="font-semibold text-gray-700">Entry Lines:</span>
                                <span className="ml-2 text-gray-900">{anomaly.line_count}</span>
                              </div>
                            )}
                            {anomaly.narration && (
                              <div className="col-span-2">
                                <span className="font-semibold text-gray-700">Narration:</span>
                                <div className="ml-2 text-gray-900 mt-1 italic">"{anomaly.narration}"</div>
                              </div>
                            )}
                            {anomaly.accounts && (
                              <div className="col-span-2">
                                <span className="font-semibold text-gray-700">Accounts Involved:</span>
                                <div className="ml-2 text-gray-900 mt-1">{anomaly.accounts}</div>
                              </div>
                            )}
                            {anomaly.account_natures && (
                              <div className="col-span-2">
                                <span className="font-semibold text-gray-700">Account Types:</span>
                                <div className="ml-2 text-gray-700 mt-1 font-mono text-xs">{anomaly.account_natures}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Analysis Section */}
                      {anomaly.analysis && (
                        <div className="mt-3 pt-3 border-t border-gray-300">
                          <div className="text-xs font-semibold text-gray-700 mb-2">🔬 Analysis</div>
                          <div className="bg-white bg-opacity-50 p-3 rounded text-xs">
                            {anomaly.analysis.indicators && anomaly.analysis.indicators.length > 0 && (
                              <div className="mb-2">
                                <div className="font-semibold text-gray-700 mb-1">Indicators:</div>
                                <ul className="list-disc list-inside space-y-1 text-gray-800">
                                  {anomaly.analysis.indicators.map((indicator, i) => (
                                    <li key={i}>{indicator}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {anomaly.analysis.recommended_actions && anomaly.analysis.recommended_actions.length > 0 && (
                              <div>
                                <div className="font-semibold text-gray-700 mb-1">Recommended Actions:</div>
                                <ul className="list-disc list-inside space-y-1 text-gray-800">
                                  {anomaly.analysis.recommended_actions.map((action, i) => (
                                    <li key={i}>{action}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Fraud Indicators */}
                      {anomaly.fraud_indicators && anomaly.fraud_indicators.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-red-300">
                          <div className="text-xs font-semibold text-red-700 mb-2">⚠️ Fraud Risk Indicators</div>
                          <div className="bg-red-100 bg-opacity-50 p-3 rounded">
                            <ul className="list-disc list-inside space-y-1 text-xs text-red-800">
                              {anomaly.fraud_indicators.map((indicator, i) => (
                                <li key={i} className="font-medium">{indicator}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* Requires Review Badge */}
                      {anomaly.requires_review && (
                        <div className="mt-3 pt-3 border-t border-gray-300">
                          <div className="flex items-center text-xs">
                            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full font-semibold">
                              ⚠️ Requires Management Review
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-green-50 rounded-lg border-2 border-green-200">
                  <div className="text-6xl mb-4">✅</div>
                  <p className="text-xl font-semibold text-green-800">No anomalies detected</p>
                  <p className="text-sm text-green-600 mt-2">All transactions are within normal ranges</p>
                  <p className="text-xs text-gray-500 mt-4">
                    The system monitors for unusual patterns, fraud indicators, and suspicious transactions
                  </p>
                </div>
              )}
            </div>
          )}

          {/* What-If Simulation Tab */}
          {activeTab === 'whatif' && prediction && (
            <WhatIfSimulation
              basePrediction={prediction}
              onRunSimulation={runWhatIfSimulation}
            />
          )}

          {/* Analytics Tab - NEW! */}
          {activeTab === 'analytics' && (
            <CashFlowAnalytics
              customers={customers}
              suppliers={suppliers}
              paymentPatterns={paymentPatterns}
              anomalies={anomalies}
              alertHistory={alertHistory}
              onClearAlerts={clearAlerts}
            />
          )}
        </div>
      </div>

      {/* Model Info Footer */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium">Algorithm:</span> {prediction.model_info?.algorithm || 'Random Forest + Gradient Boosting'}
          </div>
          <div>
            <span className="font-medium">Training Data:</span> {prediction.model_info?.training_data_points || 0} days
          </div>
          <div>
            <span className="font-medium">Model Status:</span>{' '}
            <span className={prediction.model_info?.is_fitted ? 'text-green-600' : 'text-yellow-600'}>
              {prediction.model_info?.is_fitted ? 'Trained' : 'Not Trained'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashFlowDashboard;
