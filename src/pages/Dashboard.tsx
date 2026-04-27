import React, { useState, useRef, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Plus, FileText, ArrowRight, Trash2, Search, UploadCloud, BarChart3, Clock, CheckCircle2, LayoutGrid, KanbanSquare, Download, Tags, Calendar as CalendarIcon, Filter, AlertTriangle, Table as TableIcon, FileSpreadsheet, CheckSquare, AlertCircle, ShieldCheck, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProcessTag, roleTranslations, Currency, currencySymbols } from '../types';

export default function Dashboard() {
  const { processes, logs, createProcess, deleteProcess, updateProcessStatus, bulkUpdateProcesses, bulkDeleteProcesses, templates } = useData();
  const { user } = useAuth();
  const [newTitle, setNewTitle] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newTemplateId, setNewTemplateId] = useState<string>('');
  const [newAmount, setNewAmount] = useState<string>('');
  const [newCurrency, setNewCurrency] = useState<Currency>('EUR');
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<ProcessTag | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'this_week' | 'this_month'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'kanban' | 'table'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([]);
  const [activityFilter, setActivityFilter] = useState<'all' | 'me'>('all');
  const [useRoleFilter, setUseRoleFilter] = useState(true);
  const [hideCompleted, setHideCompleted] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-enable role filter when role changes
  React.useEffect(() => {
    setUseRoleFilter(true);
    setStatusFilter('all'); // Reset manual status filter when role changes
  }, [user?.role]);

  const uniqueClients = useMemo(() => {
    const clients = new Set(processes.map(p => p.clientName).filter(Boolean));
    return Array.from(clients).sort();
  }, [processes]);

  const filteredProcesses = useMemo(() => {
    let filtered = processes.filter(p => {
      const title = String(p.title || '');
      const clientName = String(p.clientName || '');
      
      const matchesSearch = !searchTerm || 
        title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.documents && p.documents.some(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        (p.comments && p.comments.some(c => c.text.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        (p.tasks && p.tasks.some(t => t.text.toLowerCase().includes(searchTerm.toLowerCase())));
      
      const matchesStatus = statusFilter === 'all' || p.currentStage === statusFilter;
      
      const matchesTag = tagFilter === 'all' || (p.tags && p.tags.includes(tagFilter as ProcessTag));
      
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const now = new Date();
        const processDate = new Date(p.createdAt);
        if (dateFilter === 'today') {
          matchesDate = processDate.toDateString() === now.toDateString();
        } else if (dateFilter === 'this_week') {
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = processDate >= oneWeekAgo;
        } else if (dateFilter === 'this_month') {
          matchesDate = processDate.getMonth() === now.getMonth() && processDate.getFullYear() === now.getFullYear();
        }
      }
      
      let matchesRole = true;
      if (useRoleFilter && user) {
        if (user.role === 'logistics') {
          matchesRole = p.currentStage === 'pedido' || p.currentStage === 'albaran';
        } else if (user.role === 'finance') {
          matchesRole = p.currentStage === 'proforma' || p.currentStage === 'factura';
        } else if (user.role === 'production') {
          matchesRole = p.currentStage === 'pedido';
        } else if (user.role === 'risk' || user.role === 'compliance') {
          matchesRole = p.quoteStatus === 'pending_auth' && 
            (p.authRequests || []).some(r => r.role === user.role && r.status === 'pending');
        }
      }
      
      let matchesHideCompleted = true;
      if (hideCompleted) {
        matchesHideCompleted = p.currentStage !== 'completado';
      }
      
      return matchesSearch && matchesStatus && matchesTag && matchesDate && matchesRole && matchesHideCompleted;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'newest') return b.updatedAt - a.updatedAt;
      if (sortBy === 'oldest') return a.updatedAt - b.updatedAt;
      if (sortBy === 'name') return String(a.title).localeCompare(String(b.title));
      return 0;
    });
  }, [processes, searchTerm, statusFilter, tagFilter, dateFilter, sortBy, useRoleFilter, user, hideCompleted]);

  const stats = useMemo(() => {
    const completed = filteredProcesses.filter(p => p.currentStage === 'completado');
    const active = filteredProcesses.filter(p => p.currentStage !== 'completado');
    
    // Monthly billing (completed this month)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const billedThisMonth = completed
      .filter(p => p.updatedAt >= monthStart)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    
    // Active pipeline value
    const pipelineValue = active.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    // SLA at risk (>2 days in same stage)
    const slaAtRisk = active.filter(p => {
      const daysInStage = Math.floor((Date.now() - p.updatedAt) / (1000 * 60 * 60 * 24));
      return daysInStage > 2;
    }).length;
    
    // Average days per completed process
    const avgDays = completed.length > 0 
      ? Math.round(completed.reduce((sum, p) => sum + Math.floor((p.updatedAt - p.createdAt) / (1000 * 60 * 60 * 24)), 0) / completed.length)
      : 0;

    return {
      total: filteredProcesses.length,
      active: active.length,
      completed: completed.length,
      billedThisMonth,
      pipelineValue,
      slaAtRisk,
      avgDays,
    };
  }, [filteredProcesses]);

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Título del documento
      doc.setFontSize(18);
      doc.text('Informe de Expedientes - DocuFlow', 14, 22);
      
      // Estadísticas
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
      doc.text(`Total: ${stats.total} | En Proceso: ${stats.active} | Completados: ${stats.completed}`, 14, 36);
      
      // Preparar datos para la tabla
      const tableColumn = ["Título", "Cliente", "Estado", "Última Actualización"];
      const tableRows = filteredProcesses.map(p => [
        p.title || 'Sin título',
        p.clientName || 'Sin cliente',
        p.currentStage.toUpperCase(),
        format(p.updatedAt, 'dd/MM/yyyy HH:mm')
      ]);
      
      // Generar tabla
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [37, 99, 235] }, // Azul
        alternateRowStyles: { fillColor: [248, 250, 252] } // Gris muy claro
      });
      
      let finalY = (doc as any).lastAutoTable.finalY || 45;

      // Historial de Actividad por Expediente
      if (filteredProcesses.length > 0) {
        doc.addPage();
        finalY = 20;
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text('Detalle de Actividad por Expediente', 14, finalY);
        finalY += 10;

        filteredProcesses.forEach((process, index) => {
          const processLogs = logs.filter(log => log.processId === process.id);
          
          if (processLogs.length > 0) {
            // Check if we need a new page for the header
            if (finalY > 250) {
              doc.addPage();
              finalY = 20;
            }

            doc.setFontSize(12);
            doc.setTextColor(37, 99, 235); // Blue
            doc.text(`Expediente: ${process.title || 'Sin título'} (${process.clientName || 'Sin cliente'})`, 14, finalY);
            finalY += 6;

            const logColumn = ["Fecha", "Acción", "Usuario"];
            const logRows = processLogs.map(log => [
              format(log.timestamp, 'dd/MM/yyyy HH:mm'),
              log.action,
              log.performedByName
            ]);

            autoTable(doc, {
              head: [logColumn],
              body: logRows,
              startY: finalY,
              styles: { fontSize: 8, cellPadding: 3 },
              headStyles: { fillColor: [71, 85, 105] }, // Slate
              alternateRowStyles: { fillColor: [248, 250, 252] },
              margin: { left: 14, right: 14 }
            });

            finalY = (doc as any).lastAutoTable.finalY + 15;
          }
        });
      }

      doc.save(`informe_expedientes_${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast.success("Informe PDF generado correctamente");
    } catch (error) {
      toast.error("Error al generar el PDF");
      console.error(error);
    }
  };

  const exportToCSV = () => {
    try {
      const headers = ['Título', 'Cliente', 'Fase', 'Etiquetas', 'Actualizado'];
      const rows = filteredProcesses.map(p => [
        `"${p.title || ''}"`,
        `"${p.clientName || ''}"`,
        `"${p.currentStage}"`,
        `"${p.tags?.join(', ') || ''}"`,
        `"${format(p.updatedAt, 'dd/MM/yyyy HH:mm')}"`
      ]);
      
      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
        
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `expedientes_${format(new Date(), 'yyyyMMdd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Exportado a CSV correctamente");
    } catch (error) {
      toast.error("Error al generar el CSV");
      console.error(error);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('processId', id);
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault();
    setDraggingId(null);
    const processId = e.dataTransfer.getData('processId');
    const process = processes.find(p => p.id === processId);
    
    if (process && process.currentStage !== newStage) {
      try {
        await updateProcessStatus(processId, { currentStage: newStage as any }, `Movido a ${newStage} desde Kanban`);
        toast.success(`Expediente movido a ${newStage}`);
      } catch (error) {
        toast.error("Error al mover el expediente");
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newClient) return;
    
    setIsSubmitting(true);
    try {
      const parsedAmount = parseFloat(newAmount.replace(',', '.'));
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        toast.error('El importe debe ser un número positivo');
        setIsSubmitting(false);
        return;
      }
      await createProcess(newTitle, newClient, parsedAmount, newFile || undefined, newTemplateId || undefined, newCurrency);
      setNewTitle('');
      setNewClient('');
      setNewFile(null);
      setNewTemplateId('');
      setNewAmount('');
      setNewCurrency('EUR');
      setIsCreating(false);
    } catch (error) {
      console.error("Error creating process:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProcessSelection = (id: string) => {
    setSelectedProcesses(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedProcesses.length === 0) return;
    if (confirm(`¿Estás seguro de eliminar ${selectedProcesses.length} expedientes?`)) {
      try {
        await bulkDeleteProcesses(selectedProcesses);
        setSelectedProcesses([]);
      } catch (error) {
        console.error("Error in bulk delete:", error);
      }
    }
  };

  const handleBulkMove = async (stage: string) => {
    if (selectedProcesses.length === 0 || !stage) return;
    try {
      await bulkUpdateProcesses(selectedProcesses, { currentStage: stage as any }, `Movido masivamente a ${stage}`);
      setSelectedProcesses([]);
    } catch (error) {
      console.error("Error in bulk move:", error);
    }
  };

  const handleFastPdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewFile(file);
      // Remove extension for title
      const titleFromName = file.name.replace(/\.[^/.]+$/, "");
      setNewTitle(titleFromName);
      setIsCreating(true);
      // Reset input so it can be used again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteProcess(id);
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Error deleting:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case 'oferta':
      case 'cotizacion': return <Badge variant="secondary">Oferta</Badge>;
      case 'pedido': return <Badge variant="default">Pedido</Badge>;
      case 'produccion': return <Badge variant="warning">Producción</Badge>;
      case 'logistica': return <Badge variant="outline">Logística</Badge>;
      case 'proforma': return <Badge variant="outline">Proforma</Badge>;
      case 'albaran': return <Badge variant="outline">Albarán</Badge>;
      case 'factura': return <Badge variant="success">Factura</Badge>;
      case 'completado': return <Badge variant="success">Completado</Badge>;
      default: return <Badge>{stage}</Badge>;
    }
  };

  const KANBAN_STAGES = [
    { id: 'oferta', label: 'Oferta', color: 'bg-slate-100 border-slate-200' },
    { id: 'pedido', label: 'Pedido', color: 'bg-amber-50 border-amber-200' },
    { id: 'produccion', label: 'Producción', color: 'bg-codiagro-green/5 border-codiagro-green/20' },
    { id: 'logistica', label: 'Logística', color: 'bg-blue-50 border-blue-200' },
    { id: 'albaran', label: 'Albarán', color: 'bg-indigo-50 border-indigo-200' },
    { id: 'factura', label: 'Factura', color: 'bg-green-50 border-green-200' },
    { id: 'completado', label: 'Completado', color: 'bg-emerald-50 border-emerald-200' },
  ];

  const myPendingTasks = useMemo(() => {
    if (!user) return [];
    const tasks: { processId: string, processTitle: string, task: any, type?: 'auth' }[] = [];
    
    processes.forEach(p => {
      if (p.currentStage === 'completado') return;

      // Regular tasks
      if (p.tasks) {
        p.tasks.forEach(t => {
          if (!t.completed) {
            tasks.push({ processId: p.id, processTitle: p.title, task: t });
          }
        });
      }

      // Authorization requests
      if (p.quoteStatus === 'pending_auth' && p.authRequests) {
        const myPendingAuth = p.authRequests.find(r => r.role === user.role && r.status === 'pending');
        if (myPendingAuth) {
          tasks.push({ 
            processId: p.id, 
            processTitle: p.title, 
            type: 'auth',
            task: {
              id: `auth-${p.id}-${user.role}`,
              text: `Autorización pendiente para ${roleTranslations[user.role]}`,
              createdAt: p.updatedAt,
              completed: false
            } 
          });
        }
      }

      // Role-specific Stage Tasks
      if (user.role === 'finance' || user.role === 'admin') {
        if (p.proformaStatus === 'generated') {
          tasks.push({ processId: p.id, processTitle: p.title, task: { id: `prof-auth-${p.id}`, text: 'Autorizar proforma', createdAt: p.updatedAt, completed: false } });
        }
        if (p.proformaStatus === 'sent') {
          tasks.push({ processId: p.id, processTitle: p.title, task: { id: `prof-pay-${p.id}`, text: 'Registrar pago de proforma', createdAt: p.updatedAt, completed: false } });
        }
        if (p.deliveryStatus === 'signed' && p.invoiceStatus === 'pending') {
          tasks.push({ processId: p.id, processTitle: p.title, task: { id: `inv-gen-${p.id}`, text: 'Generar factura', createdAt: p.updatedAt, completed: false } });
        }
        if (p.invoiceStatus === 'sent') {
          tasks.push({ processId: p.id, processTitle: p.title, task: { id: `inv-pay-${p.id}`, text: 'Registrar pago final', createdAt: p.updatedAt, completed: false } });
        }
      }

      if (user.role === 'sales' || user.role === 'admin') {
        if (p.proformaStatus === 'pending') {
          tasks.push({ processId: p.id, processTitle: p.title, task: { id: `prof-gen-${p.id}`, text: 'Generar proforma', createdAt: p.updatedAt, completed: false } });
        }
        if (p.proformaStatus === 'authorized') {
          tasks.push({ processId: p.id, processTitle: p.title, task: { id: `prof-send-${p.id}`, text: 'Enviar proforma al cliente', createdAt: p.updatedAt, completed: false } });
        }
      }

      if (user.role === 'production' || user.role === 'admin') {
        if (p.orderStatus === 'sent_to_production') {
          tasks.push({ processId: p.id, processTitle: p.title, task: { id: `prod-start-${p.id}`, text: 'Iniciar fabricación', createdAt: p.updatedAt, completed: false } });
        }
        if (p.orderStatus === 'in_manufacturing') {
          tasks.push({ processId: p.id, processTitle: p.title, task: { id: `prod-end-${p.id}`, text: 'Finalizar fabricación', createdAt: p.updatedAt, completed: false } });
        }
      }

      if (user.role === 'logistics' || user.role === 'admin') {
        if (p.orderStatus === 'ready_for_pickup') {
          tasks.push({ processId: p.id, processTitle: p.title, task: { id: `log-ship-${p.id}`, text: 'Generar albarán y enviar', createdAt: p.updatedAt, completed: false } });
        }
        if (p.deliveryStatus === 'generated') {
          tasks.push({ processId: p.id, processTitle: p.title, task: { id: `log-sign-${p.id}`, text: 'Registrar firma de albarán', createdAt: p.updatedAt, completed: false } });
        }
      }
    });
    
    return tasks.sort((a, b) => b.task.createdAt - a.task.createdAt);
  }, [processes, user]);

  const getValidityBadge = (process: any) => {
    if (!process.validUntil || process.currentStage !== 'cotizacion') return null;
    const now = Date.now();
    const daysLeft = Math.ceil((process.validUntil - now) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return <Badge variant="destructive" className="text-[10px] ml-2">Vencida</Badge>;
    if (daysLeft <= 3) return <Badge variant="warning" className="text-[10px] ml-2">Vence en {daysLeft}d</Badge>;
    return null;
  };

  return (
    <div className="space-y-6">
      {useRoleFilter && user?.role !== 'admin' && user?.role !== 'sales' && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">
              Viendo expedientes filtrados para tu rol (<strong>{roleTranslations[user.role]}</strong>).
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setUseRoleFilter(false)} className="text-blue-700 hover:bg-blue-100">
            Ver todos
          </Button>
        </div>
      )}

      {/* Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-white border-none shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <CheckCircle2 className="h-16 w-16" />
          </div>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500 font-medium mb-1">Facturado (Mes)</p>
            <h3 className="text-2xl font-bold text-slate-800">
              {stats.billedThisMonth.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </h3>
            <p className="text-xs text-green-600 mt-2 font-medium bg-green-50 w-fit px-2 py-0.5 rounded flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> {stats.completed} completados
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp className="h-16 w-16" />
          </div>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500 font-medium mb-1">Pipeline Activo</p>
            <h3 className="text-2xl font-bold text-slate-800">
              {stats.pipelineValue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </h3>
            <p className="text-xs text-blue-600 mt-2 font-medium bg-blue-50 w-fit px-2 py-0.5 rounded flex items-center gap-1">
              <FileText className="h-3 w-3" /> {stats.active} en curso
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Clock className="h-16 w-16" />
          </div>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500 font-medium mb-1">Tiempo Medio</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.avgDays} <span className="text-sm font-normal text-slate-500">días</span></h3>
            <p className="text-xs text-slate-500 mt-2 font-medium bg-slate-50 w-fit px-2 py-0.5 rounded">
              Desde oferta a completado
            </p>
          </CardContent>
        </Card>

        <Card className={`border-none shadow-sm relative overflow-hidden group ${stats.slaAtRisk > 0 ? 'bg-red-50' : 'bg-white'}`}>
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <AlertTriangle className="h-16 w-16" />
          </div>
          <CardContent className="p-4">
            <p className={`text-sm font-medium mb-1 ${stats.slaAtRisk > 0 ? 'text-red-600' : 'text-slate-500'}`}>Riesgo SLA</p>
            <h3 className={`text-2xl font-bold ${stats.slaAtRisk > 0 ? 'text-red-700' : 'text-slate-800'}`}>
              {stats.slaAtRisk} <span className="text-sm font-normal opacity-70">expedientes</span>
            </h3>
            <p className={`text-xs mt-2 font-medium w-fit px-2 py-0.5 rounded flex items-center gap-1 ${stats.slaAtRisk > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-50 text-slate-500'}`}>
              <AlertTriangle className="h-3 w-3" /> &gt; 2 días en misma fase
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight">Expedientes Activos</h2>
          <div className="hidden sm:flex bg-slate-100 p-1 rounded-md border">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-sm transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-codiagro-green' : 'text-slate-500 hover:text-slate-700'}`}
              title="Vista en cuadrícula"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button 
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-sm transition-colors ${viewMode === 'kanban' ? 'bg-white shadow-sm text-codiagro-green' : 'text-slate-500 hover:text-slate-700'}`}
              title="Vista Kanban"
            >
              <KanbanSquare className="h-4 w-4" />
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-sm transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-codiagro-green' : 'text-slate-500 hover:text-slate-700'}`}
              title="Vista Tabla"
            >
              <TableIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <div className="relative flex-grow sm:flex-grow-0 sm:w-48">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-full pl-9 p-2 border rounded-md text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Button 
            variant={showFilters ? "default" : "outline"} 
            onClick={() => setShowFilters(!showFilters)} 
            className="px-3"
            title="Filtros Avanzados"
          >
            Filtros
          </Button>
          
          <Button 
            variant={hideCompleted ? "default" : "outline"} 
            onClick={() => setHideCompleted(!hideCompleted)} 
            className={`px-3 ${hideCompleted ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
            title={hideCompleted ? "Mostrar completados" : "Ocultar completados"}
          >
            <CheckSquare className={`h-4 w-4 ${!hideCompleted ? 'mr-0' : 'mr-2'}`} />
            {hideCompleted && <span className="text-sm">Ocultando</span>}
          </Button>

          <Button variant="outline" onClick={exportToPDF} title="Exportar a PDF" className="px-3">
            <Download className="h-4 w-4" />
          </Button>

          <Button variant="outline" onClick={exportToCSV} title="Exportar a CSV" className="px-3">
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
          </Button>

          {(user?.role === 'sales' || user?.role === 'admin') && (
            <div className="flex gap-2">
              <input 
                type="file" 
                accept=".pdf" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFastPdfUpload}
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} title="Crear desde PDF">
                <UploadCloud className="h-4 w-4" />
              </Button>
              <Button onClick={() => setIsCreating(true)} className="bg-codiagro-green hover:bg-codiagro-green-dark">
                <Plus className="mr-2 h-4 w-4" /> Nuevo
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fase</label>
              <select 
                className="w-full p-2 border rounded-md text-sm bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todas las fases</option>
                <option value="cotizacion">Cotización</option>
                <option value="proforma">Proforma</option>
                <option value="pedido">Pedido</option>
                <option value="albaran">Albarán</option>
                <option value="factura">Factura</option>
                <option value="completado">Completado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Etiqueta</label>
              <select 
                className="w-full p-2 border rounded-md text-sm bg-white"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value as any)}
              >
                <option value="all">Todas las etiquetas</option>
                <option value="Urgente">Urgente</option>
                <option value="VIP">VIP</option>
                <option value="Exportación">Exportación</option>
                <option value="Frío">Frío</option>
                <option value="Muestra">Muestra</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fecha de Creación</label>
              <select 
                className="w-full p-2 border rounded-md text-sm bg-white"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
              >
                <option value="all">Cualquier fecha</option>
                <option value="today">Hoy</option>
                <option value="this_week">Últimos 7 días</option>
                <option value="this_month">Este mes</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Ordenar por</label>
              <select 
                className="w-full p-2 border rounded-md text-sm bg-white"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="newest">Más recientes</option>
                <option value="oldest">Más antiguos</option>
                <option value="name">Por nombre (A-Z)</option>
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions Bar */}
      {selectedProcesses.length > 0 && (
        <div className="bg-codiagro-green/10 border border-codiagro-green/30 rounded-lg p-3 flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-codiagro-green-dark">{selectedProcesses.length} seleccionados</span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedProcesses([])} className="text-slate-500 hover:text-slate-700 h-8">
              Desmarcar todos
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="text-sm border-slate-300 rounded-md py-1.5 pl-3 pr-8 focus:ring-codiagro-green focus:border-codiagro-green"
              onChange={(e) => {
                handleBulkMove(e.target.value);
                e.target.value = ""; // Reset after selection
              }}
              defaultValue=""
            >
              <option value="" disabled>Mover a fase...</option>
              <option value="cotizacion">Cotización</option>
              <option value="proforma">Proforma</option>
              <option value="pedido">Pedido</option>
              <option value="albaran">Albarán</option>
              <option value="factura">Factura</option>
              <option value="completado">Completado</option>
            </select>
            <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
            </Button>
          </div>
        </div>
      )}

      {isCreating && (
        <Card className="bg-slate-50 border-dashed border-2 border-codiagro-green/30 shadow-sm animate-in fade-in slide-in-from-top-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-codiagro-green-dark">Crear Nuevo Expediente</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Título del Proyecto</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded-md" 
                    value={newTitle} 
                    onChange={e => setNewTitle(e.target.value)} 
                    placeholder="Ej. Implementación ERP"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cliente</label>
                  <input 
                    type="text" 
                    list="clients-list"
                    className="w-full p-2 border rounded-md" 
                    value={newClient} 
                    onChange={e => setNewClient(e.target.value)} 
                    placeholder="Ej. Acme Corp"
                    required
                    disabled={isSubmitting}
                  />
                  <datalist id="clients-list">
                    {uniqueClients.map(client => (
                      <option key={client} value={client} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Plantilla (Opcional)</label>
                  <select 
                    className="w-full p-2 border rounded-md bg-white text-sm"
                    value={newTemplateId}
                    onChange={e => setNewTemplateId(e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="">Sin plantilla</option>
                    {templates?.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Importe</label>
                  <div className="flex relative">
                    <select 
                      className="border rounded-l-md bg-slate-50 text-slate-600 text-sm p-2 w-20 border-r-0 focus:outline-none focus:ring-1 focus:ring-codiagro-green focus:border-codiagro-green z-10"
                      value={newCurrency}
                      onChange={e => setNewCurrency(e.target.value as Currency)}
                      disabled={isSubmitting}
                    >
                      {(Object.keys(currencySymbols) as Currency[]).map(c => (
                        <option key={c} value={c}>{c} ({currencySymbols[c]})</option>
                      ))}
                    </select>
                    <input 
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      className="w-full p-2 pl-3 border rounded-r-md bg-white text-sm focus:outline-none focus:ring-1 focus:ring-codiagro-green focus:border-codiagro-green"
                      value={newAmount}
                      onChange={e => setNewAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Adjuntar PDF (Opcional)</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="file" 
                    accept=".pdf"
                    className="w-full p-2 border rounded-md bg-white text-sm" 
                    onChange={e => setNewFile(e.target.files?.[0] || null)}
                    disabled={isSubmitting}
                  />
                  {newFile && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setNewFile(null)} className="text-red-500 hover:text-red-700">
                      Quitar
                    </Button>
                  )}
                </div>
                {newFile && <p className="text-xs text-codiagro-green font-medium">Archivo seleccionado: {newFile.name}</p>}
                <p className="text-xs text-slate-500 italic">Este archivo será el documento base del expediente.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => {
                  setIsCreating(false);
                  setNewFile(null);
                  setNewTitle('');
                  setNewClient('');
                  setNewTemplateId('');
                  setNewAmount('');
                }} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creando...' : 'Crear Expediente'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProcesses.map((process) => {
            const isStagnant = process.currentStage !== 'completado' && (Date.now() - process.updatedAt > 3 * 24 * 60 * 60 * 1000);
            return (
            <Card key={process.id} className={`hover:shadow-md transition-shadow relative group ${selectedProcesses.includes(process.id) ? 'ring-2 ring-codiagro-green' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start pr-6">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={selectedProcesses.includes(process.id)}
                      onChange={() => toggleProcessSelection(process.id)}
                      className="rounded border-slate-300 text-codiagro-green focus:ring-codiagro-green mt-1"
                    />
                    <CardTitle className="text-lg line-clamp-1" title={process.title}>{process.title}</CardTitle>
                    {getValidityBadge(process)}
                  </div>
                  {getStageBadge(process.currentStage)}
                </div>
                <div className="flex justify-between items-start pl-6 gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] text-slate-400 uppercase tracking-tight font-medium">Cliente</span>
                    <p className="text-sm text-slate-600 truncate font-medium" title={process.clientName}>{process.clientName}</p>
                  </div>
                  <div className="flex flex-col items-end text-right min-w-0">
                    <span className="text-[10px] text-slate-400 uppercase tracking-tight font-medium">Importe</span>
                    {process.amount != null && <span className="text-sm font-bold text-codiagro-green whitespace-nowrap">{Number(process.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>}
                  </div>
                </div>
                
                {process.createdByName && (
                  <div className="mt-2 pl-6 flex items-center gap-1.5 opacity-70">
                    <span className="text-[10px] text-slate-400 uppercase tracking-tight font-medium whitespace-nowrap">Creado por:</span>
                    <span className="text-xs text-slate-500 truncate italic">{process.createdByName}</span>
                  </div>
                )}
                
                {process.tags && process.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 pl-6">
                    {process.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 bg-codiagro-orange/10 text-codiagro-orange-dark border-none">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                
                {/* Delete button - visible on hover or focus */}
                {(user?.role === 'sales' || user?.role === 'admin') && (
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                    {confirmDeleteId === process.id ? (
                      <div className="flex bg-white shadow-sm rounded-md border border-red-100 overflow-hidden">
                        <button 
                          onClick={() => handleDelete(process.id)}
                          disabled={deletingId === process.id}
                          className="px-2 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
                        >
                          {deletingId === process.id ? '...' : 'Eliminar'}
                        </button>
                        <button 
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={deletingId === process.id}
                          className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setConfirmDeleteId(process.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="Eliminar expediente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-xs text-slate-400 mb-4 flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    Actualizado: {format(process.updatedAt, "d MMM yyyy", { locale: es })}
                    {isStagnant && (
                      <span className="flex items-center text-red-500 ml-1" title="Lleva más de 3 días sin actualizarse">
                        <AlertTriangle className="h-3 w-3 mr-0.5" /> Estancado
                      </span>
                    )}
                  </span>
                  {process.estimatedDeliveryDate && (
                    <span className="flex items-center gap-1 text-codiagro-green" title="Fecha estimada de entrega">
                      <Clock className="w-3 h-3" />
                      {format(process.estimatedDeliveryDate, "d MMM", { locale: es })}
                    </span>
                  )}
                </div>
                <Link to={`/process/${process.id}`}>
                  <Button variant="outline" className="w-full justify-between group/btn">
                    Ver Detalles
                    <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )})}
          
          {filteredProcesses.length === 0 && !isCreating && (
            <div className="col-span-full text-center py-12 text-slate-500 bg-white rounded-lg border border-dashed">
              <FileText className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <p>{searchTerm ? 'No se encontraron expedientes que coincidan con la búsqueda.' : 'No hay expedientes activos.'}</p>
              {!searchTerm && (user?.role === 'sales' || user?.role === 'admin') && (
                <Button variant="link" onClick={() => setIsCreating(true)}>Crear el primero</Button>
              )}
            </div>
          )}
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="flex overflow-x-auto pb-4 gap-4 snap-x">
          {KANBAN_STAGES.map(stage => {
            const stageProcesses = filteredProcesses.filter(p => p.currentStage === stage.id);
            return (
              <div 
                key={stage.id} 
                className={`flex-shrink-0 w-80 rounded-lg border ${stage.color} flex flex-col snap-start`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                <div className="p-3 border-b border-inherit bg-white/50 flex justify-between items-center rounded-t-lg">
                  <h3 className="font-semibold text-slate-700">{stage.label}</h3>
                  <Badge variant="secondary" className="bg-white">{stageProcesses.length}</Badge>
                </div>
                <div className="p-3 flex-1 flex flex-col gap-3 min-h-[200px]">
                  {stageProcesses.map(process => (
                    <Card 
                      key={process.id} 
                      className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${draggingId === process.id ? 'opacity-50 scale-95' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, process.id)}
                      onDragEnd={() => setDraggingId(null)}
                    >
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-medium text-sm line-clamp-2" title={process.title}>
                            {process.title}
                            {getValidityBadge(process)}
                          </h4>
                        </div>
                        <div className="flex flex-col mb-2">
                          <span className="text-[9px] text-slate-400 uppercase font-medium">Cliente</span>
                          <p className="text-xs text-slate-600 truncate font-medium" title={process.clientName}>{process.clientName}</p>
                        </div>
                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-md mb-3">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-slate-400 uppercase font-medium">Importe</span>
                            {process.amount != null && <p className="text-sm font-bold text-codiagro-green">{Number(process.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>}
                          </div>
                          {process.createdByName && (
                            <div className="flex flex-col items-end text-right">
                              <span className="text-[9px] text-slate-400 uppercase font-medium">Creado por</span>
                              <p className="text-[10px] text-slate-500 italic truncate max-w-[80px]">{process.createdByName}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-between items-center mt-auto">
                          <span className="text-[10px] text-slate-400">
                            {format(process.updatedAt, "d MMM", { locale: es })}
                          </span>
                          <Link to={`/process/${process.id}`}>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                              Abrir
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {stageProcesses.length === 0 && (
                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-inherit rounded-lg bg-white/30">
                      <span className="text-xs text-slate-400 font-medium">Soltar aquí</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 bg-slate-50 border-b">
                <tr>
                  <th className="p-4 w-10">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-codiagro-green focus:ring-codiagro-green"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProcesses(filteredProcesses.map(p => p.id));
                        } else {
                          setSelectedProcesses([]);
                        }
                      }}
                      checked={selectedProcesses.length === filteredProcesses.length && filteredProcesses.length > 0}
                    />
                  </th>
                  <th className="p-4 font-medium">Expediente</th>
                  <th className="p-4 font-medium">Cliente</th>
                  <th className="p-4 font-medium">Importe</th>
                  <th className="p-4 font-medium">Fase</th>
                  <th className="p-4 font-medium">Actualizado</th>
                  <th className="p-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProcesses.map(process => {
                  const isStagnant = process.currentStage !== 'completado' && (Date.now() - process.updatedAt > 3 * 24 * 60 * 60 * 1000);
                  return (
                    <tr key={process.id} className={`hover:bg-slate-50 ${selectedProcesses.includes(process.id) ? 'bg-codiagro-green/5' : ''}`}>
                      <td className="p-4">
                        <input 
                          type="checkbox" 
                          checked={selectedProcesses.includes(process.id)}
                          onChange={() => toggleProcessSelection(process.id)}
                          className="rounded border-slate-300 text-codiagro-green focus:ring-codiagro-green"
                        />
                      </td>
                      <td className="p-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          {process.title}
                          {getValidityBadge(process)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-slate-700">{process.clientName}</span>
                          {process.createdByName && <span className="text-[10px] text-slate-400 italic">Por: {process.createdByName}</span>}
                        </div>
                      </td>
                      <td className="p-4 font-medium text-codiagro-green">{process.amount != null ? Number(process.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '-'}</td>
                      <td className="p-4">{getStageBadge(process.currentStage)}</td>
                      <td className="p-4 text-slate-500">
                        <div className="flex items-center gap-1">
                          {format(process.updatedAt, "d MMM yyyy", { locale: es })}
                          {isStagnant && <AlertTriangle className="h-3 w-3 text-red-500 ml-1" />}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <Link to={`/process/${process.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 px-2">Abrir</Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {filteredProcesses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">No se encontraron expedientes.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-12 pt-8 border-t">
        {/* My Tasks Section */}
        <div className="lg:col-span-1">
          <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-codiagro-green" />
            Mis Tareas Pendientes
          </h2>
          <Card className="bg-white border-none shadow-sm">
            <CardContent className="p-0">
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {myPendingTasks.map(({ processId, processTitle, task, type }) => (
                  <div key={task.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {type === 'auth' ? (
                          <ShieldCheck className="h-4 w-4 text-codiagro-green animate-pulse" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-slate-800">{task.text}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Expediente: <Link to={`/process/${processId}`} className="text-codiagro-green hover:underline">{processTitle}</Link>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {myPendingTasks.length === 0 && (
                  <div className="p-8 text-center text-slate-500">
                    <CheckCircle2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    No tienes tareas pendientes.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity History Section */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold tracking-tight">Actividad Reciente</h2>
            <div className="flex bg-slate-100 p-1 rounded-md border text-xs">
              <button 
                onClick={() => setActivityFilter('all')}
                className={`px-3 py-1 rounded-sm transition-colors ${activityFilter === 'all' ? 'bg-white shadow-sm text-codiagro-green font-medium' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => setActivityFilter('me')}
                className={`px-3 py-1 rounded-sm transition-colors ${activityFilter === 'me' ? 'bg-white shadow-sm text-codiagro-green font-medium' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Mis acciones
              </button>
            </div>
          </div>
          <Card className="bg-white border-none shadow-sm">
            <CardContent className="p-0">
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {logs
                  .filter(log => activityFilter === 'all' || log.performedBy === user?.uid)
                  .slice(0, 20)
                  .map(log => {
                  const process = processes.find(p => p.id === log.processId);
                  return (
                    <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {log.action}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Expediente: <Link to={`/process/${log.processId}`} className="text-codiagro-green hover:underline">{process ? process.title : 'Desconocido'}</Link>
                        </p>
                      </div>
                      <div className="flex flex-col sm:items-end text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{log.performedByName}</span>
                        <span>{format(log.timestamp, "d MMM yyyy, HH:mm", { locale: es })}</span>
                      </div>
                    </div>
                  );
                })}
                {logs.filter(log => activityFilter === 'all' || log.performedBy === user?.uid).length === 0 && (
                  <div className="p-8 text-center text-slate-500">
                    No hay actividad reciente registrada.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
