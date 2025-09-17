import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EntryScreen from './EntryScreen';
import LoginForm from './LoginForm';
import AccountingPeriodSelector from './AccountingPeriodSelector';
import HomePage from './HomePage';
import MakePage from './MakePage';
import Navbar from './navbar';
import BrandPage from './BrandPage';
import GroupPage from './Grouppage';
import ItemPage from './Itempage';
import './App.css';
import SupplierPage from './SupplierPage';
import CustomerPage from './CustomerPage';
import PurchasePage from './PurchasePage';

// Layout component that includes the navbar for authenticated pages
function AuthenticatedLayout({ children }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Navbar />
      <div className="flex-1 overflow-auto pt-16">
        {children}
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<EntryScreen />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/select-period" element={<AccountingPeriodSelector />} />
        <Route path="/home" element={
          <AuthenticatedLayout>
            <HomePage />
          </AuthenticatedLayout>
        } />
        <Route path="/makes" element={
          <AuthenticatedLayout>
            <MakePage />
          </AuthenticatedLayout>
        } />

        <Route path="/brands" element={
          <AuthenticatedLayout>
            <BrandPage />
          </AuthenticatedLayout>
        } />

         <Route path="/groups" element={
          <AuthenticatedLayout>
            <GroupPage />
          </AuthenticatedLayout>
        } />

        <Route path="/items" element={
          <AuthenticatedLayout>
            <ItemPage />
          </AuthenticatedLayout>
        } />
        <Route path="/purchase" element={
          <AuthenticatedLayout>
            <React.Suspense fallback={<div>Loading...</div>}>
              <PurchasePage />
            </React.Suspense>
          </AuthenticatedLayout>
        } />
        <Route path="/suppliers" element={
          <AuthenticatedLayout>
            <SupplierPage />
          </AuthenticatedLayout>
        } />
        <Route path="/customers" element={
          <AuthenticatedLayout>
            <CustomerPage />
          </AuthenticatedLayout>
        } />
        
      </Routes>
    </Router>
  );
}

export default App;
