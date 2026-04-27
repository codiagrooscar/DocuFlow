import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { LayoutDashboard, FileText, Users, LogOut, ShieldAlert, BarChart3, Calendar, Moon, Sun, Search, Settings, History } from 'lucide-react';
import { Button } from './ui/button';
import { Role, roleTranslations } from '../types';
import NotificationCenter from './NotificationCenter';
import CommandPalette from './CommandPalette';

export default function Layout() {
  const { user, logout, switchRole } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const location = useLocation();

  if (!user) return <Outlet />;

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Calendario', path: '/calendar', icon: Calendar },
    { name: 'Analítica', path: '/analytics', icon: BarChart3 },
    { name: 'Automatizaciones', path: '/automations', icon: Settings },
  ];

  const roles: Role[] = ['admin', 'sales', 'compliance', 'risk', 'production', 'logistics', 'finance'];

  return (
    <div className={`flex h-screen ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      {/* Sidebar */}
      <div className="w-64 bg-codiagro-green text-slate-200 flex flex-col">
        <div className={`p-4 flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-white'} border-b border-codiagro-green-dark`}>
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

        {/* Admin Menu Item inserted into nav Items block via a separate item, let's just insert it safely below nav Items */}
        {user.role === 'admin' && (
          <div className="px-2 pb-4">
             <Link
                to="/users"
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors mb-1 ${
                  location.pathname === '/users' ? 'bg-codiagro-green-dark text-white border-l-4 border-codiagro-orange' : 'hover:bg-codiagro-green-dark hover:text-white border-l-4 border-transparent'
                }`}
              >
                <Users className="h-5 w-5" />
                Gestión Usuarios
              </Link>
              <Link
                to="/audit"
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  location.pathname === '/audit' ? 'bg-codiagro-green-dark text-white border-l-4 border-codiagro-orange' : 'hover:bg-codiagro-green-dark hover:text-white border-l-4 border-transparent'
                }`}
              >
                <History className="h-5 w-5" />
                Auditoría
              </Link>
          </div>
        )}

        <div className="mt-auto p-4 border-t border-codiagro-green-dark">
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
        <header className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-b'} h-16 flex items-center justify-between px-6 shadow-sm`}>
          <h1 className={`text-xl font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
            {navItems.find(i => i.path === location.pathname)?.name || 'Detalle de Expediente'}
          </h1>
          <div className="flex items-center gap-3">
            {/* Search trigger */}
            <button
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${isDark ? 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300' : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500'}`}
            >
              <Search className="h-3.5 w-3.5" />
              <span>Buscar...</span>
              <kbd className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ml-2 ${isDark ? 'border-slate-600' : 'border-slate-300'}`}>Ctrl+K</kbd>
            </button>
            {/* Dark Mode Toggle */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleTheme}
              className={`relative rounded-full transition-all duration-300 ${isDark ? 'text-amber-400 hover:text-amber-300 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
              title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {isDark ? (
                <Sun className="h-5 w-5 transition-transform duration-300 rotate-0" />
              ) : (
                <Moon className="h-5 w-5 transition-transform duration-300 rotate-0" />
              )}
            </Button>
            <NotificationCenter />
          </div>
        </header>
        <main className={`flex-1 overflow-auto p-6 ${isDark ? 'bg-slate-900' : ''}`}>
          <Outlet />
        </main>
        <CommandPalette />
      </div>
    </div>
  );
}
