import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';

const Layout = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'items':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Items Management</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Items management functionality will be implemented here.</p>
            </div>
          </div>
        );
      case 'purchases':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Purchase Management</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Purchase management functionality will be implemented here.</p>
            </div>
          </div>
        );
      case 'sales':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Sales Management</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Sales management functionality will be implemented here.</p>
            </div>
          </div>
        );
      case 'returns':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Returns Management</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Returns management functionality will be implemented here.</p>
            </div>
          </div>
        );
      case 'parties':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Parties Management</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Parties management functionality will be implemented here.</p>
            </div>
          </div>
        );
      case 'brands':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Brands Management</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Brands management functionality will be implemented here.</p>
            </div>
          </div>
        );
      case 'groups':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Groups Management</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Groups management functionality will be implemented here.</p>
            </div>
          </div>
        );
      case 'makes':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Makes Management</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Makes management functionality will be implemented here.</p>
            </div>
          </div>
        );
      case 'stock-report':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Stock Report</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Stock report functionality will be implemented here.</p>
            </div>
          </div>
        );
      case 'purchase-report':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Purchase Report</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Purchase report functionality will be implemented here.</p>
            </div>
          </div>
        );
      case 'sales-report':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Sales Report</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Sales report functionality will be implemented here.</p>
            </div>
          </div>
        );
      case 'group-master':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Account Group Master</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Navigate to <a href="/accounts/group-master" className="text-blue-600 hover:underline">Account Group Master</a> to manage account groups.</p>
            </div>
          </div>
        );
      case 'coa-master':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Chart of Accounts Master</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Navigate to <a href="/accounts/coa-master" className="text-blue-600 hover:underline">Chart of Accounts Master</a> to manage accounts.</p>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Settings</h1>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600">Settings functionality will be implemented here.</p>
            </div>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 overflow-auto">
        {renderContent()}
      </main>
    </div>
  );
};

export default Layout;