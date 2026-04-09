import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { SalesProcess, ActivityLog, ProcessStage, Document, Comment, ProcessTag } from '../types';
import { useAuth } from './AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firebase-utils';
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
  createProcess: (title: string, clientName: string, pdfFile?: File, templateId?: string) => Promise<void>;
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
  const [dataError, setDataError] = useState<Error | null>(null);
  const { user } = useAuth();

  if (dataError) {
    throw dataError;
  }

  useEffect(() => {
    if (!user) {
      setProcesses([]);
      setLogs([]);
      setLoading(false);
      return;
    }

    const qProcesses = query(collection(db, 'sales_processes'), orderBy('updatedAt', 'desc'));
    const unsubscribeProcesses = onSnapshot(qProcesses, (snapshot) => {
      const procs: SalesProcess[] = [];
      snapshot.forEach((doc) => {
        procs.push({ id: doc.id, ...doc.data() } as SalesProcess);
      });
      setProcesses(procs);
    }, (error: any) => {
      console.error("Error fetching processes:", error);
      if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
        try {
          handleFirestoreError(error, OperationType.LIST, 'sales_processes');
        } catch (e: any) {
          setDataError(e);
        }
      }
    });

    const qLogs = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'));
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      const lgs: ActivityLog[] = [];
      snapshot.forEach((doc) => {
        lgs.push({ id: doc.id, ...doc.data() } as ActivityLog);
      });
      setLogs(lgs);
      setLoading(false);
    }, (error: any) => {
      console.error("Error fetching logs:", error);
      setLoading(false);
      if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
        try {
          handleFirestoreError(error, OperationType.LIST, 'activity_logs');
        } catch (e: any) {
          setDataError(e);
        }
      }
    });

    return () => {
      unsubscribeProcesses();
      unsubscribeLogs();
    };
  }, [user]);

  const createProcess = async (title: string, clientName: string, pdfFile?: File, templateId?: string) => {
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
        const storageRef = ref(storage, `processes/${Date.now()}_${pdfFile.name}`);
        
        // Add a timeout to the upload in case Firebase Storage is not enabled
        const uploadPromise = uploadBytes(storageRef, pdfFile);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("TIMEOUT_STORAGE")), 15000);
        });
        
        try {
          const snapshot = await Promise.race([uploadPromise, timeoutPromise]) as any;
          pdfUrl = await getDownloadURL(snapshot.ref);
          pdfName = pdfFile.name;
        } catch (uploadError: any) {
          console.error("Storage upload error:", uploadError);
          if (uploadError.message === "TIMEOUT_STORAGE") {
            toast.warning("El archivo tardó demasiado en subir. El expediente se creará sin el PDF adjunto.");
          } else {
            toast.warning("No se pudo subir el PDF (posible falta de permisos en Firebase Storage). El expediente se creará sin el archivo adjunto.");
          }
          // Continue without PDF
          pdfUrl = '';
          pdfName = '';
        }
      }

      const newProcess: Omit<SalesProcess, 'id'> = {
        title,
        clientName,
        currentStage: 'cotizacion',
        quoteStatus: 'draft',
        proformaStatus: 'pending',
        orderStatus: 'pending',
        deliveryStatus: 'pending',
        invoiceStatus: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: user.uid,
        pdfUrl,
        pdfName,
        tags: initialTags,
        tasks: initialTasks,
        documents: pdfUrl ? [{
          id: Date.now().toString(),
          name: pdfName,
          url: pdfUrl,
          stage: 'cotizacion',
          uploadedBy: user.displayName || user.email || 'Usuario',
          uploadedAt: Date.now(),
          version: 1,
          groupId: Date.now().toString()
        }] : [],
        comments: [],
      };

      const docRef = await addDoc(collection(db, 'sales_processes'), newProcess);
      
      await addDoc(collection(db, 'activity_logs'), {
        processId: docRef.id,
        action: 'Expediente Creado',
        performedBy: user.uid,
        performedByName: user.displayName,
        timestamp: Date.now(),
        details: `Expediente para ${clientName} creado.${pdfFile ? ` Archivo adjunto: ${pdfFile.name}` : ''}`
      });
    } catch (error: any) {
      console.error("Error creating process:", error);
      toast.error("Error al crear el expediente. Verifica los permisos.");
      if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.CREATE, 'sales_processes');
      }
      throw error;
    }
  };

  const updateProcessStatus = async (processId: string, updates: Partial<SalesProcess>, actionName: string) => {
    if (!user) return;
    
    try {
      const processRef = doc(db, 'sales_processes', processId);
      await updateDoc(processRef, {
        ...updates,
        updatedAt: Date.now()
      });

      await addDoc(collection(db, 'activity_logs'), {
        processId,
        action: actionName,
        performedBy: user.uid,
        performedByName: user.displayName,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      console.error("Error updating process:", error);
      toast.error("Error al actualizar el expediente. Verifica los permisos.");
      if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.UPDATE, `sales_processes/${processId}`);
      }
      throw error;
    }
  };

  const deleteProcess = async (processId: string) => {
    if (!user) return;
    try {
      // Find the process to check if it has a PDF
      const processToDelete = processes.find(p => p.id === processId);
      
      // Delete the document
      await deleteDoc(doc(db, 'sales_processes', processId));
      
      // If there's a PDF, try to delete it from storage
      if (processToDelete?.pdfUrl) {
        try {
          // Extract the path from the URL or just use the known path structure if we saved it.
          // Since we didn't save the exact storage path, we can try to extract it from the URL.
          // A safer approach is to just let it be for now, or store the storagePath in the future.
          // For now, we'll just delete the document.
        } catch (e) {
          console.error("Error deleting PDF from storage:", e);
        }
      }

      toast.success("Expediente eliminado correctamente");
    } catch (error: any) {
      console.error("Error deleting process:", error);
      toast.error("Error al eliminar el expediente. Verifica los permisos.");
      if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.DELETE, `sales_processes/${processId}`);
      }
      throw error;
    }
  };

  const getProcessLogs = (processId: string) => {
    return logs.filter(log => log.processId === processId);
  };

  const addDocument = async (processId: string, file: File, stage: ProcessStage, groupId?: string) => {
    if (!user) return;
    try {
      const storageRef = ref(storage, `processes/${processId}/${Date.now()}_${file.name}`);
      const uploadPromise = uploadBytes(storageRef, file);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("TIMEOUT_STORAGE")), 15000);
      });
      
      const snapshot = await Promise.race([uploadPromise, timeoutPromise]) as any;
      const url = await getDownloadURL(snapshot.ref);
      
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
      const promises = processIds.map(id => deleteProcess(id));
      await Promise.all(promises);
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
        return `${window.location.origin}/track/${process.trackingToken}`;
      }
      
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      await updateProcessStatus(processId, { trackingToken: token }, "Enlace de seguimiento generado");
      
      return `${window.location.origin}/track/${token}`;
    } catch (error) {
      console.error("Error generating tracking link:", error);
      toast.error("Error al generar el enlace");
      throw error;
    }
  };

  return (
    <DataContext.Provider value={{ processes, logs, loading, templates: defaultTemplates, createProcess, updateProcessStatus, deleteProcess, getProcessLogs, addDocument, addComment, addTask, toggleTask, bulkUpdateProcesses, bulkDeleteProcesses, generateTrackingLink }}>
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
