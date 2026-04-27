import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, History, Filter } from 'lucide-react';
import { Badge } from '../components/ui/badge';

export default function AuditLogs() {
  const { logs, processes } = useData();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter(log => {
    const processName = processes.find(p => p.id === log.processId)?.title || '';
    const searchLower = searchTerm.toLowerCase();
    
    return log.action.toLowerCase().includes(searchLower) ||
           log.performedByName.toLowerCase().includes(searchLower) ||
           processName.toLowerCase().includes(searchLower) ||
           (log.details && log.details.toLowerCase().includes(searchLower));
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Registro de Auditoría</h2>
          <p className="text-slate-500 mt-1">Historial completo y detallado de toda la actividad del sistema.</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por usuario, acción, expediente..."
            className="w-full pl-9 p-2 border rounded-md text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-codiagro-green" />
            <CardTitle>Historial Global</CardTitle>
          </div>
          <CardDescription>
            Mostrando los últimos {filteredLogs.length} registros de actividad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Fecha y Hora</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Acción</th>
                  <th className="px-4 py-3">Expediente Afectado</th>
                  <th className="px-4 py-3">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map(log => {
                  const processName = processes.find(p => p.id === log.processId)?.title || 'Expediente Eliminado';
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {format(log.timestamp, "dd MMM yyyy, HH:mm:ss", { locale: es })}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {log.performedByName}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="bg-white">
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-codiagro-green-dark font-medium">
                        {processName}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {log.details || '-'}
                      </td>
                    </tr>
                  );
                })}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No se encontraron registros de auditoría que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
