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
import SalesPage from './SalesPage';
import PurchaseReturnPage from './PurchaseReturnPage';
import ReportsPage from './ReportsPage';
import SalesPurchaseReportsPage from './SalesPurchaseReportsPage';
import Layout from './components/Layout';
import { DarkModeProvider } from './contexts/DarkModeContext';

// Layout component that includes the navbar for authenticated pages
function AuthenticatedLayout({ children }) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="flex-1 overflow-auto pt-16 bg-gray-50 dark:bg-gray-900">
        {children}
      </div>
    </div>
  );
}

function App() {
  return (
    <DarkModeProvider>
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
        <Route path="/dashboard" element={<Layout />} />
        <Route path="/makes" element={
          <AuthenticatedLayout>
            <MakePage />
          </AuthenticatedLayout>
        } />
        <Route path="/makes/new" element={
          <AuthenticatedLayout>
            <MakePage />
          </AuthenticatedLayout>
        } />
        <Route path="/makes/edit/:id" element={
          <AuthenticatedLayout>
            <MakePage />
          </AuthenticatedLayout>
        } />

        <Route path="/brands" element={
          <AuthenticatedLayout>
            <BrandPage />
          </AuthenticatedLayout>
        } />
        <Route path="/brands/new" element={
          <AuthenticatedLayout>
            <BrandPage />
          </AuthenticatedLayout>
        } />
        <Route path="/brands/edit/:id" element={
          <AuthenticatedLayout>
            <BrandPage />
          </AuthenticatedLayout>
        } />

         <Route path="/groups" element={
          <AuthenticatedLayout>
            <GroupPage />
          </AuthenticatedLayout>
        } />
        <Route path="/groups/new" element={
          <AuthenticatedLayout>
            <GroupPage />
          </AuthenticatedLayout>
        } />
        <Route path="/groups/edit/:id" element={
          <AuthenticatedLayout>
            <GroupPage />
          </AuthenticatedLayout>
        } />

        <Route path="/items" element={
          <AuthenticatedLayout>
            <ItemPage />
          </AuthenticatedLayout>
        } />
        <Route path="/items/new" element={
          <AuthenticatedLayout>
            <ItemPage />
          </AuthenticatedLayout>
        } />
        <Route path="/items/edit/:id" element={
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
        <Route path="/purchase/new" element={
          <AuthenticatedLayout>
            <React.Suspense fallback={<div>Loading...</div>}>
              <PurchasePage />
            </React.Suspense>
          </AuthenticatedLayout>
        } />
        <Route path="/purchase/edit/:id" element={
          <AuthenticatedLayout>
            <React.Suspense fallback={<div>Loading...</div>}>
              <PurchasePage />
            </React.Suspense>
          </AuthenticatedLayout>
        } />
        <Route path="/purchase-return" element={
          <AuthenticatedLayout>
            <React.Suspense fallback={<div>Loading...</div>}>
              <PurchaseReturnPage />
            </React.Suspense>
          </AuthenticatedLayout>
        } />
        <Route path="/sale" element={
          <AuthenticatedLayout>
            <React.Suspense fallback={<div>Loading...</div>}>
              <SalesPage />
            </React.Suspense>
          </AuthenticatedLayout>
        } />
        <Route path="/suppliers" element={
          <AuthenticatedLayout>
            <SupplierPage />
          </AuthenticatedLayout>
        } />
        <Route path="/suppliers/new" element={
          <AuthenticatedLayout>
            <SupplierPage />
          </AuthenticatedLayout>
        } />
        <Route path="/suppliers/edit/:id" element={
          <AuthenticatedLayout>
            <SupplierPage />
          </AuthenticatedLayout>
        } />
        <Route path="/customers" element={
          <AuthenticatedLayout>
            <CustomerPage />
          </AuthenticatedLayout>
        } />
        <Route path="/customers/new" element={
          <AuthenticatedLayout>
            <CustomerPage />
          </AuthenticatedLayout>
        } />
        <Route path="/customers/edit/:id" element={
          <AuthenticatedLayout>
            <CustomerPage />
          </AuthenticatedLayout>
        } />
        <Route path="/report" element={
          <AuthenticatedLayout>
            <ReportsPage />
          </AuthenticatedLayout>
        } />
        <Route path="/sales-purchase-reports" element={
          <AuthenticatedLayout>
            <SalesPurchaseReportsPage />
          </AuthenticatedLayout>
        } />
        
        </Routes>
      </Router>
    </DarkModeProvider>
  );
}

export default App;
