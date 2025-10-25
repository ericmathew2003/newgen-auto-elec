import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FiPackage,
  FiShoppingCart,
  FiTrendingUp,
  FiUsers,
  FiDollarSign,
  FiBarChart2,
  FiRefreshCw,
  FiAlertTriangle,
  FiCalendar,
  FiArrowUp,
  FiArrowDown
} from 'react-icons/fi';
import axios from 'axios';
import { sampleDashboardData } from '../utils/sampleData';
import LoadingSpinner from './LoadingSpinner';
import API_BASE_URL from "../config/api";
import './Dashboard.css';

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    totalItems: 0,
    totalSuppliers: 0,
    totalPurchases: 0,
    totalReturns: 0,
    lowStockItems: 0,
    monthlyPurchases: 0,
    monthlyReturns: 0,
    recentTransactions: [],
    stockAlerts: [],
    topItems: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/dashboard/stats`);
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Use sample data as fallback
      setDashboardData(sampleDashboardData);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, trend, trendValue }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-xl shadow-lg p-6 border-l-4 ${color}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {trend && (
            <div className={`flex items-center mt-2 text-sm ${
              trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              {trend === 'up' ? <FiArrowUp /> : <FiArrowDown />}
              <span className="ml-1">{trendValue}% from last month</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-full ${color.replace('border-l-4', 'bg-opacity-10')}`}>
          <Icon className={`w-8 h-8 ${color.replace('border-l-4 border-', 'text-')}`} />
        </div>
      </div>
    </motion.div>
  );

  const QuickActionCard = ({ title, description, icon: Icon, onClick, color }) => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow"
      onClick={onClick}
    >
      <div className="flex items-center">
        <div className={`p-3 rounded-full ${color} bg-opacity-10 mr-4`}>
          <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-gray-600 text-sm">{description}</p>
        </div>
      </div>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back! Here's what's happening with your inventory.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Items"
            value={dashboardData.totalItems.toLocaleString()}
            icon={FiPackage}
            color="border-blue-500"
          />
          <StatCard
            title="Total Suppliers"
            value={dashboardData.totalSuppliers.toLocaleString()}
            icon={FiUsers}
            color="border-green-500"
          />
          <StatCard
            title="Monthly Purchases"
            value={dashboardData.monthlyPurchases > 0 ? `₹${dashboardData.monthlyPurchases.toLocaleString()}` : '₹0'}
            icon={FiShoppingCart}
            color="border-purple-500"
          />
          <StatCard
            title="Low Stock Alerts"
            value={dashboardData.lowStockItems}
            icon={FiAlertTriangle}
            color={dashboardData.lowStockItems > 0 ? "border-red-500" : "border-gray-300"}
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <QuickActionCard
              title="Add New Item"
              description="Register a new inventory item"
              icon={FiPackage}
              color="bg-blue-500"
              onClick={() => window.location.href = '/items/new'}
            />
            <QuickActionCard
              title="Record Purchase"
              description="Add a new purchase transaction"
              icon={FiShoppingCart}
              color="bg-green-500"
              onClick={() => window.location.href = '/purchases/new'}
            />
            <QuickActionCard
              title="Process Return"
              description="Handle purchase returns"
              icon={FiRefreshCw}
              color="bg-orange-500"
              onClick={() => window.location.href = '/returns/new'}
            />
          </div>
        </div>

        {/* Charts and Tables Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Transactions */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
              <FiBarChart2 className="w-5 h-5 text-gray-500" />
            </div>
            <div className="space-y-3">
              {dashboardData.recentTransactions.length > 0 ? (
                dashboardData.recentTransactions.map((transaction, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{transaction.type}</p>
                      <p className="text-sm text-gray-600">{transaction.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">₹{transaction.amount}</p>
                      <p className="text-sm text-gray-600">{transaction.party}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FiCalendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No recent transactions</p>
                  <p className="text-sm mt-2">Start by adding some purchase or sales data</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Stock Alerts */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Stock Alerts</h3>
              <FiAlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div className="space-y-3">
              {dashboardData.stockAlerts.length > 0 ? (
                dashboardData.stockAlerts.map((alert, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border-l-4 border-red-500">
                    <div>
                      <p className="font-medium text-gray-900">{alert.itemName}</p>
                      <p className="text-sm text-gray-600">Current Stock: {alert.currentStock}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                        Low Stock
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FiPackage className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>{dashboardData.totalItems > 0 ? 'All items are well stocked' : 'No items in inventory yet'}</p>
                  {dashboardData.totalItems === 0 && (
                    <p className="text-sm mt-2">Add some inventory items to get started</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Performance Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Performance Overview</h3>
            <button
              onClick={fetchDashboardData}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiRefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <FiTrendingUp className="w-8 h-8 text-blue-600" />
              </div>
              <h4 className="font-semibold text-gray-900">Sales Growth</h4>
              <p className="text-2xl font-bold text-blue-600 mt-1">+15.3%</p>
              <p className="text-sm text-gray-600">vs last month</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <FiDollarSign className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="font-semibold text-gray-900">Revenue</h4>
              <p className="text-2xl font-bold text-green-600 mt-1">₹2.4L</p>
              <p className="text-sm text-gray-600">this month</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <FiPackage className="w-8 h-8 text-purple-600" />
              </div>
              <h4 className="font-semibold text-gray-900">Inventory Turnover</h4>
              <p className="text-2xl font-bold text-purple-600 mt-1">4.2x</p>
              <p className="text-sm text-gray-600">annual rate</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;