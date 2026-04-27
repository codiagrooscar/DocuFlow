import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { roleTranslations } from '../types';

export default function NotificationCenter() {
  const { processes } = useData();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const notifications = useMemo(() => {
    if (!user) return [];
    
    const notifs: { id: string; processId: string; title: string; message: string; date: number; priority?: 'high' | 'medium' | 'low' }[] = [];

    processes.forEach(p => {
      // === SLA ALERTS (Mejora #2) ===
      if (p.currentStage !== 'completado') {
        const daysInStage = Math.floor((Date.now() - p.updatedAt) / (1000 * 60 * 60 * 24));
        
        // >5 days: escalate to admin
        if (daysInStage > 5 && user.role === 'admin') {
          notifs.push({
            id: `${p.id}-sla-escalated`,
            processId: p.id,
            title: '🚨 SLA Crítico — Escalado',
            message: `"${p.title}" lleva ${daysInStage} días en fase ${p.currentStage}. Requiere intervención inmediata.`,
            date: p.updatedAt,
            priority: 'high'
          });
        }
        
        // >2 days: notify responsible role
        if (daysInStage > 2) {
          const isResponsible = 
            (p.currentStage === 'oferta' && (user.role === 'sales' || user.role === 'compliance' || user.role === 'risk')) ||
            (p.currentStage === 'pedido' && (user.role === 'sales' || user.role === 'production')) ||
            (p.currentStage === 'produccion' && user.role === 'production') ||
            (p.currentStage === 'logistica' && user.role === 'logistics') ||
            (p.currentStage === 'albaran' && user.role === 'logistics') ||
            (p.currentStage === 'factura' && user.role === 'finance') ||
            user.role === 'admin';
          
          if (isResponsible && daysInStage <= 5) {
            notifs.push({
              id: `${p.id}-sla-warning`,
              processId: p.id,
              title: '⏰ Alerta SLA',
              message: `"${p.title}" lleva ${daysInStage} días en fase ${p.currentStage}. Objetivo: <3 días hábiles.`,
              date: p.updatedAt,
              priority: 'medium'
            });
          }
        }
      }

      // === Multi-role Authorization Notifications ===
      if (p.quoteStatus === 'pending_auth' && p.authRequests) {
        const myPendingAuth = p.authRequests.find(r => r.role === user.role && r.status === 'pending');
        if (myPendingAuth) {
          notifs.push({ 
            id: `${p.id}-auth-req-${user.role}`, 
            processId: p.id, 
            title: 'Autorización Requerida', 
            message: `El expediente "${p.title}" requiere tu revisión de ${roleTranslations[user.role]}.`, 
            date: p.updatedAt,
            priority: 'high'
          });
        }
      }

      // === Sales Notifications ===
      if (user.role === 'sales' || user.role === 'admin') {
        if (p.quoteStatus === 'authorized') {
          notifs.push({ id: `${p.id}-quote_ready`, processId: p.id, title: 'Oferta Autorizada', message: `La oferta "${p.title}" ya puede enviarse al cliente.`, date: p.updatedAt });
        }
      }

      // === Finance Notifications ===
      if (user.role === 'finance' || user.role === 'admin') {
        if (p.deliveryStatus === 'signed' && p.invoiceStatus === 'pending') {
          notifs.push({ id: `${p.id}-inv_pend`, processId: p.id, title: 'Factura Pendiente', message: `El expediente "${p.title}" requiere generar una factura.`, date: p.updatedAt });
        }
        if (p.invoiceStatus === 'sent') {
          notifs.push({ id: `${p.id}-inv_sent`, processId: p.id, title: 'Esperando Pago Final', message: `El expediente "${p.title}" está esperando el registro del pago final.`, date: p.updatedAt });
        }
      }

      // === Production Notifications ===
      if (user.role === 'production' || user.role === 'admin') {
        if (p.orderStatus === 'sent_to_production') {
          notifs.push({ id: `${p.id}-prod_pend`, processId: p.id, title: 'Nuevo Pedido', message: `El expediente "${p.title}" está listo para iniciar fabricación.`, date: p.updatedAt });
        }
        if (p.orderStatus === 'in_manufacturing') {
          notifs.push({ id: `${p.id}-prod_man`, processId: p.id, title: 'En Fabricación', message: `El expediente "${p.title}" está en proceso de fabricación.`, date: p.updatedAt });
        }
      }

      // === Logistics Notifications ===
      if (user.role === 'logistics' || user.role === 'admin') {
        if (p.orderStatus === 'ready_for_pickup') {
          notifs.push({ id: `${p.id}-log_ready`, processId: p.id, title: 'Pedido Listo', message: `El expediente "${p.title}" está listo para coordinar logística.`, date: p.updatedAt });
        }
        if (p.deliveryStatus === 'generated') {
          notifs.push({ id: `${p.id}-log_del`, processId: p.id, title: 'Esperando Firma', message: `El expediente "${p.title}" está esperando la firma del albarán.`, date: p.updatedAt });
        }
      }
    });

    // Sort: high priority first, then by date
    return notifs.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPrio = priorityOrder[a.priority || 'low'];
      const bPrio = priorityOrder[b.priority || 'low'];
      if (aPrio !== bPrio) return aPrio - bPrio;
      return b.date - a.date;
    });
  }, [processes, user]);

  return (
    <div className="relative">
      <Button 
        variant="ghost" 
        size="icon" 
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-5 w-5 text-slate-600" />
        {notifications.length > 0 && (
          <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${notifications.some(n => n.priority === 'high') ? 'bg-red-500 animate-pulse' : 'bg-red-500'}`}></span>
        )}
      </Button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-slate-200 z-50 overflow-hidden">
            <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-semibold text-slate-800">Notificaciones</h3>
              <span className="text-xs font-medium bg-codiagro-orange/10 text-codiagro-orange-dark px-2 py-0.5 rounded-full">
                {notifications.length} pendientes
              </span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">
                  No tienes tareas pendientes.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.map(notif => (
                    <Link 
                      key={notif.id} 
                      to={`/process/${notif.processId}`}
                      className={`block p-3 hover:bg-slate-50 transition-colors ${notif.priority === 'high' ? 'border-l-4 border-l-red-500 bg-red-50/30' : notif.priority === 'medium' ? 'border-l-4 border-l-amber-400 bg-amber-50/20' : ''}`}
                      onClick={() => setIsOpen(false)}
                    >
                      <p className="text-sm font-semibold text-slate-800">{notif.title}</p>
                      <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                      <p className="text-[10px] text-slate-400 mt-2">
                        {format(notif.date, "d MMM, HH:mm", { locale: es })}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
