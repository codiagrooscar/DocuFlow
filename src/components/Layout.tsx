import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, FileText, Users, LogOut, ShieldAlert, BarChart3, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Role, roleTranslations } from '../types';
import NotificationCenter from './NotificationCenter';

export default function Layout() {
  const { user, logout, switchRole } = useAuth();
  const location = useLocation();

  if (!user) return <Outlet />;

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Calendario', path: '/calendar', icon: Calendar },
    { name: 'Analítica', path: '/analytics', icon: BarChart3 },
  ];

  const roles: Role[] = ['admin', 'sales', 'compliance', 'risk', 'production', 'logistics', 'finance'];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-codiagro-green text-slate-200 flex flex-col">
        <div className="p-4 flex items-center justify-center bg-white border-b border-codiagro-green-dark">
          <img 
            src="https://www.codiagro.com/wp-content/uploads/2020/08/logo.png" 
            alt="Codiagro Logo" 
            className="h-12 object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive ? 'bg-codiagro-green-dark text-white border-l-4 border-codiagro-orange' : 'hover:bg-codiagro-green-dark hover:text-white border-l-4 border-transparent'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Role Switcher (Demo) */}
        <div className="p-4 border-t border-codiagro-green-dark">
          <div className="flex items-center gap-2 mb-2 text-xs uppercase text-slate-300 font-semibold">
            <ShieldAlert className="h-4 w-4" />
            Simular Rol
          </div>
          <select 
            className="w-full bg-codiagro-green-dark text-sm rounded p-2 border-none text-white focus:ring-1 focus:ring-codiagro-orange"
            value={user.role}
            onChange={(e) => switchRole(e.target.value as Role)}
          >
            {roles.map(r => (
              <option key={r} value={r}>{roleTranslations[r]}</option>
            ))}
          </select>
        </div>

        <div className="p-4 border-t border-codiagro-green-dark">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-codiagro-orange flex items-center justify-center text-white font-bold">
              {user.displayName.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user.displayName}</p>
              <p className="text-xs text-slate-300 truncate">{roleTranslations[user.role]}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-slate-300 hover:text-white hover:bg-codiagro-green-dark" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b h-16 flex items-center justify-between px-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-800">
            {navItems.find(i => i.path === location.pathname)?.name || 'Detalle de Expediente'}
          </h1>
          <div className="flex items-center gap-4">
            <NotificationCenter />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
