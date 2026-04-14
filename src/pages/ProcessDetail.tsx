import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Circle, Clock, ArrowLeft, Send, ShieldCheck, Factory, Truck, FileCheck, Mail, File as FileIcon, ExternalLink, Download, MessageSquare, Upload, Undo2, Tags, Calendar, ListTodo, Plus, XCircle, Link as LinkIcon } from 'lucide-react';
import { ProcessTag, roleTranslations, Role } from '../types';
import { toast } from 'sonner';

export default function ProcessDetail() {
  const { id } = useParams<{ id: string }>();
  const { processes, logs, updateProcessStatus, addDocument, addComment, addTask, toggleTask, generateTrackingLink } = useData();
  const { user } = useAuth();
  const [newComment, setNewComment] = React.useState('');
  const [newTaskText, setNewTaskText] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);
  const [selectedAuthRoles, setSelectedAuthRoles] = React.useState<Role[]>(['compliance', 'risk']);
  const [isGeneratingLink, setIsGeneratingLink] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const process = processes.find(p => p.id === id);
  const processLogs = logs.filter(l => l.processId === id);

  if (!process) return <div className="p-8 text-center text-slate-500">Expediente no encontrado</div>;

  const handleAction = async (updates: any, actionName: string, notifyRole?: string) => {
    await updateProcessStatus(process.id, updates, actionName);
    toast.success(`Acción completada: ${actionName}`);
    if (notifyRole) {
      toast.info(`Notificación enviada a: ${notifyRole.toUpperCase()}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !process) return;
    
    setIsUploading(true);
    try {
      await addDocument(process.id, file, process.currentStage);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !process) return;
    
    // Check for mentions
    const mentionRegex = /@(\w+)/g;
    const mentions = Array.from(newComment.matchAll(mentionRegex)).map(m => m[1]);
    
    await addComment(process.id, newComment.trim());
    
    if (mentions.length > 0) {
      toast.success(`Notificación enviada a: ${mentions.join(', ')}`);
    }
    
    setNewComment('');
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim() || !process) return;
    
    await addTask(process.id, newTaskText.trim());
    setNewTaskText('');
  };

  const handleRequestAuth = () => {
    if (!process) return;
    const requests = selectedAuthRoles.map(r => ({ role: r, status: 'pending' as const }));
    handleAction(
      { quoteStatus: 'pending_auth', authRequests: requests }, 
      `Autorización solicitada a: ${selectedAuthRoles.map(r => roleTranslations[r]).join(', ')}`
    );
  };

  const handleApproveAuth = (role: Role) => {
    if (!process || !process.authRequests) return;
    const newRequests = process.authRequests.map(r => r.role === role ? { ...r, status: 'approved' as const } : r);
    const allApproved = newRequests.every(r => r.status === 'approved');
    handleAction(
      { authRequests: newRequests, quoteStatus: allApproved ? 'authorized' : 'pending_auth' }, 
      `Autorizado por ${roleTranslations[role]}`
    );
  };

  const handleRejectAuth = (role: Role) => {
    if (!process || !process.authRequests) return;
    const newRequests = process.authRequests.map(r => r.role === role ? { ...r, status: 'rejected' as const } : r);
    handleAction(
      { authRequests: newRequests, quoteStatus: 'rejected' }, 
      `Rechazado por ${roleTranslations[role]}`
    );
  };

  const toggleTag = async (tag: ProcessTag) => {
    if (!process) return;
    const currentTags = process.tags || [];
    const newTags = currentTags.includes(tag) 
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    
    await handleAction({ tags: newTags }, `Etiquetas actualizadas`);
  };

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!process) return;
    const dateValue = e.target.value;
    const timestamp = dateValue ? new Date(dateValue).getTime() : null;
    await handleAction({ estimatedDeliveryDate: timestamp }, `Fecha de entrega estimada actualizada`);
  };

  const handleValidUntilChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!process) return;
    const dateValue = e.target.value;
    const timestamp = dateValue ? new Date(dateValue).getTime() : null;
    await handleAction({ validUntil: timestamp }, `Fecha de validez actualizada`);
  };

  const renderCommentText = (text: string) => {
    const mentionRegex = /@(\w+)/g;
    const parts = text.split(mentionRegex);
    
    if (parts.length === 1) return text;

    return text.split(mentionRegex).map((part, i) => {
      if (i % 2 === 1) {
        return <span key={i} className="font-semibold text-codiagro-orange bg-codiagro-orange/10 px-1 rounded">@{part}</span>;
      }
      return part;
    });
  };

  const handleGenerateTrackingLink = async () => {
    if (!process) return;
    setIsGeneratingLink(true);
    try {
      const link = await generateTrackingLink(process.id);
      await navigator.clipboard.writeText(link);
      toast.success("Enlace generado y copiado al portapapeles");
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const stages = ['cotizacion', 'proforma', 'pedido', 'albaran', 'factura', 'completado'];
  const currentStageIndex = stages.indexOf(process.currentStage);
  
  const availableTags: ProcessTag[] = ['Urgente', 'VIP', 'Exportación', 'Frío', 'Muestra'];

  // Group documents by groupId
  const groupedDocuments = React.useMemo(() => {
    if (!process?.documents) return [];
    
    const groups: Record<string, typeof process.documents> = {};
    process.documents.forEach(doc => {
      const gId = doc.groupId || doc.id;
      if (!groups[gId]) groups[gId] = [];
      groups[gId].push(doc);
    });
    
    // Sort each group by version descending
    Object.values(groups).forEach(group => {
      group.sort((a, b) => (b.version || 1) - (a.version || 1));
    });
    
    return Object.values(groups);
  }, [process?.documents]);

  const StepIndicator = ({ stage, index, label }: { stage: string, index: number, label: string }) => {
    const isCompleted = currentStageIndex > index;
    const isCurrent = currentStageIndex === index;
    
    return (
      <div className={`flex flex-col items-center flex-1 ${isCompleted ? 'text-codiagro-green' : isCurrent ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 border-2 
          ${isCompleted ? 'bg-codiagro-green/10 border-codiagro-green' : isCurrent ? 'bg-white border-slate-900' : 'bg-slate-50 border-slate-300'}`}>
          {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <span>{index + 1}</span>}
        </div>
        <span className="text-xs uppercase tracking-wider text-center">{label}</span>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold">{process.title}</h2>
            <div className="flex items-center gap-3 text-sm">
              <p className="text-slate-500 font-medium">Cliente: <span className="text-slate-900">{process.clientName}</span></p>
              {process.createdByName && (
                <>
                  <span className="text-slate-300">|</span>
                  <p className="text-slate-500 italic">Creado por: <span className="text-slate-700 font-medium whitespace-nowrap">{process.createdByName}</span></p>
                </>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={handleGenerateTrackingLink} disabled={isGeneratingLink}>
          <LinkIcon className="h-4 w-4 mr-2" />
          {isGeneratingLink ? 'Generando...' : 'Enlace Cliente'}
        </Button>
      </div>

      {/* Stepper and Meta Info */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardContent className="pt-6">
            <div className="flex justify-between relative">
              <div className="absolute top-4 left-0 w-full h-0.5 bg-slate-200 -z-10"></div>
              <div className="absolute top-4 left-0 h-0.5 bg-codiagro-green -z-10 transition-all" style={{ width: `${(currentStageIndex / (stages.length - 1)) * 100}%` }}></div>
              
              <StepIndicator stage="cotizacion" index={0} label="Cotización" />
              <StepIndicator stage="proforma" index={1} label="Proforma" />
              <StepIndicator stage="pedido" index={2} label="Pedido" />
              <StepIndicator stage="albaran" index={3} label="Albarán" />
              <StepIndicator stage="factura" index={4} label="Factura" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <div className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-codiagro-green" />
                Entrega Estimada
              </div>
              <input 
                type="date" 
                className="w-full p-2 border border-slate-200 rounded-md text-sm focus:ring-1 focus:ring-codiagro-green focus:border-codiagro-green"
                value={process.estimatedDeliveryDate ? format(process.estimatedDeliveryDate, 'yyyy-MM-dd') : ''}
                onChange={handleDateChange}
              />
            </div>
            {process.currentStage === 'cotizacion' && (
              <div>
                <div className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Validez de Cotización
                </div>
                <input 
                  type="date" 
                  className="w-full p-2 border border-slate-200 rounded-md text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  value={process.validUntil ? format(process.validUntil, 'yyyy-MM-dd') : ''}
                  onChange={handleValidUntilChange}
                />
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-2">
                <Tags className="h-4 w-4 text-codiagro-orange" />
                Etiquetas
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map(tag => {
                  const isActive = process.tags?.includes(tag);
                  return (
                    <Badge 
                      key={tag}
                      variant={isActive ? "default" : "outline"}
                      className={`cursor-pointer text-[10px] px-2 py-0.5 ${isActive ? 'bg-codiagro-orange hover:bg-codiagro-orange-dark' : 'hover:bg-slate-100'}`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Actions Area */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Admin Override */}
          {user?.role === 'admin' && (
            <Card className="bg-red-50 border-red-200 border-dashed">
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="text-sm text-red-800 font-medium">
                  Modo Administrador: Forzar cambio de fase
                </div>
                <select 
                  className="p-2 border border-red-200 rounded-md text-sm bg-white text-red-900"
                  value={process.currentStage}
                  onChange={(e) => handleAction({ currentStage: e.target.value }, `Fase cambiada manualmente a ${e.target.value}`)}
                >
                  <option value="cotizacion">1. Cotización</option>
                  <option value="proforma">2. Proforma</option>
                  <option value="pedido">3. Pedido</option>
                  <option value="albaran">4. Albarán</option>
                  <option value="factura">5. Factura</option>
                  <option value="completado">Completado</option>
                </select>
              </CardContent>
            </Card>
          )}

          {/* Documents Section */}
          <Card className="bg-codiagro-green/5 border-codiagro-green/20">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-md flex items-center gap-2">
                <FileIcon className="h-5 w-5 text-codiagro-green" />
                Documentos del Expediente
              </CardTitle>
              <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? 'Subiendo...' : 'Añadir Documento'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(!process.documents || process.documents.length === 0) && !process.pdfUrl ? (
                  <p className="text-sm text-slate-500 text-center py-4">No hay documentos adjuntos.</p>
                ) : (
                  <div className="grid gap-3">
                    {/* Legacy PDF support */}
                    {process.pdfUrl && (!process.documents || process.documents.length === 0) && (
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-codiagro-green/20">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-codiagro-green/10 rounded">
                            <FileIcon className="h-6 w-6 text-codiagro-green" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">
                              {process.pdfName || 'Documento del Expediente'}
                            </p>
                            <p className="text-xs text-slate-500">Archivo PDF (Legacy)</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={process.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-codiagro-green hover:text-codiagro-green-dark transition-colors bg-codiagro-green/5 hover:bg-codiagro-green/10 px-3 py-1.5 rounded-md">
                            <ExternalLink className="h-4 w-4" /> Ver
                          </a>
                        </div>
                      </div>
                    )}
                    
                    {/* New Documents array grouped by version */}
                    {groupedDocuments.map(group => {
                      const latestDoc = group[0];
                      const hasPreviousVersions = group.length > 1;
                      
                      return (
                        <div key={latestDoc.id} className="flex flex-col p-3 bg-white rounded-lg border border-codiagro-green/20">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-codiagro-green/10 rounded">
                                <FileIcon className="h-6 w-6 text-codiagro-green" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]" title={latestDoc.name}>
                                  {latestDoc.name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {latestDoc.version && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 bg-slate-50">v{latestDoc.version}</Badge>
                                  )}
                                  <p className="text-xs text-slate-500 capitalize">Fase: {latestDoc.stage} • {latestDoc.uploadedBy}</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <a href={latestDoc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-codiagro-green hover:text-codiagro-green-dark transition-colors bg-codiagro-green/5 hover:bg-codiagro-green/10 px-3 py-1.5 rounded-md">
                                <ExternalLink className="h-4 w-4" /> Ver
                              </a>
                              <a href={latestDoc.url} download={latestDoc.name} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200">
                                <Download className="h-4 w-4" /> Descargar
                              </a>
                            </div>
                          </div>
                          
                          {hasPreviousVersions && (
                            <div className="mt-3 pt-3 border-t border-slate-100 pl-11">
                              <p className="text-xs font-medium text-slate-500 mb-2">Versiones anteriores:</p>
                              <div className="space-y-2">
                                {group.slice(1).map(oldDoc => (
                                  <div key={oldDoc.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="secondary" className="text-[9px] px-1 py-0">v{oldDoc.version || 1}</Badge>
                                      <span className="text-xs text-slate-500 truncate max-w-[150px]">{oldDoc.name}</span>
                                      <span className="text-[10px] text-slate-400">• {format(oldDoc.uploadedAt, "d MMM", { locale: es })}</span>
                                    </div>
                                    <a href={oldDoc.url} target="_blank" rel="noopener noreferrer" className="text-xs text-codiagro-green hover:underline">
                                      Ver archivo
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* COTIZACIÓN STAGE */}
          {process.currentStage === 'cotizacion' && (
            <Card>
              <CardHeader>
                <CardTitle>Fase 1: Cotización</CardTitle>
                <CardDescription>Estado actual: <Badge>{process.quoteStatus.replace(/_/g, ' ')}</Badge></CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {process.quoteStatus === 'draft' && (user?.role === 'sales' || user?.role === 'admin') && (
                  <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <p className="text-sm font-medium text-slate-700">Seleccionar departamentos para autorización:</p>
                    <div className="flex flex-wrap gap-3">
                      {(['compliance', 'risk', 'production', 'logistics', 'finance'] as Role[]).map(role => (
                        <label key={role} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={selectedAuthRoles.includes(role)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedAuthRoles([...selectedAuthRoles, role]);
                              else setSelectedAuthRoles(selectedAuthRoles.filter(r => r !== role));
                            }}
                            className="rounded border-slate-300 text-codiagro-green focus:ring-codiagro-green"
                          />
                          {roleTranslations[role]}
                        </label>
                      ))}
                    </div>
                    <Button 
                      onClick={handleRequestAuth} 
                      disabled={selectedAuthRoles.length === 0}
                      className="w-full sm:w-auto bg-codiagro-green hover:bg-codiagro-green-dark"
                    >
                      <Send className="mr-2 h-4 w-4" /> Solicitar Autorizaciones
                    </Button>
                  </div>
                )}
                
                {process.quoteStatus === 'pending_auth' && (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-slate-700">Estado de Autorizaciones:</p>
                    <div className="grid gap-3">
                      {process.authRequests?.map(req => (
                        <div key={req.role} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white rounded-lg border border-slate-200 gap-3">
                          <div className="flex items-center gap-3">
                            {req.status === 'approved' ? <CheckCircle2 className="text-green-500 w-5 h-5" /> : 
                             req.status === 'rejected' ? <XCircle className="text-red-500 w-5 h-5" /> : 
                             <Clock className="text-amber-500 w-5 h-5" />}
                            <span className="font-medium text-sm">{roleTranslations[req.role]}</span>
                            <Badge variant="outline" className={
                              req.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : 
                              req.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 
                              'bg-amber-50 text-amber-700 border-amber-200'
                            }>
                              {req.status === 'approved' ? 'Aprobado' : req.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                            </Badge>
                          </div>
                          
                          {req.status === 'pending' && (user?.role === req.role || user?.role === 'admin') && (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleApproveAuth(req.role)} className="bg-codiagro-green hover:bg-codiagro-green-dark flex-1 sm:flex-none">
                                <ShieldCheck className="mr-1.5 h-4 w-4" /> Aprobar
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleRejectAuth(req.role)} className="flex-1 sm:flex-none">
                                <XCircle className="mr-1.5 h-4 w-4" /> Rechazar
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Legacy states for backward compatibility */}
                {process.quoteStatus === 'pending_sales_auth' && (user?.role === 'sales' || user?.role === 'admin') && (
                  <div className="flex gap-2">
                    <Button onClick={() => handleAction({ quoteStatus: 'pending_compliance_auth' }, 'Autorizado por Comercial', 'compliance')} className="bg-codiagro-green hover:bg-codiagro-green-dark">
                      <ShieldCheck className="mr-2 h-4 w-4" /> Autorizar (Comercial)
                    </Button>
                    <Button variant="destructive" onClick={() => handleAction({ quoteStatus: 'rejected' }, 'Rechazado por Comercial')}>Rechazar</Button>
                  </div>
                )}

                {process.quoteStatus === 'pending_compliance_auth' && (user?.role === 'compliance' || user?.role === 'admin') && (
                  <div className="flex gap-2">
                    <Button onClick={() => handleAction({ quoteStatus: 'pending_risk_auth' }, 'Autorizado por Normativa', 'risk')} className="bg-codiagro-green hover:bg-codiagro-green-dark">
                      <ShieldCheck className="mr-2 h-4 w-4" /> Autorizar (Normativa)
                    </Button>
                    <Button variant="outline" onClick={() => handleAction({ quoteStatus: 'draft' }, 'Devuelto a Comercial por Normativa', 'sales')}>
                      <Undo2 className="mr-2 h-4 w-4" /> Devolver a Comercial
                    </Button>
                    <Button variant="destructive" onClick={() => handleAction({ quoteStatus: 'rejected' }, 'Rechazado por Normativa')}>Rechazar</Button>
                  </div>
                )}

                {process.quoteStatus === 'pending_risk_auth' && (user?.role === 'risk' || user?.role === 'admin') && (
                  <div className="flex gap-2">
                    <Button onClick={() => handleAction({ quoteStatus: 'authorized' }, 'Autorizado por Riesgos', 'sales')} className="bg-codiagro-green hover:bg-codiagro-green-dark">
                      <ShieldCheck className="mr-2 h-4 w-4" /> Autorizar (Riesgos)
                    </Button>
                    <Button variant="outline" onClick={() => handleAction({ quoteStatus: 'pending_compliance_auth' }, 'Devuelto a Normativa por Riesgos', 'compliance')}>
                      <Undo2 className="mr-2 h-4 w-4" /> Devolver a Normativa
                    </Button>
                    <Button variant="destructive" onClick={() => handleAction({ quoteStatus: 'rejected' }, 'Rechazado por Riesgos')}>Rechazar</Button>
                  </div>
                )}

                {process.quoteStatus === 'authorized' && (user?.role === 'sales' || user?.role === 'admin') && (
                  <Button onClick={() => handleAction({ quoteStatus: 'sent_to_client' }, 'Cotización enviada al cliente')}>
                    <Mail className="mr-2 h-4 w-4" /> Enviar al Cliente
                  </Button>
                )}

                {process.quoteStatus === 'sent_to_client' && (user?.role === 'sales' || user?.role === 'admin') && (
                  <Button onClick={() => handleAction({ quoteStatus: 'client_accepted', currentStage: 'proforma' }, 'Cliente Aceptó Cotización', 'finance')} className="bg-codiagro-orange hover:bg-codiagro-orange-dark text-white">
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Registrar Aceptación del Cliente
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* PROFORMA STAGE */}
          {process.currentStage === 'proforma' && (
            <Card>
              <CardHeader>
                <CardTitle>Fase 2: Proforma</CardTitle>
                <CardDescription>Estado actual: <Badge>{process.proformaStatus}</Badge></CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {process.proformaStatus === 'pending' && (user?.role === 'sales' || user?.role === 'admin') && (
                  <Button onClick={() => handleAction({ proformaStatus: 'generated' }, 'Proforma Generada', 'finance')}>
                    <FileCheck className="mr-2 h-4 w-4" /> Generar Proforma
                  </Button>
                )}

                {process.proformaStatus === 'generated' && (user?.role === 'finance' || user?.role === 'admin') && (
                  <Button onClick={() => handleAction({ proformaStatus: 'authorized' }, 'Proforma Autorizada por Finanzas', 'sales')} className="bg-codiagro-orange hover:bg-codiagro-orange-dark">
                    <ShieldCheck className="mr-2 h-4 w-4" /> Autorizar Proforma
                  </Button>
                )}
                
                {process.proformaStatus === 'authorized' && (user?.role === 'sales' || user?.role === 'admin') && (
                  <Button onClick={() => handleAction({ proformaStatus: 'sent' }, 'Proforma Enviada')}>
                    <Mail className="mr-2 h-4 w-4" /> Enviar al Cliente
                  </Button>
                )}

                {process.proformaStatus === 'sent' && (user?.role === 'finance' || user?.role === 'admin') && (
                  <div className="flex gap-2">
                    <Button onClick={() => handleAction({ proformaStatus: 'paid', currentStage: 'pedido', orderStatus: 'sent_to_production' }, 'Proforma Pagada', 'production')} className="bg-codiagro-green hover:bg-codiagro-green-dark">
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Registrar Pago / Avanzar a Pedido
                    </Button>
                    <Button variant="outline" onClick={() => handleAction({ proformaStatus: 'pending', currentStage: 'cotizacion', quoteStatus: 'client_accepted' }, 'Devuelto a Comercial (Falta Pago)', 'sales')}>
                      <Undo2 className="mr-2 h-4 w-4" /> Devolver a Comercial
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* PEDIDO STAGE */}
          {process.currentStage === 'pedido' && (
            <Card>
              <CardHeader>
                <CardTitle>Fase 3: Pedido y Producción</CardTitle>
                <CardDescription>Estado actual: <Badge>{process.orderStatus.replace(/_/g, ' ')}</Badge></CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {process.orderStatus === 'sent_to_production' && (user?.role === 'production' || user?.role === 'admin') && (
                  <Button onClick={() => handleAction({ orderStatus: 'in_manufacturing' }, 'Iniciada Fabricación')}>
                    <Factory className="mr-2 h-4 w-4" /> Iniciar Fabricación
                  </Button>
                )}
                
                {process.orderStatus === 'in_manufacturing' && (user?.role === 'production' || user?.role === 'admin') && (
                  <Button onClick={() => handleAction({ orderStatus: 'ready_for_pickup' }, 'Fabricación Completada', 'logistics')} className="bg-codiagro-green hover:bg-codiagro-green-dark">
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar Listo para Recogida
                  </Button>
                )}

                {process.orderStatus === 'ready_for_pickup' && (user?.role === 'logistics' || user?.role === 'admin') && (
                  <Button onClick={() => handleAction({ orderStatus: 'shipped', currentStage: 'albaran', deliveryStatus: 'generated' }, 'Pedido Enviado', 'logistics')}>
                    <Truck className="mr-2 h-4 w-4" /> Registrar Envío / Generar Albarán
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* ALBARÁN STAGE */}
          {process.currentStage === 'albaran' && (
            <Card>
              <CardHeader>
                <CardTitle>Fase 4: Albarán de Entrega</CardTitle>
                <CardDescription>Estado actual: <Badge>{process.deliveryStatus}</Badge></CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {process.deliveryStatus === 'generated' && (user?.role === 'logistics' || user?.role === 'admin') && (
                  <Button onClick={() => handleAction({ deliveryStatus: 'signed', currentStage: 'factura', invoiceStatus: 'pending' }, 'Albarán Firmado', 'finance')} className="bg-codiagro-green hover:bg-codiagro-green-dark">
                    <FileCheck className="mr-2 h-4 w-4" /> Registrar Firma de Cliente
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* FACTURA STAGE */}
          {process.currentStage === 'factura' && (
            <Card>
              <CardHeader>
                <CardTitle>Fase 5: Facturación</CardTitle>
                <CardDescription>Estado actual: <Badge>{process.invoiceStatus}</Badge></CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {process.invoiceStatus === 'pending' && (user?.role === 'finance' || user?.role === 'admin') && (
                  <Button onClick={() => handleAction({ invoiceStatus: 'generated' }, 'Factura Generada', 'sales')}>
                    <FileCheck className="mr-2 h-4 w-4" /> Generar Factura
                  </Button>
                )}
                
                {process.invoiceStatus === 'generated' && (user?.role === 'sales' || user?.role === 'admin') && (
                  <Button onClick={() => handleAction({ invoiceStatus: 'sent' }, 'Factura Enviada al Cliente')}>
                    <Mail className="mr-2 h-4 w-4" /> Enviar Factura
                  </Button>
                )}

                {process.invoiceStatus === 'sent' && (user?.role === 'finance' || user?.role === 'admin') && (
                  <Button onClick={() => handleAction({ invoiceStatus: 'paid', currentStage: 'completado' }, 'Factura Pagada - Proceso Completado')} className="bg-codiagro-green hover:bg-codiagro-green-dark">
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Registrar Pago Final
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {process.currentStage === 'completado' && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-green-800">Proceso Completado</h3>
                <p className="text-green-600 mt-2">Todo el ciclo de venta ha finalizado con éxito.</p>
              </CardContent>
            </Card>
          )}

        </div>

        {/* Sidebar: Checklist & History */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-md flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-codiagro-green" />
                Tareas Pendientes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-3">
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                {(!process.tasks || process.tasks.length === 0) ? (
                  <p className="text-xs text-slate-500 text-center py-2">No hay tareas.</p>
                ) : (
                  process.tasks.map(task => (
                    <div key={task.id} className="flex items-start gap-2 group">
                      <button 
                        onClick={() => toggleTask(process.id, task.id)}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          task.completed 
                            ? 'bg-codiagro-green border-codiagro-green text-white' 
                            : 'border-slate-300 hover:border-codiagro-green bg-white'
                        }`}
                      >
                        {task.completed && <CheckCircle2 className="w-3 h-3" />}
                      </button>
                      <span className={`text-xs ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                        {task.text}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleAddTask} className="flex gap-2 pt-2 border-t border-slate-100">
                <input 
                  type="text" 
                  className="flex-1 p-1.5 text-xs border rounded-md focus:ring-1 focus:ring-codiagro-green focus:border-codiagro-green" 
                  placeholder="Nueva tarea..." 
                  value={newTaskText}
                  onChange={e => setNewTaskText(e.target.value)}
                />
                <Button type="submit" size="sm" disabled={!newTaskText.trim()} className="bg-codiagro-green hover:bg-codiagro-green-dark h-8 w-8 p-0">
                  <Plus className="h-3 w-3" />
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-md flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-codiagro-orange" />
                Comentarios Internos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-3">
              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
                {(!process.comments || process.comments.length === 0) ? (
                  <p className="text-xs text-slate-500 text-center py-4">No hay comentarios aún.</p>
                ) : (
                  process.comments.map(comment => (
                    <div key={comment.id} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-800">{comment.authorName}</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0">{roleTranslations[comment.authorRole]}</Badge>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {format(comment.timestamp, "d MMM, HH:mm", { locale: es })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 whitespace-pre-wrap">{renderCommentText(comment.text)}</p>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t border-slate-100">
                <input 
                  type="text" 
                  className="flex-1 p-1.5 text-xs border rounded-md focus:ring-1 focus:ring-codiagro-green focus:border-codiagro-green" 
                  placeholder="Añadir comentario..." 
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                />
                <Button type="submit" size="sm" disabled={!newComment.trim()} className="bg-codiagro-green hover:bg-codiagro-green-dark h-8 w-8 p-0">
                  <Send className="h-3 w-3" />
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-md">Checklist & Historial</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <ul className="space-y-2 text-xs mb-4 pb-4 border-b border-slate-100">
                <li className="flex items-center gap-2">
                  {(currentStageIndex > 0 || ['authorized', 'sent_to_client', 'client_accepted'].includes(process.quoteStatus)) ? <CheckCircle2 className="text-green-500 w-3 h-3" /> : <Circle className="text-slate-300 w-3 h-3" />}
                  <span className={(currentStageIndex > 0 || ['authorized', 'sent_to_client', 'client_accepted'].includes(process.quoteStatus)) ? "text-slate-900" : "text-slate-500"}>Cotización Aprobada</span>
                </li>
                <li className="flex items-center gap-2">
                  {(currentStageIndex > 1 || process.proformaStatus === 'paid') ? <CheckCircle2 className="text-green-500 w-3 h-3" /> : <Circle className="text-slate-300 w-3 h-3" />}
                  <span className={(currentStageIndex > 1 || process.proformaStatus === 'paid') ? "text-slate-900" : "text-slate-500"}>Proforma Pagada</span>
                </li>
                <li className="flex items-center gap-2">
                  {(currentStageIndex > 2 || ['ready_for_pickup', 'shipped'].includes(process.orderStatus)) ? <CheckCircle2 className="text-green-500 w-3 h-3" /> : <Circle className="text-slate-300 w-3 h-3" />}
                  <span className={(currentStageIndex > 2 || ['ready_for_pickup', 'shipped'].includes(process.orderStatus)) ? "text-slate-900" : "text-slate-500"}>Pedido Fabricado y Enviado</span>
                </li>
                <li className="flex items-center gap-2">
                  {(currentStageIndex > 3 || process.deliveryStatus === 'signed') ? <CheckCircle2 className="text-green-500 w-3 h-3" /> : <Circle className="text-slate-300 w-3 h-3" />}
                  <span className={(currentStageIndex > 3 || process.deliveryStatus === 'signed') ? "text-slate-900" : "text-slate-500"}>Albarán Firmado</span>
                </li>
                <li className="flex items-center gap-2">
                  {(currentStageIndex > 4 || process.invoiceStatus === 'paid') ? <CheckCircle2 className="text-green-500 w-3 h-3" /> : <Circle className="text-slate-300 w-3 h-3" />}
                  <span className={(currentStageIndex > 4 || process.invoiceStatus === 'paid') ? "text-slate-900" : "text-slate-500"}>Factura Pagada</span>
                </li>
              </ul>
              
              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                {processLogs.length === 0 ? (
                  <p className="text-xs text-slate-500">No hay actividad registrada.</p>
                ) : (
                  processLogs.map((log) => (
                    <div key={log.id} className="flex gap-2">
                      <div className="mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-codiagro-orange mt-1"></div>
                      </div>
                      <div>
                        <p className="text-xs font-medium">{log.action}</p>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                          <span className="font-semibold">{log.performedByName}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {format(log.timestamp, "d MMM, HH:mm", { locale: es })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
