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
  FiBell
} from "react-icons/fi";

export default function Navbar() {
  const [masterOpen, setMasterOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const navigate = useNavigate();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleLogout = () => {
    try {
      // Clear auth/session data
      localStorage.removeItem("token");
      // Optionally clear other session keys if used (e.g., period)
      // localStorage.removeItem("selectedPeriod");
    } catch {}
    // Navigate to entry page
    navigate("/");
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Enhanced Header */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-lg px-0 py-0 flex items-center justify-between z-50 backdrop-blur-sm bg-white/95">
        {/* Left side - Menu button and Logo */}
        <div className="flex items-center space-x-6">
          <button
            onClick={toggleSidebar}
            className="p-2.5 rounded-xl hover:bg-gray-100 transition-all duration-200 hover:shadow-md group"
            title={sidebarOpen ? "Close Sidebar" : "Open Sidebar"}
          >
            {sidebarOpen ? (
              <FiX size={20} className="text-gray-600 group-hover:text-gray-800" />
            ) : (
              <FiMenu size={20} className="text-gray-600 group-hover:text-gray-800" />
            )}
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img 
                src="/logo2.png" 
                alt="NewGen Logo" 
                className="w-10 h-10 rounded-lg shadow-sm" 
              />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">NewGen</h1>
              <span className="text-xs text-gray-500 font-medium">Enterprise Solutions</span>
            </div>
          </div>
        </div>



        {/* Right side - Notifications, Profile, and Logout */}
        <div className="flex items-center space-x-4">
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
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Notifications</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50">
                    <p className="text-sm font-medium text-gray-900">New order received</p>
                    <p className="text-xs text-gray-500 mt-1">Order #12345 has been placed</p>
                  </div>
                  <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50">
                    <p className="text-sm font-medium text-gray-900">Inventory update</p>
                    <p className="text-xs text-gray-500 mt-1">Stock levels updated for 15 items</p>
                  </div>
                  <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer">
                    <p className="text-sm font-medium text-gray-900">System maintenance</p>
                    <p className="text-xs text-gray-500 mt-1">Scheduled maintenance in 2 hours</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-100 transition-all duration-200 cursor-pointer group">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <FiUser size={16} className="text-white" />
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900">Admin User</p>
              <p className="text-xs text-gray-500">Administrator</p>
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
        className={`fixed left-0 top-20 h-full bg-white border-r border-gray-200 transition-all duration-300 ease-in-out z-40 shadow-xl overflow-hidden ${
          sidebarOpen ? "w-72" : "w-0"
        }`}
      >
        <div className={`p-6 transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
          {/* Sidebar Header */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Navigation</h2>
            <div className="w-12 h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"></div>
          </div>

          <nav className="space-y-2">
            {/* Home */}
            <Link
              to="/home"
              className="flex items-center p-4 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-700 transition-all duration-200 group border border-transparent hover:border-blue-100"
            >
              <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors duration-200 mr-4">
                <FiHome size={18} className="text-blue-600" />
              </div>
              <span className="font-medium">Dashboard</span>
            </Link>

            {/* Master Section */}
            <div className="space-y-2">
              <button
                onClick={() => setMasterOpen(!masterOpen)}
                className="flex items-center justify-between w-full p-4 rounded-xl hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 hover:text-orange-700 transition-all duration-200 group border border-transparent hover:border-orange-100"
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
            <Link
              to="/purchase"
              className="flex items-center p-4 rounded-xl hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 hover:text-green-700 transition-all duration-200 group border border-transparent hover:border-green-100"
            >
              <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors duration-200 mr-4">
                <FiShoppingCart size={18} className="text-green-600" />
              </div>
              <span className="font-medium">Purchase</span>
            </Link>

            <Link
              to="/sale"
              className="flex items-center p-4 rounded-xl hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 hover:text-emerald-700 transition-all duration-200 group border border-transparent hover:border-emerald-100"
            >
              <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors duration-200 mr-4">
                <FiDollarSign size={18} className="text-emerald-600" />
              </div>
              <span className="font-medium">Sales</span>
            </Link>

            <Link
              to="/report"
              className="flex items-center p-4 rounded-xl hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 hover:text-purple-700 transition-all duration-200 group border border-transparent hover:border-purple-100"
            >
              <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors duration-200 mr-4">
                <FiFileText size={18} className="text-purple-600" />
              </div>
              <span className="font-medium">Reports</span>
            </Link>

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

      {/* Main Content Area */}
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          sidebarOpen ? "ml-72" : "ml-0"
        }`}
      >
        <div className="pt-20 p-8">
          {/* Your page content will go here */}
        </div>
      </div>

      {/* Add custom CSS for animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
