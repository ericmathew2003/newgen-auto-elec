import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FiRefreshCw,
  FiTrendingUp,
  FiBarChart2,
  FiCalendar
} from 'react-icons/fi';
import axios from 'axios';
import LoadingSpinner from './components/LoadingSpinner';
import API_BASE_URL from "./config/api";
import './components/Dashboard.css';

const MLReportsPage = () => {
  const [mlInsights, setMlInsights] = useState(null);
  const [loadingMlInsights, setLoadingMlInsights] = useState(false);
  const [revenueForecast, setRevenueForecast] = useState(null);
  const [loadingRevenueForecast, setLoadingRevenueForecast] = useState(false);
  const [seasonalPatterns, setSeasonalPatterns] = useState(null);
  const [loadingSeasonalPatterns, setLoadingSeasonalPatterns] = useState(false);

  useEffect(() => {
    fetchMlInsights();
    fetchRevenueForecast();
    fetchSeasonalPatterns();
  }, []);

  const fetchMlInsights = async () => {
    console.log('🤖 Starting ML insights fetch...');
    setLoadingMlInsights(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/ml/demand-overview?limit=15`);
      console.log('🤖 ML insights loaded:', response.data);
      
      const mlOverview = {
        summary: {
          totalItems: response.data.summary?.totalItems || 0,
          urgentItems: response.data.summary?.urgentItems || 0,
          highPriorityItems: response.data.summary?.highPriorityItems || 0,
          totalRecommendedOrders: response.data.summary?.totalRecommendedOrders || 0
        },
        topAlerts: response.data.forecasts?.slice(0, 3).map(item => ({
          itemcode: item.itemcode,
          itemname: item.itemname,
          currentStock: item.currentStock,
          forecast: {
            urgency: item.forecast.urgency,
            recommendedOrder: item.forecast.recommendedOrder,
            stockDuration: item.forecast.stockDuration,
            predictedDemand: item.forecast.predictedDemand
          }
        })) || [],
        insights: {
          totalPredictedDemand: response.data.forecasts?.reduce((sum, item) => sum + (item.forecast.predictedDemand || 0), 0) || 0,
          averageStockDuration: response.data.forecasts?.length > 0 ? 
            Math.round(response.data.forecasts.reduce((sum, item) => sum + (item.forecast.stockDuration || 0), 0) / response.data.forecasts.length) : 0,
          seasonalTrend: 'increasing',
          topCategory: 'Auto Parts'
        }
      };
      
      setMlInsights(mlOverview);
    } catch (error) {
      console.error('Error fetching ML insights:', error);
      setMlInsights(null);
    } finally {
      setLoadingMlInsights(false);
    }
  };

  const fetchRevenueForecast = async () => {
    console.log('🧠 Starting Neural Network revenue forecast...');
    setLoadingRevenueForecast(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/ml/revenue-forecast?months=6`);
      console.log('🧠 Neural Network forecast completed:', response.data);
      setRevenueForecast(response.data);
    } catch (error) {
      console.error('Error fetching revenue forecast:', error);
      setRevenueForecast(null);
    } finally {
      setLoadingRevenueForecast(false);
    }
  };

  const fetchSeasonalPatterns = async () => {
    console.log('🔍 Starting KNN seasonal pattern analysis...');
    setLoadingSeasonalPatterns(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/ml/seasonal-patterns?months=6`);
      console.log('🔍 KNN seasonal analysis completed:', response.data);
      setSeasonalPatterns(response.data);
    } catch (error) {
      console.error('Error fetching seasonal patterns:', error);
      setSeasonalPatterns(null);
    } finally {
      setLoadingSeasonalPatterns(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ML Reports & Analytics</h1>
          <p className="text-gray-600 mt-2">Advanced machine learning insights for your auto parts business</p>
        </div>

        {/* AI ML Insights Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-lg p-6 border border-blue-200 mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-blue-800 flex items-center">
              🤖 AI Demand Forecasting & Inventory Intelligence
              {loadingMlInsights && (
                <div className="ml-3 animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              )}
            </h3>
            <button
              onClick={fetchMlInsights}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiRefreshCw className="w-4 h-4" />
              <span>Refresh AI</span>
            </button>
          </div>

          {loadingMlInsights ? (
            <div className="text-center py-8">
              <div className="text-blue-600 text-lg">🧠 AI is analyzing your inventory patterns...</div>
              <p className="text-blue-500 text-sm mt-2">Processing sales data and market trends</p>
            </div>
          ) : mlInsights ? (
            <>
              {/* ML Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <div className="text-sm text-gray-600">Items Analyzed</div>
                  <div className="text-2xl font-bold text-blue-600">{mlInsights.summary.totalItems}</div>
                  <div className="text-xs text-green-600 mt-1">✓ AI Ready</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <div className="text-sm text-gray-600">Urgent Reorders</div>
                  <div className="text-2xl font-bold text-red-600">{mlInsights.summary.urgentItems}</div>
                  <div className="text-xs text-red-500 mt-1">⚠️ Action Needed</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <div className="text-sm text-gray-600">High Priority</div>
                  <div className="text-2xl font-bold text-orange-600">{mlInsights.summary.highPriorityItems}</div>
                  <div className="text-xs text-orange-500 mt-1">📈 Monitor Closely</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <div className="text-sm text-gray-600">Recommended Orders</div>
                  <div className="text-2xl font-bold text-green-600">{mlInsights.summary.totalRecommendedOrders}</div>
                  <div className="text-xs text-green-500 mt-1">🎯 Units Total</div>
                </div>
              </div>

              {/* Top Priority Items */}
              <div className="bg-white rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  🚨 Top Priority Items - AI Recommendations
                </h4>
                <div className="space-y-3">
                  {mlInsights.topAlerts.map((item, index) => (
                    <div key={index} className={`flex items-center justify-between p-3 rounded-lg border-l-4 ${
                      item.forecast.urgency === 'urgent' ? 'bg-red-50 border-red-500' :
                      item.forecast.urgency === 'high' ? 'bg-orange-50 border-orange-500' :
                      'bg-yellow-50 border-yellow-500'
                    }`}>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.itemname}</p>
                        <p className="text-sm text-gray-600">Current Stock: {item.currentStock} units</p>
                        <p className="text-xs text-gray-500">Stock Duration: {item.forecast.stockDuration} days</p>
                      </div>
                      <div className="text-right">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                          item.forecast.urgency === 'urgent' ? 'bg-red-100 text-red-800' :
                          item.forecast.urgency === 'high' ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {item.forecast.urgency.toUpperCase()}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          Order: {item.forecast.recommendedOrder} units
                        </p>
                        <p className="text-xs text-gray-500">Demand: {item.forecast.predictedDemand}/month</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Insights Summary */}
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  📊 AI Market Intelligence
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{mlInsights.insights.totalPredictedDemand}</div>
                    <div className="text-sm text-gray-600">Total Predicted Demand</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{mlInsights.insights.averageStockDuration} days</div>
                    <div className="text-sm text-gray-600">Avg Stock Duration</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-lg font-bold ${
                      mlInsights.insights.seasonalTrend === 'increasing' ? 'text-green-600' : 
                      mlInsights.insights.seasonalTrend === 'decreasing' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {mlInsights.insights.seasonalTrend === 'increasing' ? '📈' : 
                       mlInsights.insights.seasonalTrend === 'decreasing' ? '📉' : '➡️'} 
                      {mlInsights.insights.seasonalTrend}
                    </div>
                    <div className="text-sm text-gray-600">Market Trend</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">{mlInsights.insights.topCategory}</div>
                    <div className="text-sm text-gray-600">Top Category</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-500 text-lg">🤖 AI Analysis Unavailable</div>
              <p className="text-gray-400 text-sm mt-2">Unable to load ML insights. Please try refreshing.</p>
              <button
                onClick={fetchMlInsights}
                className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Retry AI Analysis
              </button>
            </div>
          )}
        </motion.div>

        {/* Neural Network Sales Revenue Forecasting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl shadow-lg p-6 border border-purple-200 mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-purple-800 flex items-center">
                🧠 Neural Network Sales Revenue Forecasting
                {loadingRevenueForecast && (
                  <div className="ml-3 animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                )}
              </h3>
              <p className="text-sm text-purple-600 mt-1">
                Algorithm: Neural Networks (Backpropagation) • Business Value: Cash Flow Planning & Business Decisions
              </p>
            </div>
            <button
              onClick={fetchRevenueForecast}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <FiRefreshCw className="w-4 h-4" />
              <span>Refresh Forecast</span>
            </button>
          </div>

          {loadingRevenueForecast ? (
            <div className="text-center py-8">
              <div className="text-purple-600 text-lg">🧠 Neural Network is processing sales patterns...</div>
              <p className="text-purple-500 text-sm mt-2">Analyzing historical data with backpropagation algorithm</p>
            </div>
          ) : revenueForecast ? (
            <>
              {/* Revenue Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <div className="text-sm text-gray-600">Total Forecasted Revenue</div>
                  <div className="text-2xl font-bold text-purple-600">
                    ₹{(revenueForecast.summary.totalForecastedRevenue / 100000).toFixed(1)}L
                  </div>
                  <div className="text-xs text-purple-500 mt-1">{revenueForecast.summary.forecastPeriod}</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <div className="text-sm text-gray-600">Avg Monthly Revenue</div>
                  <div className="text-2xl font-bold text-green-600">
                    ₹{(revenueForecast.summary.avgMonthlyRevenue / 1000).toFixed(0)}K
                  </div>
                  <div className="text-xs text-green-500 mt-1">Per Month</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <div className="text-sm text-gray-600">Projected Growth</div>
                  <div className={`text-2xl font-bold ${
                    revenueForecast.summary.projectedGrowth > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {revenueForecast.summary.projectedGrowth > 0 ? '+' : ''}{revenueForecast.summary.projectedGrowth}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">vs Current</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <div className="text-sm text-gray-600">Avg Confidence</div>
                  <div className="text-2xl font-bold text-blue-600">{revenueForecast.summary.avgConfidence}%</div>
                  <div className="text-xs text-blue-500 mt-1">Neural Network</div>
                </div>
              </div>

              {/* Monthly Revenue Forecasts */}
              <div className="bg-white rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  📈 Monthly Revenue Predictions - Neural Network Analysis
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {revenueForecast.forecasts.map((forecast, index) => (
                    <div key={index} className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium text-gray-900">
                            {new Date(forecast.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          </div>
                          <div className="text-lg font-bold text-purple-600">
                            ₹{(forecast.predictedRevenue / 1000).toFixed(0)}K
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          forecast.confidence >= 80 ? 'bg-green-100 text-green-800' :
                          forecast.confidence >= 70 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {forecast.confidence}% confidence
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>Seasonal: {forecast.factors.seasonal}x</div>
                        <div>Trend: {forecast.factors.trend}x</div>
                        <div>AOV: ₹{forecast.factors.avgOrderValue}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Business Insights */}
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  💡 Neural Network Business Insights
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">
                      {new Date(revenueForecast.insights.bestMonth.month + '-01').toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                    <div className="text-sm text-gray-600">Best Month</div>
                    <div className="text-xs text-green-600">₹{(revenueForecast.insights.bestMonth.predictedRevenue / 1000).toFixed(0)}K</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-600">
                      {new Date(revenueForecast.insights.worstMonth.month + '-01').toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                    <div className="text-sm text-gray-600">Lowest Month</div>
                    <div className="text-xs text-red-600">₹{(revenueForecast.insights.worstMonth.predictedRevenue / 1000).toFixed(0)}K</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-lg font-bold ${
                      revenueForecast.insights.trendDirection === 'Strong Growth' ? 'text-green-600' :
                      revenueForecast.insights.trendDirection === 'Moderate Growth' ? 'text-blue-600' :
                      revenueForecast.insights.trendDirection === 'Stable' ? 'text-gray-600' : 'text-red-600'
                    }`}>
                      {revenueForecast.insights.trendDirection === 'Strong Growth' ? '📈' :
                       revenueForecast.insights.trendDirection === 'Moderate Growth' ? '📊' :
                       revenueForecast.insights.trendDirection === 'Stable' ? '➡️' : '📉'}
                    </div>
                    <div className="text-sm text-gray-600">Trend Direction</div>
                    <div className="text-xs text-gray-500">{revenueForecast.insights.trendDirection}</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-lg font-bold ${
                      revenueForecast.insights.cashFlowImpact === 'Positive' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {revenueForecast.insights.cashFlowImpact === 'Positive' ? '💰' : '⚠️'}
                    </div>
                    <div className="text-sm text-gray-600">Cash Flow Impact</div>
                    <div className="text-xs text-gray-500">{revenueForecast.insights.cashFlowImpact}</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-500 text-lg">🧠 Neural Network Unavailable</div>
              <p className="text-gray-400 text-sm mt-2">Unable to load revenue forecast. Please try refreshing.</p>
              <button
                onClick={fetchRevenueForecast}
                className="mt-3 px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
              >
                Retry Neural Network
              </button>
            </div>
          )}
        </motion.div>

        {/* KNN Seasonal Pattern Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl shadow-lg p-6 border border-green-200 mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-green-800 flex items-center">
                🔍 KNN Seasonal Pattern Analysis
                {loadingSeasonalPatterns && (
                  <div className="ml-3 animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
                )}
              </h3>
              <p className="text-sm text-green-600 mt-1">
                Algorithm: K-Nearest Neighbors (KNN) • Business Value: Identify seasonal trends for auto parts inventory planning
              </p>
            </div>
            <button
              onClick={fetchSeasonalPatterns}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FiRefreshCw className="w-4 h-4" />
              <span>Refresh Analysis</span>
            </button>
          </div>

          {loadingSeasonalPatterns ? (
            <div className="text-center py-8">
              <div className="text-green-600 text-lg">🔍 KNN is analyzing seasonal patterns...</div>
              <p className="text-green-500 text-sm mt-2">Processing historical sales data with K-Nearest Neighbors algorithm</p>
            </div>
          ) : seasonalPatterns ? (
            <>
              {/* Seasonal Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <div className="text-sm text-gray-600">Peak Season</div>
                  <div className="text-2xl font-bold text-green-600">
                    {seasonalPatterns.summary.peakMonth.season}
                  </div>
                  <div className="text-xs text-green-500 mt-1">
                    Month {seasonalPatterns.summary.peakMonth.month} • {seasonalPatterns.summary.peakMonth.factor}x
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <div className="text-sm text-gray-600">Low Season</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {seasonalPatterns.summary.lowMonth.season}
                  </div>
                  <div className="text-xs text-blue-500 mt-1">
                    Month {seasonalPatterns.summary.lowMonth.month} • {seasonalPatterns.summary.lowMonth.factor}x
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <div className="text-sm text-gray-600">Seasonal Variation</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {seasonalPatterns.summary.seasonalVariation}x
                  </div>
                  <div className="text-xs text-orange-500 mt-1">{seasonalPatterns.summary.volatility} Volatility</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border">
                  <div className="text-sm text-gray-600">Avg Confidence</div>
                  <div className="text-2xl font-bold text-purple-600">{seasonalPatterns.summary.avgConfidence}%</div>
                  <div className="text-xs text-purple-500 mt-1">KNN Analysis</div>
                </div>
              </div>

              {/* Monthly Seasonal Patterns */}
              <div className="bg-white rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  📅 Monthly Seasonal Factors - KNN Predictions
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {seasonalPatterns.patterns.map((pattern, index) => (
                    <div key={index} className="p-3 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg border">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium text-gray-900">
                            {new Date(2024, pattern.month - 1, 1).toLocaleDateString('en-US', { month: 'long' })}
                          </div>
                          <div className={`text-lg font-bold ${
                            pattern.predictedSeasonalFactor > 1.2 ? 'text-green-600' :
                            pattern.predictedSeasonalFactor > 1.0 ? 'text-blue-600' :
                            pattern.predictedSeasonalFactor > 0.8 ? 'text-orange-600' : 'text-red-600'
                          }`}>
                            {pattern.predictedSeasonalFactor}x
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          pattern.confidence >= 80 ? 'bg-green-100 text-green-800' :
                          pattern.confidence >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {pattern.confidence}% confidence
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">
                        <div className="mb-1">{pattern.seasonalInsights.season} Season</div>
                        <div className="text-xs text-gray-500 truncate">
                          {pattern.seasonalInsights.seasonalTrend}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Business Strategy Insights */}
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  💡 KNN Business Strategy Insights
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                    <h5 className="font-medium text-green-800 mb-2">Peak Preparation</h5>
                    <p className="text-sm text-green-700">
                      {seasonalPatterns.businessInsights.seasonalStrategy.peakPreparation}
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                    <h5 className="font-medium text-blue-800 mb-2">Low Season Optimization</h5>
                    <p className="text-sm text-blue-700">
                      {seasonalPatterns.businessInsights.seasonalStrategy.lowSeasonOptimization}
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                    <h5 className="font-medium text-purple-800 mb-2">Overall Strategy</h5>
                    <p className="text-sm text-purple-700">
                      {seasonalPatterns.businessInsights.seasonalStrategy.overallStrategy}
                    </p>
                  </div>
                </div>
                
                {/* Data Quality Indicator */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Data Quality: </span>
                      <span className={`text-sm ${
                        seasonalPatterns.dataQuality.dataCompleteness >= 80 ? 'text-green-600' :
                        seasonalPatterns.dataQuality.dataCompleteness >= 50 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {seasonalPatterns.dataQuality.dataCompleteness}% Complete
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {seasonalPatterns.dataQuality.monthsCovered} months of data
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {seasonalPatterns.dataQuality.recommendedAction}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-500 text-lg">🔍 KNN Analysis Unavailable</div>
              <p className="text-gray-400 text-sm mt-2">Unable to load seasonal patterns. Please try refreshing.</p>
              <button
                onClick={fetchSeasonalPatterns}
                className="mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                Retry KNN Analysis
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default MLReportsPage;
