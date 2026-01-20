import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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

  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [lowStockItems, setLowStockItems] = useState([]);

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


  const fetchLowStockItems = async () => {
    try {
      console.log('📦 Fetching low stock items...');
      const response = await axios.get(`${API_BASE_URL}/api/items/all`);
      const allItems = response.data || [];
      
      // Filter items with low stock (stock > 0 and <= 10)
      const lowStock = allItems.filter(item => {
        const stock = Number(item.curstock || 0);
        return stock > 0 && stock <= 10;
      });
      
      console.log(`📦 Found ${lowStock.length} low stock items`);
      setLowStockItems(lowStock);
      setShowLowStockModal(true);
    } catch (error) {
      console.error('Error fetching low stock items:', error);
      // Show modal anyway with empty data
      setLowStockItems([]);
      setShowLowStockModal(true);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, trend, trendValue, onClick, clickable }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-xl shadow-lg p-6 border-l-4 ${color} ${
        clickable ? 'cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-200' : ''
      }`}
      onClick={clickable ? onClick : undefined}
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
          {clickable && (
            <p className="text-xs text-blue-600 mt-2 font-medium">Click to view details</p>
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
            clickable={true}
            onClick={fetchLowStockItems}
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
              onClick={() => navigate('/items/new')}
            />
            <QuickActionCard
              title="Record Purchase"
              description="Add a new purchase transaction"
              icon={FiShoppingCart}
              color="bg-green-500"
              onClick={() => navigate('/purchase/new')}
            />
            <QuickActionCard
              title="Process Return"
              description="Handle purchase returns"
              icon={FiRefreshCw}
              color="bg-orange-500"
              onClick={() => navigate('/purchase-return')}
            />
            <QuickActionCard
              title="ML Reports"
              description="View AI insights and forecasts"
              icon={FiBarChart2}
              color="bg-purple-500"
              onClick={() => navigate('/ml-reports')}
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

      {/* Low Stock Modal */}
      {showLowStockModal && (
        <LowStockModal 
          items={lowStockItems}
          onClose={() => setShowLowStockModal(false)}
          navigate={navigate}
        />
      )}
    </div>
  );
};

// Low Stock Modal Component
const LowStockModal = ({ items, onClose, navigate }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
              <FiAlertTriangle className="text-xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Low Stock Items</h2>
              <p className="text-sm text-gray-500">Items that need immediate attention (Stock ≤ 10)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-green-100 text-green-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <FiPackage className="text-2xl" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">All Good!</h3>
              <p className="text-gray-500">No items are currently low in stock.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-gray-600">
                  Found <span className="font-semibold text-red-600">{items.length}</span> items with low stock
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>Critical (≤ 5)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span>Low (6-10)</span>
                  </div>
                </div>
              </div>

              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 p-3 bg-gray-50 rounded-lg font-medium text-sm text-gray-700">
                <div className="col-span-1">Code</div>
                <div className="col-span-4">Item Name</div>
                <div className="col-span-2">Group</div>
                <div className="col-span-2">Brand</div>
                <div className="col-span-1 text-center">Stock</div>
                <div className="col-span-1 text-right">Cost</div>
                <div className="col-span-1 text-center">Status</div>
              </div>

              {/* Table Rows */}
              <div className="space-y-2">
                {items.map((item) => {
                  const stock = Number(item.curstock || 0);
                  const isCritical = stock <= 5;
                  return (
                    <div key={item.itemcode} className="grid grid-cols-12 gap-4 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="col-span-1 text-sm font-mono text-gray-600">
                        {item.itemcode}
                      </div>
                      <div className="col-span-4">
                        <p className="font-medium text-gray-900 text-sm">{item.itemname}</p>
                        <p className="text-xs text-gray-500">{item.model || 'N/A'}</p>
                      </div>
                      <div className="col-span-2 text-sm text-gray-600">
                        {item.groupname || 'N/A'}
                      </div>
                      <div className="col-span-2 text-sm text-gray-600">
                        {item.brandname || 'N/A'}
                      </div>
                      <div className="col-span-1 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          isCritical ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {stock}
                        </span>
                      </div>
                      <div className="col-span-1 text-right text-sm font-medium text-gray-900">
                        ₹{Number(item.cost || 0).toLocaleString()}
                      </div>
                      <div className="col-span-1 text-center">
                        <div className={`w-3 h-3 rounded-full mx-auto ${
                          isCritical ? 'bg-red-500' : 'bg-yellow-500'
                        }`}></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary Stats */}
              <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-red-600">{items.length}</p>
                    <p className="text-xs text-red-700">Total Items</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">
                      {items.filter(item => Number(item.curstock || 0) <= 5).length}
                    </p>
                    <p className="text-xs text-red-700">Critical</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">
                      ₹{items.reduce((sum, item) => sum + Number(item.cost || 0) * Number(item.curstock || 0), 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-red-700">Total Value</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            Items with stock ≤ 10 are considered low stock
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                // Navigate to items page
                navigate('/items');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Manage Items
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
