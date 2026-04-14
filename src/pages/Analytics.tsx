import React, { useMemo, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, LabelList } from 'recharts';
import { format, subDays, isAfter, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertCircle, Euro } from 'lucide-react';
import { Button } from '../components/ui/button';
import { roleTranslations } from '../types';

const STAGE_COLOR_MAP: Record<string, string> = {
  'Cotización': '#64748b', // Slate
  'Proforma': '#f59e0b',   // Amber
  'Pedido': '#255837',     // Codiagro Green
  'Albarán': '#6366f1',    // Indigo
  'Factura': '#3b82f6',    // Blue
  'Completado': '#10b981'  // Emerald
};

const COLORS = Object.values(STAGE_COLOR_MAP);

export default function Analytics() {
  const { processes, logs } = useData();
  const { user } = useAuth();
  const [useRoleFilter, setUseRoleFilter] = useState(true);

  // Re-enable role filter when role changes
  React.useEffect(() => {
    setUseRoleFilter(true);
  }, [user?.role]);

  const filteredProcesses = useMemo(() => {
    return processes.filter(p => {
      let matchesRole = true;
      if (useRoleFilter && user) {
        if (user.role === 'logistics') {
          matchesRole = p.currentStage === 'pedido' || p.currentStage === 'albaran';
        } else if (user.role === 'finance') {
          matchesRole = p.currentStage === 'factura' || p.proformaStatus === 'generated';
        } else if (user.role === 'production') {
          matchesRole = p.currentStage === 'pedido';
        } else if (user.role === 'risk' || user.role === 'compliance') {
          matchesRole = p.quoteStatus === 'pending_auth' && 
            (p.authRequests || []).some(r => r.role === user.role && r.status === 'pending');
        }
      }
      return matchesRole;
    });
  }, [processes, useRoleFilter, user]);

  const stats = useMemo(() => {
    const total = filteredProcesses.length;
    const completed = filteredProcesses.filter(p => p.currentStage === 'completado').length;
    const active = total - completed;
    
    // Calculate average time to completion (for completed processes)
    let totalTime = 0;
    let completedCount = 0;
    filteredProcesses.forEach(p => {
      if (p.currentStage === 'completado') {
        totalTime += (p.updatedAt - p.createdAt);
        completedCount++;
      }
    });
    const avgCompletionDays = completedCount > 0 ? (totalTime / completedCount) / (1000 * 60 * 60 * 24) : 0;

    // Processes by stage
    const stageCount = {
      cotizacion: 0,
      proforma: 0,
      pedido: 0,
      albaran: 0,
      factura: 0,
      completado: 0
    };
    filteredProcesses.forEach(p => {
      if (stageCount[p.currentStage] !== undefined) {
        stageCount[p.currentStage]++;
      }
    });

    const stageData = [
      { name: 'Cotización', value: stageCount.cotizacion },
      { name: 'Proforma', value: stageCount.proforma },
      { name: 'Pedido', value: stageCount.pedido },
      { name: 'Albarán', value: stageCount.albaran },
      { name: 'Factura', value: stageCount.factura },
      { name: 'Completado', value: stageCount.completado },
    ].filter(s => s.value > 0); // Only show stages with data

    // Activity over last 7 days (filtered by process IDs)
    const processIds = new Set(filteredProcesses.map(p => p.id));
    const filteredLogs = logs.filter(l => processIds.has(l.processId));

    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(new Date(), 6 - i);
      return {
        date: format(d, 'dd MMM', { locale: es }),
        timestamp: d.setHours(0,0,0,0)
      };
    });

    const activityData = last7Days.map(day => {
      const nextDay = day.timestamp + 86400000;
      const count = filteredLogs.filter(l => l.timestamp >= day.timestamp && l.timestamp < nextDay).length;
      return {
        name: day.date,
        actividad: count
      };
    });

    // Top Clients by Amount
    const clientStats: Record<string, { count: number, amount: number }> = {};
    filteredProcesses.forEach(p => {
      const client = p.clientName || 'Desconocido';
      const amount = Number(p.amount) || 0;
      if (!clientStats[client]) {
        clientStats[client] = { count: 0, amount: 0 };
      }
      clientStats[client].count++;
      clientStats[client].amount += amount;
    });
    const topClientsData = Object.entries(clientStats)
      .map(([name, data]) => ({ 
        name, 
        count: data.count, 
        amount: data.amount 
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Tags Distribution
    const tagCounts: Record<string, number> = {};
    filteredProcesses.forEach(p => {
      if (p.tags && p.tags.length > 0) {
        p.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      } else {
        tagCounts['Sin etiqueta'] = (tagCounts['Sin etiqueta'] || 0) + 1;
      }
    });
    const tagsData = Object.entries(tagCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Bottlenecks (Average days in current stage for active processes)
    const stageStagnation: Record<string, { totalDays: number, count: number }> = {
      cotizacion: { totalDays: 0, count: 0 },
      proforma: { totalDays: 0, count: 0 },
      pedido: { totalDays: 0, count: 0 },
      albaran: { totalDays: 0, count: 0 },
      factura: { totalDays: 0, count: 0 }
    };
    
    const now = Date.now();
    filteredProcesses.forEach(p => {
      if (p.currentStage !== 'completado' && stageStagnation[p.currentStage]) {
        const daysInStage = differenceInDays(now, p.updatedAt);
        stageStagnation[p.currentStage].totalDays += daysInStage;
        stageStagnation[p.currentStage].count++;
      }
    });

    const stagnationData = [
      { name: 'Cotización', dias: stageStagnation.cotizacion.count > 0 ? stageStagnation.cotizacion.totalDays / stageStagnation.cotizacion.count : 0 },
      { name: 'Proforma', dias: stageStagnation.proforma.count > 0 ? stageStagnation.proforma.totalDays / stageStagnation.proforma.count : 0 },
      { name: 'Pedido', dias: stageStagnation.pedido.count > 0 ? stageStagnation.pedido.totalDays / stageStagnation.pedido.count : 0 },
      { name: 'Albarán', dias: stageStagnation.albaran.count > 0 ? stageStagnation.albaran.totalDays / stageStagnation.albaran.count : 0 },
      { name: 'Factura', dias: stageStagnation.factura.count > 0 ? stageStagnation.factura.totalDays / stageStagnation.factura.count : 0 },
    ].filter(s => s.dias > 0); // Only show stages with stagnation

    // Amount by Stage
    const stageAmounts: Record<string, number> = {
      cotizacion: 0,
      proforma: 0,
      pedido: 0,
      albaran: 0,
      factura: 0,
      completado: 0
    };
    let totalAmount = 0;
    filteredProcesses.forEach(p => {
      const amt = Number(p.amount) || 0;
      totalAmount += amt;
      if (stageAmounts[p.currentStage] !== undefined) {
        stageAmounts[p.currentStage] += amt;
      }
    });

    const amountByStageData = [
      { name: 'Cotización', importe: stageAmounts.cotizacion },
      { name: 'Proforma', importe: stageAmounts.proforma },
      { name: 'Pedido', importe: stageAmounts.pedido },
      { name: 'Albarán', importe: stageAmounts.albaran },
      { name: 'Factura', importe: stageAmounts.factura },
      { name: 'Completado', importe: stageAmounts.completado },
    ].filter(s => s.importe > 0);

    return { total, completed, active, avgCompletionDays, stageData, activityData, topClientsData, tagsData, stagnationData, totalAmount, amountByStageData };
  }, [filteredProcesses, logs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-slate-800">Analítica Avanzada</h2>
      </div>

      {useRoleFilter && user?.role !== 'admin' && user?.role !== 'sales' && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">
              Mostrando estadísticas filtradas para tu rol (<strong>{roleTranslations[user.role]}</strong>).
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setUseRoleFilter(false)} className="text-blue-700 hover:bg-blue-100">
            Ver estadísticas globales
          </Button>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500 font-medium">Total Expedientes</p>
            <h3 className="text-3xl font-bold text-slate-800 mt-2">{stats.total}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500 font-medium">En Proceso</p>
            <h3 className="text-3xl font-bold text-codiagro-orange mt-2">{stats.active}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500 font-medium">Completados</p>
            <h3 className="text-3xl font-bold text-codiagro-green mt-2">{stats.completed}</h3>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500 font-medium">Tiempo Medio (Días)</p>
            <h3 className="text-3xl font-bold text-slate-800 mt-2">{stats.avgCompletionDays.toFixed(1)}</h3>
          </CardContent>
        </Card>
        <Card className="bg-codiagro-green/5 border-codiagro-green/20">
          <CardContent className="p-6">
            <p className="text-sm text-codiagro-green-dark font-medium flex items-center gap-1"><Euro className="h-4 w-4" /> Importe Total</p>
            <h3 className="text-3xl font-bold text-codiagro-green mt-2">{stats.totalAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Expedientes por Fase</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {stats.stageData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.stageData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={90}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => percent > 0 ? `${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={false}
                  >
                    {stats.stageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STAGE_COLOR_MAP[entry.name as keyof typeof STAGE_COLOR_MAP] || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <PieChart className="h-12 w-12 mb-2 opacity-20" />
                <p>No hay datos para mostrar</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actividad (Últimos 7 días)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.activityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="actividad" stroke="#255837" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Clientes</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {stats.topClientsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topClientsData} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis 
                    type="number" 
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k€` : `${v}€`}
                  />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number, name: string, props: any) => {
                      if (name === 'Importe') {
                        return [
                          value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }),
                          `Importe (${props.payload.count} pedidos)`
                        ];
                      }
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="amount" name="Importe" radius={[0, 4, 4, 0]}>
                    {stats.topClientsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    <LabelList 
                      dataKey="amount" 
                      position="right" 
                      formatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k€` : `${v}€`}
                      style={{ fontSize: '11px', fontWeight: 'bold', fill: '#475569' }}
                    />
                    <LabelList 
                      dataKey="count" 
                      position="insideRight" 
                      formatter={(v: number) => `${v} ped.`}
                      style={{ fontSize: '10px', fill: '#fff', fontWeight: 'bold' }}
                      offset={10}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <BarChart className="h-12 w-12 mb-2 opacity-20" />
                <p>No hay datos para mostrar</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución por Etiquetas</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {stats.tagsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.tagsData}
                    cx="50%"
                    cy="45%"
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => percent > 0 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''}
                    labelLine={true}
                  >
                    {stats.tagsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <PieChart className="h-12 w-12 mb-2 opacity-20" />
                <p>No hay datos para mostrar</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tiempo Promedio en Fase Actual (Cuellos de Botella)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {stats.stagnationData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.stagnationData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis label={{ value: 'Días', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(1)} días`, 'Promedio']} />
                  <Bar dataKey="dias" name="Días en fase" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <BarChart className="h-12 w-12 mb-2 opacity-20" />
                <p>No hay cuellos de botella detectados</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Euro className="h-5 w-5 text-codiagro-green" /> Desglose de Importes por Fase</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {stats.amountByStageData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.amountByStageData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k€` : `${v}€`} />
                  <Tooltip formatter={(value: number) => [value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }), 'Importe']} />
                  <Bar dataKey="importe" name="Importe" radius={[4, 4, 0, 0]}>
                    {stats.amountByStageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STAGE_COLOR_MAP[entry.name as keyof typeof STAGE_COLOR_MAP] || COLORS[index % COLORS.length]} />
                    ))}
                    <LabelList 
                      dataKey="importe" 
                      position="top" 
                      formatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k€` : `${v}€`}
                      style={{ fontSize: '12px', fontWeight: 'bold', fill: '#475569' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Euro className="h-12 w-12 mb-2 opacity-20" />
                <p>No hay datos de importes para mostrar</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
