import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { SalesProcess, ActivityLog, ProcessStage, Document, Comment, ProcessTag, Currency, FieldChange } from '../types';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

export interface ProcessTemplate {
  id: string;
  name: string;
  description: string;
  defaultTags: ProcessTag[];
  defaultTasks: string[];
}

export const defaultTemplates: ProcessTemplate[] = [
  { id: 't1', name: 'Estándar', description: 'Proceso de venta habitual', defaultTags: [], defaultTasks: ['Verificar datos de cliente', 'Enviar cotización'] },
  { id: 't2', name: 'Exportación', description: 'Venta internacional', defaultTags: ['Exportación'], defaultTasks: ['Solicitar certificado de origen', 'Revisar aduanas', 'Contratar flete'] },
  { id: 't3', name: 'Muestra', description: 'Envío de muestras sin coste', defaultTags: ['Muestra'], defaultTasks: ['Preparar paquete de muestra', 'Generar albarán de muestra'] }
];

interface DataContextType {
  processes: SalesProcess[];
  logs: ActivityLog[];
  loading: boolean;
  templates: ProcessTemplate[];
  createProcess: (title: string, clientName: string, amount: number, pdfFile?: File, templateId?: string, currency?: Currency) => Promise<void>;
  duplicateProcess: (processId: string) => Promise<void>;
  updateProcessStatus: (processId: string, updates: Partial<SalesProcess>, actionName: string) => Promise<void>;
  deleteProcess: (processId: string) => Promise<void>;
  getProcessLogs: (processId: string) => ActivityLog[];
  addDocument: (processId: string, file: File, stage: ProcessStage, groupId?: string) => Promise<void>;
  addComment: (processId: string, text: string) => Promise<void>;
  addTask: (processId: string, text: string) => Promise<void>;
  toggleTask: (processId: string, taskId: string) => Promise<void>;
  bulkUpdateProcesses: (processIds: string[], updates: Partial<SalesProcess>, actionName: string) => Promise<void>;
  bulkDeleteProcesses: (processIds: string[]) => Promise<void>;
  generateTrackingLink: (processId: string) => Promise<string>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [processes, setProcesses] = useState<SalesProcess[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchProcesses = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_processes')
        .select('*')
        .order('updatedAt', { ascending: false });
      
      if (error) throw error;
      setProcesses(data as SalesProcess[]);
    } catch (error) {
      console.error("Error fetching processes:", error);
    }
  };

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('timestamp', { ascending: false });
      
      if (error) throw error;
      setLogs(data as ActivityLog[]);
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  };

  useEffect(() => {
    if (!user) {
      setProcesses([]);
      setLogs([]);
      setLoading(false);
      return;
    }

    fetchProcesses();
    fetchLogs();
    setLoading(false);

    const processesSub = supabase.channel('processes_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_processes' }, () => {
        fetchProcesses();
      }).subscribe();

    const logsSub = supabase.channel('logs_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => {
        fetchLogs();
      }).subscribe();

    return () => {
      supabase.removeChannel(processesSub);
      supabase.removeChannel(logsSub);
    };
  }, [user]);

  const createProcess = async (title: string, clientName: string, amount: number, pdfFile?: File, templateId?: string, currency: Currency = 'EUR') => {
    if (!user) return;
    
    let pdfUrl = '';
    let pdfName = '';
    
    let initialTags: ProcessTag[] = [];
    let initialTasks: any[] = [];
    
    if (templateId) {
      const template = defaultTemplates.find(t => t.id === templateId);
      if (template) {
        initialTags = template.defaultTags;
        initialTasks = template.defaultTasks.map(text => ({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          text,
          completed: false,
          createdAt: Date.now(),
          createdBy: user.uid
        }));
      }
    }

    try {
      if (pdfFile) {
        const fileExt = pdfFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 11)}-${Date.now()}.${fileExt}`;
        const filePath = `initial/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, pdfFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        pdfUrl = urlData.publicUrl;
        pdfName = pdfFile.name;
      }

      const newProcess: Omit<SalesProcess, 'id'> = {
        title,
        clientName,
        currentStage: 'oferta',
        quoteStatus: 'draft',
        proformaStatus: 'pending',
        orderStatus: 'pending',
        deliveryStatus: 'pending',
        invoiceStatus: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: user.uid,
        createdByName: user.displayName || user.email || 'Usuario',
        pdfUrl,
        pdfName,
        tags: initialTags,
        tasks: initialTasks,
        amount,
        currency,
        documents: pdfUrl ? [{
          id: Date.now().toString(),
          name: pdfName,
          url: pdfUrl,
          stage: 'oferta',
          uploadedBy: user.displayName || user.email || 'Usuario',
          uploadedAt: Date.now(),
          version: 1,
          groupId: Date.now().toString()
        }] : [],
        comments: [],
      };

      const { data, error } = await supabase
        .from('sales_processes')
        .insert([newProcess])
        .select()
        .single();
        
      if (error) throw error;

      await supabase.from('activity_logs').insert([{
        processId: data.id,
        action: 'Expediente Creado',
        performedBy: user.uid,
        performedByName: user.displayName,
        timestamp: Date.now(),
        details: `Expediente para ${clientName} creado.${pdfFile ? ` Archivo adjunto: ${pdfFile.name}` : ''}`
      }]);
      
      toast.success("Expediente creado correctamente");
    } catch (error: any) {
      console.error("Error creating process:", error);
      toast.error("Error al crear el expediente.");
      throw error;
    }
  };

  // Mejora #3: Duplicar Expediente
  const duplicateProcess = async (processId: string) => {
    if (!user) return;
    const source = processes.find(p => p.id === processId);
    if (!source) return;

    try {
      const newProcess: Omit<SalesProcess, 'id'> = {
        title: `${source.title} (copia)`,
        clientName: source.clientName,
        currentStage: 'oferta',
        quoteStatus: 'draft',
        proformaStatus: 'pending',
        orderStatus: 'pending',
        deliveryStatus: 'pending',
        invoiceStatus: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: user.uid,
        createdByName: user.displayName || user.email || 'Usuario',
        pdfUrl: '',
        pdfName: '',
        tags: source.tags || [],
        tasks: (source.tasks || []).map(t => ({ ...t, id: Date.now().toString() + Math.random().toString(36).substr(2, 5), completed: false })),
        amount: source.amount,
        currency: source.currency || 'EUR',
        documents: [],
        comments: [],
      };

      const { data, error } = await supabase
        .from('sales_processes')
        .insert([newProcess])
        .select()
        .single();
      if (error) throw error;

      await supabase.from('activity_logs').insert([{
        processId: data.id,
        action: 'Expediente Duplicado',
        performedBy: user.uid,
        performedByName: user.displayName,
        timestamp: Date.now(),
        details: `Duplicado desde expediente "${source.title}"`
      }]);
      toast.success(`Expediente duplicado: "${newProcess.title}"`);
    } catch (error: any) {
      console.error("Error duplicating process:", error);
      toast.error("Error al duplicar el expediente.");
    }
  };

  // Mejora #10: Audit trail with field-level changes
  const updateProcessStatus = async (processId: string, updates: Partial<SalesProcess>, actionName: string) => {
    if (!user) return;
    
    try {
      // Build field changes for audit trail
      const currentProcess = processes.find(p => p.id === processId);
      const fieldChanges: FieldChange[] = [];
      if (currentProcess) {
        const trackedFields = ['currentStage', 'quoteStatus', 'proformaStatus', 'orderStatus', 'deliveryStatus', 'invoiceStatus', 'amount', 'currency'];
        trackedFields.forEach(field => {
          const key = field as keyof SalesProcess;
          if (updates[key] !== undefined && updates[key] !== currentProcess[key]) {
            fieldChanges.push({
              field,
              from: String(currentProcess[key] ?? ''),
              to: String(updates[key] ?? '')
            });
          }
        });
      }

      const { error } = await supabase
        .from('sales_processes')
        .update({
          ...updates,
          updatedAt: Date.now()
        })
        .eq('id', processId);

      if (error) throw error;

      await supabase.from('activity_logs').insert([{
        processId,
        action: actionName,
        performedBy: user.uid,
        performedByName: user.displayName,
        timestamp: Date.now(),
        changes: fieldChanges.length > 0 ? fieldChanges : null
      }]);
    } catch (error: any) {
      console.error("Error updating process:", error);
      toast.error("Error al actualizar el expediente.");
      throw error;
    }
  };

  const deleteProcess = async (processId: string) => {
    if (!user) return;
    try {
      const processToDelete = processes.find(p => p.id === processId);
      
      // Delete from DB
      const { error } = await supabase
        .from('sales_processes')
        .delete()
        .eq('id', processId);
        
      if (error) throw error;

      // Cleanup storage
      if (processToDelete) {
        const pathsToDelete: string[] = [];
        if (processToDelete.pdfUrl) {
          const parts = processToDelete.pdfUrl.split('/documents/');
          if (parts.length > 1) pathsToDelete.push(parts[1]);
        }
        if (processToDelete.documents) {
          processToDelete.documents.forEach(doc => {
            const parts = doc.url.split('/documents/');
            if (parts.length > 1) pathsToDelete.push(parts[1]);
          });
        }
        if (pathsToDelete.length > 0) {
          await supabase.storage.from('documents').remove(pathsToDelete);
        }
      }

      setProcesses(prev => prev.filter(p => p.id !== processId));
      setLogs(prev => prev.filter(l => l.processId !== processId));
      toast.success("Expediente eliminado correctamente");
    } catch (error: any) {
      console.error("Error deleting process:", error);
      toast.error("Error al eliminar el expediente.");
      throw error;
    }
  };

  const getProcessLogs = (processId: string) => {
    return logs.filter(log => log.processId === processId);
  };

  const addDocument = async (processId: string, file: File, stage: ProcessStage, groupId?: string) => {
    if (!user) return;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 11)}-${Date.now()}.${fileExt}`;
      const filePath = `${processId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const url = urlData.publicUrl;
      
      const process = processes.find(p => p.id === processId);
      if (!process) throw new Error("Process not found");

      const existingDocs = process.documents || [];
      
      let version = 1;
      let finalGroupId = Date.now().toString();

      if (groupId) {
        finalGroupId = groupId;
        const groupDocs = existingDocs.filter(d => d.groupId === groupId);
        if (groupDocs.length > 0) {
          version = Math.max(...groupDocs.map(d => d.version || 1)) + 1;
        }
      } else {
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        const similarDocs = existingDocs.filter(d => d.name.replace(/\.[^/.]+$/, "") === baseName || d.stage === stage);
        if (similarDocs.length > 0) {
          version = similarDocs.length + 1;
          finalGroupId = similarDocs[0].groupId || similarDocs[0].id;
        }
      }

      const newDoc: Document = {
        id: Date.now().toString(),
        name: file.name,
        url,
        stage,
        uploadedBy: user.displayName || user.email || 'Usuario',
        uploadedAt: Date.now(),
        version,
        groupId: finalGroupId
      };

      await updateProcessStatus(processId, {
        documents: [...existingDocs, newDoc]
      }, `Documento adjuntado en fase ${stage} (v${version})`);
      
      toast.success("Documento subido correctamente");
    } catch (error: any) {
      console.error("Error uploading document:", error);
      toast.error("Error al subir el documento.");
      throw error;
    }
  };

  const addComment = async (processId: string, text: string) => {
    if (!user) return;
    try {
      const newComment: Comment = {
        id: Date.now().toString(),
        text,
        authorId: user.uid,
        authorName: user.displayName,
        authorRole: user.role,
        timestamp: Date.now()
      };

      const process = processes.find(p => p.id === processId);
      if (!process) throw new Error("Process not found");

      const existingComments = process.comments || [];
      
      await updateProcessStatus(processId, {
        comments: [...existingComments, newComment]
      }, `Nuevo comentario añadido`);
      
    } catch (error: any) {
      console.error("Error adding comment:", error);
      toast.error("Error al añadir el comentario.");
      throw error;
    }
  };

  const addTask = async (processId: string, text: string) => {
    if (!user) return;
    try {
      const process = processes.find(p => p.id === processId);
      if (!process) throw new Error("Process not found");

      const newTask = {
        id: Date.now().toString(),
        text,
        completed: false,
        createdAt: Date.now(),
        createdBy: user.uid
      };

      const existingTasks = process.tasks || [];
      
      await updateProcessStatus(processId, {
        tasks: [...existingTasks, newTask]
      }, `Nueva tarea añadida`);
      
    } catch (error: any) {
      console.error("Error adding task:", error);
      toast.error("Error al añadir la tarea.");
      throw error;
    }
  };

  const toggleTask = async (processId: string, taskId: string) => {
    if (!user) return;
    try {
      const process = processes.find(p => p.id === processId);
      if (!process) throw new Error("Process not found");

      const existingTasks = process.tasks || [];
      const updatedTasks = existingTasks.map(t => 
        t.id === taskId ? { ...t, completed: !t.completed } : t
      );
      
      await updateProcessStatus(processId, {
        tasks: updatedTasks
      }, `Estado de tarea actualizado`);
      
    } catch (error: any) {
      console.error("Error toggling task:", error);
      toast.error("Error al actualizar la tarea.");
      throw error;
    }
  };

  const bulkUpdateProcesses = async (processIds: string[], updates: Partial<SalesProcess>, actionName: string) => {
    if (!user) return;
    try {
      const promises = processIds.map(id => updateProcessStatus(id, updates, actionName));
      await Promise.all(promises);
      toast.success(`Se actualizaron ${processIds.length} expedientes`);
    } catch (error) {
      console.error("Error in bulk update:", error);
      toast.error("Error al actualizar expedientes en lote");
      throw error;
    }
  };

  const bulkDeleteProcesses = async (processIds: string[]) => {
    if (!user) return;
    try {
      const processesToDelete = processes.filter(p => processIds.includes(p.id));

      const { error } = await supabase
        .from('sales_processes')
        .delete()
        .in('id', processIds);
        
      if (error) throw error;

      // Cleanup storage for all processes
      const allPaths: string[] = [];
      processesToDelete.forEach(p => {
        if (p.pdfUrl) {
          const parts = p.pdfUrl.split('/documents/');
          if (parts.length > 1) allPaths.push(parts[1]);
        }
        if (p.documents) {
          p.documents.forEach(doc => {
            const parts = doc.url.split('/documents/');
            if (parts.length > 1) allPaths.push(parts[1]);
          });
        }
      });

      if (allPaths.length > 0) {
        await supabase.storage.from('documents').remove(allPaths);
      }
      
      setProcesses(prev => prev.filter(p => !processIds.includes(p.id)));
      setLogs(prev => prev.filter(l => !processIds.includes(l.processId)));
      toast.success(`Se eliminaron ${processIds.length} expedientes`);
    } catch (error) {
      console.error("Error in bulk delete:", error);
      toast.error("Error al eliminar expedientes en lote");
      throw error;
    }
  };

  const generateTrackingLink = async (processId: string) => {
    if (!user) return "";
    try {
      const process = processes.find(p => p.id === processId);
      if (!process) throw new Error("Process not found");
      
      if (process.trackingToken) {
        return `${window.location.origin}/track/${processId}/${process.trackingToken}`;
      }
      
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      await updateProcessStatus(processId, { trackingToken: token }, "Enlace de seguimiento generado");
      
      return `${window.location.origin}/track/${processId}/${token}`;
    } catch (error) {
      console.error("Error generating tracking link:", error);
      toast.error("Error al generar el enlace");
      throw error;
    }
  };

  return (
    <DataContext.Provider value={{ processes, logs, loading, templates: defaultTemplates, createProcess, duplicateProcess, updateProcessStatus, deleteProcess, getProcessLogs, addDocument, addComment, addTask, toggleTask, bulkUpdateProcesses, bulkDeleteProcesses, generateTrackingLink }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

