import React, { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { format, subDays, isAfter, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

const COLORS = ['#255837', '#ef9b00', '#1b4229', '#d68b00', '#3b82f6', '#10b981'];

export default function Analytics() {
  const { processes, logs } = useData();

  const stats = useMemo(() => {
    const total = processes.length;
    const completed = processes.filter(p => p.currentStage === 'completado').length;
    const active = total - completed;
    
    // Calculate average time to completion (for completed processes)
    let totalTime = 0;
    let completedCount = 0;
    processes.forEach(p => {
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
    processes.forEach(p => {
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
    ];

    // Activity over last 7 days
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(new Date(), 6 - i);
      return {
        date: format(d, 'dd MMM', { locale: es }),
        timestamp: d.setHours(0,0,0,0)
      };
    });

    const activityData = last7Days.map(day => {
      const nextDay = day.timestamp + 86400000;
      const count = logs.filter(l => l.timestamp >= day.timestamp && l.timestamp < nextDay).length;
      return {
        name: day.date,
        actividad: count
      };
    });

    // Top Clients
    const clientCounts: Record<string, number> = {};
    processes.forEach(p => {
      const client = p.clientName || 'Desconocido';
      clientCounts[client] = (clientCounts[client] || 0) + 1;
    });
    const topClientsData = Object.entries(clientCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Tags Distribution
    const tagCounts: Record<string, number> = {};
    processes.forEach(p => {
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
    processes.forEach(p => {
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
    ];

    return { total, completed, active, avgCompletionDays, stageData, activityData, topClientsData, tagsData, stagnationData };
  }, [processes, logs]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight text-slate-800">Analítica Avanzada</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Expedientes por Fase</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
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
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topClientsData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Expedientes" fill="#ef9b00" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución por Etiquetas</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
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
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tiempo Promedio en Fase Actual (Cuellos de Botella)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.stagnationData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis label={{ value: 'Días', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)} días`, 'Promedio']} />
                <Bar dataKey="dias" name="Días en fase" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
