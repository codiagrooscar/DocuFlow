/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ProcessDetail from './pages/ProcessDetail';
import Analytics from './pages/Analytics';
import CalendarView from './pages/CalendarView';
import Login from './pages/Login';
import ClientTracking from './pages/ClientTracking';
import Users from './pages/Users';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Cargando...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Cargando...</div>;
  if (!user || user.role !== 'admin') return <Navigate to="/" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <DataProvider>
          <Router>
            <Toaster position="top-right" richColors />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/track/:id/:token" element={<ClientTracking />} />
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="process/:id" element={<ProcessDetail />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="calendar" element={<CalendarView />} />
                <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
              </Route>
            </Routes>
          </Router>
        </DataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

