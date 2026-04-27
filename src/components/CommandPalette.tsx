import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useTheme } from '../contexts/ThemeContext';
import { Search, FileText, BarChart3, Calendar, Users, Moon, Sun, Plus, ArrowRight } from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'expediente' | 'navegacion' | 'accion';
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { processes } = useData();
  const { toggleTheme, isDark } = useTheme();

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const allCommands: CommandItem[] = useMemo(() => {
    const nav: CommandItem[] = [
      { id: 'nav-dashboard', label: 'Ir al Dashboard', icon: <FileText className="h-4 w-4" />, action: () => navigate('/'), category: 'navegacion' },
      { id: 'nav-analytics', label: 'Ir a Analítica', icon: <BarChart3 className="h-4 w-4" />, action: () => navigate('/analytics'), category: 'navegacion' },
      { id: 'nav-calendar', label: 'Ir al Calendario', icon: <Calendar className="h-4 w-4" />, action: () => navigate('/calendar'), category: 'navegacion' },
      { id: 'nav-users', label: 'Gestión de Usuarios', icon: <Users className="h-4 w-4" />, action: () => navigate('/users'), category: 'navegacion' },
    ];

    const actions: CommandItem[] = [
      { id: 'act-theme', label: isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro', icon: isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />, action: toggleTheme, category: 'accion' },
    ];

    const expedientes: CommandItem[] = processes.map(p => ({
      id: `proc-${p.id}`,
      label: p.title,
      description: `${p.clientName} · ${p.currentStage} · ${p.amount?.toLocaleString('de-DE')} €`,
      icon: <FileText className="h-4 w-4" />,
      action: () => navigate(`/process/${p.id}`),
      category: 'expediente' as const,
    }));

    return [...expedientes, ...nav, ...actions];
  }, [processes, navigate, toggleTheme, isDark]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands.slice(0, 12);
    const q = query.toLowerCase();
    return allCommands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [query, allCommands]);

  // Reset selection on filter change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
      setIsOpen(false);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const categoryLabels: Record<string, string> = {
    expediente: 'Expedientes',
    navegacion: 'Navegación',
    accion: 'Acciones',
  };

  // Group by category
  const grouped: Record<string, CommandItem[]> = {};
  filtered.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] transition-opacity"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Palette */}
      <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[15vh]">
        <div className={`w-full max-w-lg rounded-xl shadow-2xl border overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          {/* Search input */}
          <div className={`flex items-center gap-3 px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
            <Search className={`h-5 w-5 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar expediente, cliente, acción..."
              className={`flex-1 text-sm outline-none bg-transparent ${isDark ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-400'}`}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <kbd className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${isDark ? 'border-slate-600 text-slate-500' : 'border-slate-300 text-slate-400'}`}>ESC</kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className={`px-4 py-8 text-center text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                No se encontraron resultados para "{query}"
              </div>
            ) : (
              Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <div className={`px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {categoryLabels[category] || category}
                  </div>
                  {items.map((item) => {
                    const globalIdx = filtered.indexOf(item);
                    return (
                      <button
                        key={item.id}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          globalIdx === selectedIndex
                            ? isDark ? 'bg-codiagro-green/20 text-white' : 'bg-codiagro-green/10 text-codiagro-green-dark'
                            : isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                        onClick={() => { item.action(); setIsOpen(false); }}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        <span className={`${globalIdx === selectedIndex ? 'text-codiagro-green' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {item.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.label}</p>
                          {item.description && (
                            <p className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.description}</p>
                          )}
                        </div>
                        {globalIdx === selectedIndex && (
                          <ArrowRight className="h-3.5 w-3.5 text-codiagro-green flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className={`flex items-center gap-4 px-4 py-2 border-t text-[10px] ${isDark ? 'border-slate-700 text-slate-500' : 'border-slate-100 text-slate-400'}`}>
            <span className="flex items-center gap-1">
              <kbd className={`px-1 rounded border font-mono ${isDark ? 'border-slate-600' : 'border-slate-300'}`}>↑↓</kbd> navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className={`px-1 rounded border font-mono ${isDark ? 'border-slate-600' : 'border-slate-300'}`}>↵</kbd> abrir
            </span>
            <span className="flex items-center gap-1">
              <kbd className={`px-1 rounded border font-mono ${isDark ? 'border-slate-600' : 'border-slate-300'}`}>Ctrl+K</kbd> cerrar
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
