import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import MLReportsPage from './MLReportsPage';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import UserManagementPage from './UserManagementPage';
import SecurityUserManagement from './SecurityUserManagement';
import SecurityRoleManagement from './SecurityRoleManagement';
import SecurityPermissionAssignment from './SecurityPermissionAssignment';
import SecurityUserRoleReview from './SecurityUserRoleReview';
import AccountGroupListPage from './AccountGroupListPage';
import AccountGroupPage from './AccountGroupPage';
import CoaListPage from './CoaListPage';
import CoaPage from './CoaPage';
import JournalListPage from './JournalListPage';
import JournalEntryForm from './JournalEntryForm';
import DebitNoteListPage from './DebitNoteListPage';
import DebitNoteForm from './DebitNoteForm';
import CreditNoteListPage from './CreditNoteListPage';
import CreditNoteForm from './CreditNoteForm';
import DynamicTransactionMappingPage from './DynamicTransactionMappingPage';
import { DarkModeProvider } from './contexts/DarkModeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute as PermissionProtectedRoute } from './components/ProtectedRoute';

// Protected Route Component
function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== 'ADMIN') {
    // Redirect salesperson to sales page if trying to access admin-only pages
    return <Navigate to="/sale" replace />;
  }

  return children;
}

// Layout component that includes the navbar for authenticated pages
function AuthenticatedLayout({ children, adminOnly = false }) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="flex-1 overflow-auto pt-16 bg-gray-50 dark:bg-gray-900">
          {children}
        </div>
      </div>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <AuthProvider>
      <DarkModeProvider>
        <Router>
          <Routes>
            <Route path="/" element={<EntryScreen />} />
            <Route path="/login" element={<LoginForm />} />
            <Route path="/select-period" element={<AccountingPeriodSelector />} />
            <Route path="/home" element={
              <AuthenticatedLayout>
                <Dashboard />
              </AuthenticatedLayout>
            } />
            <Route path="/dashboard" element={
              <AuthenticatedLayout>
                <Dashboard />
              </AuthenticatedLayout>
            } />
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
            <Route path="/ml-reports" element={
              <AuthenticatedLayout>
                <MLReportsPage />
              </AuthenticatedLayout>
            } />

            {/* User Management */}
            <Route path="/users" element={
              <AuthenticatedLayout>
                <UserManagementPage />
              </AuthenticatedLayout>
            } />

            {/* Settings - Security - User Management */}
            <Route path="/settings/security/user-management" element={
              <AuthenticatedLayout>
                <SecurityUserManagement />
              </AuthenticatedLayout>
            } />

            {/* Settings - Security - Role Management */}
            <Route path="/settings/security/role-management" element={
              <AuthenticatedLayout>
                <SecurityRoleManagement />
              </AuthenticatedLayout>
            } />

            {/* Settings - Security - Permission Assignment */}
            <Route path="/settings/security/permission-assignment" element={
              <AuthenticatedLayout>
                <SecurityPermissionAssignment />
              </AuthenticatedLayout>
            } />

            {/* Settings - Security - User Role Review */}
            <Route path="/settings/security/user-role-review" element={
              <AuthenticatedLayout>
                <SecurityUserRoleReview />
              </AuthenticatedLayout>
            } />

            {/* Accounts Module */}
            <Route path="/accounts/group-master" element={
              <AuthenticatedLayout>
                <AccountGroupListPage />
              </AuthenticatedLayout>
            } />
            <Route path="/accounts/group-master/new" element={
              <AuthenticatedLayout>
                <AccountGroupPage />
              </AuthenticatedLayout>
            } />
            <Route path="/accounts/group-master/edit/:id" element={
              <AuthenticatedLayout>
                <AccountGroupPage />
              </AuthenticatedLayout>
            } />

            {/* Chart of Accounts Module */}
            <Route path="/accounts/coa-master" element={
              <AuthenticatedLayout>
                <CoaListPage />
              </AuthenticatedLayout>
            } />
            <Route path="/accounts/coa-master/new" element={
              <AuthenticatedLayout>
                <CoaPage />
              </AuthenticatedLayout>
            } />
            <Route path="/accounts/coa-master/edit/:id" element={
              <AuthenticatedLayout>
                <CoaPage />
              </AuthenticatedLayout>
            } />

            {/* Journal Voucher Module */}
            <Route path="/accounts/journal-voucher" element={
              <AuthenticatedLayout>
                <JournalListPage />
              </AuthenticatedLayout>
            } />
            <Route path="/accounts/journal-voucher/new" element={
              <AuthenticatedLayout>
                <JournalEntryForm />
              </AuthenticatedLayout>
            } />
            <Route path="/accounts/journal-voucher/edit/:id" element={
              <AuthenticatedLayout>
                <JournalEntryForm />
              </AuthenticatedLayout>
            } />

            {/* Debit Note Module */}
            <Route path="/accounts/debit-note" element={
              <AuthenticatedLayout>
                <DebitNoteListPage />
              </AuthenticatedLayout>
            } />
            <Route path="/accounts/debit-note/new" element={
              <AuthenticatedLayout>
                <DebitNoteForm />
              </AuthenticatedLayout>
            } />
            <Route path="/accounts/debit-note/edit/:id" element={
              <AuthenticatedLayout>
                <DebitNoteForm />
              </AuthenticatedLayout>
            } />
            <Route path="/accounts/debit-note/view/:id" element={
              <AuthenticatedLayout>
                <DebitNoteForm />
              </AuthenticatedLayout>
            } />

            {/* Credit Note Module */}
            <Route path="/accounts/credit-note" element={
              <AuthenticatedLayout>
                <CreditNoteListPage />
              </AuthenticatedLayout>
            } />
            <Route path="/accounts/credit-note/new" element={
              <AuthenticatedLayout>
                <CreditNoteForm />
              </AuthenticatedLayout>
            } />
            <Route path="/accounts/credit-note/edit/:id" element={
              <AuthenticatedLayout>
                <CreditNoteForm />
              </AuthenticatedLayout>
            } />
            <Route path="/accounts/credit-note/view/:id" element={
              <AuthenticatedLayout>
                <CreditNoteForm />
              </AuthenticatedLayout>
            } />

            {/* Dynamic Transaction Mapping Module */}
            <Route path="/accounts/settings/dynamic-transaction-mapping" element={
              <AuthenticatedLayout>
                <PermissionProtectedRoute permission="ACCOUNTS_DYNAMIC_MAPPING_VIEW">
                  <DynamicTransactionMappingPage />
                </PermissionProtectedRoute>
              </AuthenticatedLayout>
            } />

          </Routes>
        </Router>
      </DarkModeProvider>
    </AuthProvider>
  );
}

export default App;
