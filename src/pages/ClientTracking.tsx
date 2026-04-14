import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { SalesProcess } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, File as FileIcon, Download, Clock } from 'lucide-react';

export default function ClientTracking() {
  const { id, token } = useParams<{ id: string, token: string }>();
  const [process, setProcess] = useState<SalesProcess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProcess = async () => {
      if (!id || !token) return;
      try {
        const { data, error: fetchError } = await supabase
          .from('sales_processes')
          .select('*')
          .eq('id', id)
          .single();
        
        if (fetchError || !data) {
          setError("Enlace no válido o expirado.");
        } else {
          if (data.trackingToken === token) {
            setProcess(data as SalesProcess);
          } else {
            setError("Enlace no válido o expirado.");
          }
        }
      } catch (err) {
        console.error("Error fetching tracking info:", err);
        setError("Error al cargar la información.");
      } finally {
        setLoading(false);
      }
    };

    fetchProcess();
  }, [id, token]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p className="text-slate-500">Cargando información...</p></div>;
  }

  if (error || !process) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Enlace no disponible</h2>
            <p className="text-slate-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stages = ['cotizacion', 'proforma', 'pedido', 'albaran', 'factura', 'completado'];
  const currentStageIndex = stages.indexOf(process.currentStage);

  const StepIndicator = ({ stage, index, label }: { stage: string, index: number, label: string }) => {
    const isCompleted = currentStageIndex > index;
    const isCurrent = currentStageIndex === index;
    
    return (
      <div className={`flex flex-col items-center flex-1 ${isCompleted ? 'text-codiagro-green' : isCurrent ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 border-2 
          ${isCompleted ? 'bg-codiagro-green/10 border-codiagro-green' : isCurrent ? 'bg-white border-slate-900' : 'bg-slate-50 border-slate-300'}`}>
          {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <span>{index + 1}</span>}
        </div>
        <span className="text-xs uppercase tracking-wider text-center hidden sm:block">{label}</span>
      </div>
    );
  };

  // Only show the latest version of each document group
  const latestDocuments = React.useMemo(() => {
    if (!process.documents) return [];
    
    const groups: Record<string, typeof process.documents[0]> = {};
    process.documents.forEach(doc => {
      const gId = doc.groupId || doc.id;
      if (!groups[gId] || (doc.version || 1) > (groups[gId].version || 1)) {
        groups[gId] = doc;
      }
    });
    
    return Object.values(groups).sort((a, b) => b.uploadedAt - a.uploadedAt);
  }, [process.documents]);

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Seguimiento de Expediente</h1>
          <p className="text-slate-500">Cliente: <span className="font-semibold text-slate-700">{process.clientName}</span></p>
          <p className="text-slate-500">Proyecto: <span className="font-semibold text-slate-700">{process.title}</span></p>
        </div>

        <Card>
          <CardContent className="pt-8 pb-6">
            <div className="flex justify-between relative px-4 sm:px-0">
              <div className="absolute top-4 left-4 right-4 sm:left-0 sm:right-0 h-0.5 bg-slate-200 -z-10"></div>
              <div className="absolute top-4 left-4 sm:left-0 h-0.5 bg-codiagro-green -z-10 transition-all" style={{ width: `${(currentStageIndex / (stages.length - 1)) * 100}%` }}></div>
              
              <StepIndicator stage="cotizacion" index={0} label="Cotización" />
              <StepIndicator stage="proforma" index={1} label="Proforma" />
              <StepIndicator stage="pedido" index={2} label="Pedido" />
              <StepIndicator stage="albaran" index={3} label="Albarán" />
              <StepIndicator stage="factura" index={4} label="Factura" />
            </div>
            <div className="mt-8 text-center">
              <p className="text-sm text-slate-500">
                Última actualización: {format(process.updatedAt, "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
              </p>
              {process.estimatedDeliveryDate && (
                <p className="text-sm font-medium text-codiagro-green mt-2 bg-codiagro-green/10 inline-block px-3 py-1 rounded-full">
                  Entrega estimada: {format(process.estimatedDeliveryDate, "d 'de' MMMM, yyyy", { locale: es })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Documentos Disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            {latestDocuments.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No hay documentos disponibles en este momento.</p>
            ) : (
              <div className="space-y-3">
                {latestDocuments.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-codiagro-green/10 rounded">
                        <FileIcon className="h-6 w-6 text-codiagro-green" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 truncate max-w-[200px] sm:max-w-xs" title={doc.name}>
                          {doc.name}
                        </p>
                        <p className="text-xs text-slate-500 capitalize">Fase: {doc.stage}</p>
                      </div>
                    </div>
                    <a 
                      href={doc.url} 
                      download={doc.name} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200"
                    >
                      <Download className="h-4 w-4" /> <span className="hidden sm:inline">Descargar</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
