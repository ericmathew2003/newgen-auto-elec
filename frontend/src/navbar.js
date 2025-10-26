// components/Navbar.js
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiBox,
  FiChevronDown,
  FiChevronRight,
  FiShoppingCart,
  FiDollarSign,
  FiFileText,
  FiMenu,
  FiX,
  FiLogOut,
  FiHome,
  FiUser,
  FiSettings,
  FiBell,
  FiSun,
  FiMoon,
} from "react-icons/fi";
import { useDarkMode } from './contexts/DarkModeContext';
import logo2 from "./assets/logo2.png";

export default function Navbar() {
  const [masterOpen, setMasterOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const navigate = useNavigate();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    
    try {
      // Add a small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Clear any stored authentication data
      localStorage.removeItem('authToken');
      localStorage.removeItem('userSession');
      localStorage.removeItem('selectedPeriod');
      localStorage.removeItem('loginData');
      
      // Clear session storage as well
      sessionStorage.clear();
      
      // Navigate to entry page
      navigate('/');
      
      console.log("User logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      // Still navigate even if there's an error
      navigate('/');
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Enhanced Header */}
      <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-lg px-0 py-0 flex items-center justify-between z-50 backdrop-blur-sm bg-white/95 dark:bg-gray-800/95">
        {/* Left side - Menu button and Logo */}
        <div className="flex items-center space-x-6">
          <button
            onClick={toggleSidebar}
            className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-md group"
            title={sidebarOpen ? "Close Sidebar" : "Open Sidebar"}
          >
            {sidebarOpen ? (
              <FiX size={20} className="text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-gray-100" />
            ) : (
              <FiMenu size={20} className="text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-gray-100" />
            )}
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img 
                src={logo2} 
                alt="NewGen Logo" 
                className="w-10 h-10 rounded-lg shadow-sm" 
              />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">NewGen</h1>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Enterprise Solutions</span>
            </div>
          </div>
        </div>

        {/* Center - Empty space (search bar removed) */}
        <div className="flex-1"></div>

        {/* Right side - Dark Mode, Notifications, Profile, and Logout */}
        <div className="flex items-center space-x-4">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="relative p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-md group"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? (
              <FiSun size={20} className="text-yellow-500 group-hover:text-yellow-600" />
            ) : (
              <FiMoon size={20} className="text-gray-600 group-hover:text-gray-800 dark:text-gray-300" />
            )}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2.5 rounded-xl hover:bg-gray-100 transition-all duration-200 hover:shadow-md group"
              title="Notifications"
            >
              <FiBell size={20} className="text-gray-600 group-hover:text-gray-800" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">
                3
              </span>
            </button>
            
            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-50 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">New order received</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Order #12345 has been placed</p>
                  </div>
                  <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-50 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Inventory update</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Stock levels updated for 15 items</p>
                  </div>
                  <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">System maintenance</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Scheduled maintenance in 2 hours</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer group">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <FiUser size={16} className="text-white" />
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Admin User</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Administrator</p>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-medium"
          >
            <FiLogOut size={16} />
            <span className="hidden sm:block">Logout</span>
          </button>
        </div>
      </header>

      {/* Enhanced Sidebar */}
      <div
        className={`fixed left-0 top-20 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out z-40 shadow-xl ${
          sidebarOpen ? "w-72" : "w-0"
        }`}
      >
        <div className={`h-full overflow-y-auto overflow-x-hidden transition-opacity duration-300 sidebar-scroll ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
          <div className="p-6 pb-20">
          {/* Sidebar Header */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Navigation</h2>
            <div className="w-12 h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"></div>
          </div>

          <nav className="space-y-2">
            {/* Home */}
            <Link
              to="/home"
              className="flex items-center p-4 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/30 dark:hover:to-purple-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-200 group border border-transparent hover:border-blue-100 dark:hover:border-blue-800 text-gray-700 dark:text-gray-300"
            >
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors duration-200 mr-4">
                <FiHome size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <span className="font-medium">Dashboard</span>
            </Link>



            {/* Master Section */}
            <div className="space-y-2">
              <button
                onClick={() => setMasterOpen(!masterOpen)}
                className="flex items-center justify-between w-full p-4 rounded-xl hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 dark:hover:from-orange-900/30 dark:hover:to-red-900/30 hover:text-orange-700 dark:hover:text-orange-300 transition-all duration-200 group border border-transparent hover:border-orange-100 dark:hover:border-orange-800 text-gray-700 dark:text-gray-300"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors duration-200 mr-4">
                    <FiBox size={18} className="text-orange-600" />
                  </div>
                  <span className="font-medium">Master Data</span>
                </div>
                <div className="p-1 rounded-md bg-gray-100 group-hover:bg-orange-100 transition-colors duration-200">
                  {masterOpen ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
                </div>
              </button>

              {masterOpen && (
                <div className="ml-8 space-y-1 animate-fadeIn">
                  <Link
                    to="/groups"
                    className="flex items-center p-3 rounded-lg hover:bg-orange-50 hover:text-orange-700 transition-all duration-200 text-sm font-medium"
                  >
                    <div className="w-2 h-2 bg-orange-400 rounded-full mr-3"></div>
                    Groups
                  </Link>
                  <Link
                    to="/makes"
                    className="flex items-center p-3 rounded-lg hover:bg-orange-50 hover:text-orange-700 transition-all duration-200 text-sm font-medium"
                  >
                    <div className="w-2 h-2 bg-orange-400 rounded-full mr-3"></div>
                    Makes
                  </Link>
                  <Link
                    to="/brands"
                    className="flex items-center p-3 rounded-lg hover:bg-orange-50 hover:text-orange-700 transition-all duration-200 text-sm font-medium"
                  >
                    <div className="w-2 h-2 bg-orange-400 rounded-full mr-3"></div>
                    Brands
                  </Link>
                  <Link
                    to="/items"
                    className="flex items-center p-3 rounded-lg hover:bg-orange-50 hover:text-orange-700 transition-all duration-200 text-sm font-medium"
                  >
                    <div className="w-2 h-2 bg-orange-400 rounded-full mr-3"></div>
                    Item Master
                  </Link>
                  <Link
                    to="/suppliers"
                    className="flex items-center p-3 rounded-lg hover:bg-orange-50 hover:text-orange-700 transition-all duration-200 text-sm font-medium"
                  >
                    <div className="w-2 h-2 bg-orange-400 rounded-full mr-3"></div>
                    Suppliers
                  </Link>
                  <Link
                    to="/customers"
                    className="flex items-center p-3 rounded-lg hover:bg-orange-50 hover:text-orange-700 transition-all duration-200 text-sm font-medium"
                  >
                    <div className="w-2 h-2 bg-orange-400 rounded-full mr-3"></div>
                    Customers
                  </Link>
                </div>
              )}
            </div>

            {/* Other Navigation Items */}
            {/* Purchase Section */}
            <div className="space-y-2">
              <button
                onClick={() => setPurchaseOpen(!purchaseOpen)}
                className="flex items-center justify-between w-full p-4 rounded-xl hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 hover:text-green-700 transition-all duration-200 group border border-transparent hover:border-green-100"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors duration-200 mr-4">
                    <FiShoppingCart size={18} className="text-green-600" />
                  </div>
                  <span className="font-medium">Purchase</span>
                </div>
                <div className="p-1 rounded-md bg-gray-100 group-hover:bg-green-100 transition-colors duration-200">
                  {purchaseOpen ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
                </div>
              </button>

              {purchaseOpen && (
                <div className="ml-8 space-y-1 animate-fadeIn">
                  <Link
                    to="/purchase"
                    className="flex items-center p-3 rounded-lg hover:bg-green-50 hover:text-green-700 transition-all duration-200 text-sm font-medium"
                  >
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                    Purchase
                  </Link>
                  <Link
                    to="/purchase-return"
                    className="flex items-center p-3 rounded-lg hover:bg-green-50 hover:text-green-700 transition-all duration-200 text-sm font-medium"
                  >
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                    Purchase Return
                  </Link>
                </div>
              )}
            </div>

            <Link
              to="/sale"
              className="flex items-center p-4 rounded-xl hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 hover:text-emerald-700 transition-all duration-200 group border border-transparent hover:border-emerald-100"
            >
              <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors duration-200 mr-4">
                <FiDollarSign size={18} className="text-emerald-600" />
              </div>
              <span className="font-medium">Sales</span>
            </Link>

            {/* Reports Section */}
            <div className="space-y-2">
              <button
                onClick={() => setReportsOpen(!reportsOpen)}
                className="flex items-center justify-between w-full p-4 rounded-xl hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 hover:text-purple-700 transition-all duration-200 group border border-transparent hover:border-purple-100"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors duration-200 mr-4">
                    <FiFileText size={18} className="text-purple-600" />
                  </div>
                  <span className="font-medium">Reports</span>
                </div>
                <div className="p-1 rounded-md bg-gray-100 group-hover:bg-purple-100 transition-colors duration-200">
                  {reportsOpen ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
                </div>
              </button>

              {reportsOpen && (
                <div className="ml-8 space-y-1 animate-fadeIn">
                  <Link
                    to="/report"
                    className="flex items-center p-3 rounded-lg hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 text-sm font-medium"
                  >
                    <div className="w-2 h-2 bg-purple-400 rounded-full mr-3"></div>
                    GST Invoice Report
                  </Link>
                  <Link
                    to="/sales-purchase-reports"
                    className="flex items-center p-3 rounded-lg hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 text-sm font-medium"
                  >
                    <div className="w-2 h-2 bg-purple-400 rounded-full mr-3"></div>
                    Sales and Purchase Report
                  </Link>
                </div>
              )}
            </div>

            {/* Settings */}
            <Link
              to="/settings"
              className="flex items-center p-4 rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-slate-50 hover:text-gray-700 transition-all duration-200 group border border-transparent hover:border-gray-100 mt-8"
            >
              <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors duration-200 mr-4">
                <FiSettings size={18} className="text-gray-600" />
              </div>
              <span className="font-medium">Settings</span>
            </Link>
          </nav>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          sidebarOpen ? "ml-72" : "ml-0"
        }`}
      >
        <div className="pt-20 p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
          {/* Your page content will go here */}
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full mr-4">
                <FiLogOut className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Confirm Logout</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Are you sure you want to logout?</p>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                disabled={isLoggingOut}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoggingOut ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Logging out...
                  </>
                ) : (
                  'Logout'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add custom CSS for animations and scrollbar */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        /* Custom scrollbar styling */
        .sidebar-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 3px;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
      `}</style>
    </div>
  );
}
