import { format, subDays, isAfter, differenceInDays, addDays, isWeekend, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertCircle, Euro, TrendingUp, Users, Target, Clock, AlertTriangle, ChevronRight, X, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { roleTranslations, SalesProcess } from '../types';

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
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [forecastStages, setForecastStages] = useState<string[]>(['factura']);
  const [detailFilter, setDetailFilter] = useState<{ type: string; value: any; label: string } | null>(null);
  const detailRef = React.useRef<HTMLDivElement>(null);

  const allStages = [
    { id: 'cotizacion', label: 'Cotiz.' },
    { id: 'proforma', label: 'Prof.' },
    { id: 'pedido', label: 'Ped.' },
    { id: 'albaran', label: 'Alb.' },
    { id: 'factura', label: 'Fact.' },
    { id: 'completado', label: 'Compl.' }
  ];

  const handleSetDetail = (type: string, value: any, label: string) => {
    setDetailFilter({ type, value, label });
    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const clearDetail = () => setDetailFilter(null);

  const filteredProcesses = useMemo(() => {
    const start = new Date(dateFrom).getTime();
    const end = new Date(dateTo).setHours(23, 59, 59, 999);

    return processes.filter(p => {
      // Date filter
      const isWithinDate = p.createdAt >= start && p.createdAt <= end;
      if (!isWithinDate) return false;

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
  }, [processes, useRoleFilter, user, dateFrom, dateTo]);

  const stats = useMemo(() => {
    // Helper function for business days calculation
    const isOverKPI = (createdAt: number) => {
      let daysCount = 0;
      let current = new Date(createdAt);
      const now = new Date();
      
      while (current < now) {
        if (!isWeekend(current)) {
          daysCount++;
        }
        current = addDays(current, 1);
      }
      return daysCount > 3;
    };

    const total = filteredProcesses.length;
    const completed = filteredProcesses.filter(p => p.currentStage === 'completado').length;
    const active = total - completed;
    
    // KPI: Processes over 3 business days and not completed
    const kpiDelayed = filteredProcesses.filter(p => p.currentStage !== 'completado' && isOverKPI(p.createdAt)).length;

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
    ].filter(s => s.value > 0);

    // Funnel Data (Cumulative: a process in 'pedido' passed through 'cotizacion' and 'proforma')
    // We estimate this by looking at processes AT OR BEYOND each stage
    const funnelData = [
      { name: 'Cotizaciones', value: total },
      { name: 'Proformas', value: filteredProcesses.filter(p => ['proforma', 'pedido', 'albaran', 'factura', 'completado'].includes(p.currentStage)).length },
      { name: 'Pedidos', value: filteredProcesses.filter(p => ['pedido', 'albaran', 'factura', 'completado'].includes(p.currentStage)).length },
      { name: 'Entregas', value: filteredProcesses.filter(p => ['albaran', 'factura', 'completado'].includes(p.currentStage)).length },
      { name: 'Cierres', value: completed }
    ];

    // Activity over last 7 days
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

    // Sales Performance (Real Names)
    const salesStats: Record<string, { count: number, amount: number, completedCount: number, totalTimeDays: number }> = {};
    filteredProcesses.forEach(p => {
      const name = p.createdByName || 'Sin asignar';
      const amount = Number(p.amount) || 0;
      if (!salesStats[name]) {
        salesStats[name] = { count: 0, amount: 0, completedCount: 0, totalTimeDays: 0 };
      }
      salesStats[name].count++;
      salesStats[name].amount += amount;
      
      if (p.currentStage === 'completado') {
        salesStats[name].completedCount++;
        salesStats[name].totalTimeDays += (p.updatedAt - p.createdAt) / (1000 * 60 * 60 * 24);
      }
    });

    const salesPerformanceData = Object.entries(salesStats)
      .map(([name, data]) => ({ 
        name, 
        importe: data.amount, 
        cantidad: data.count,
        completados: data.completedCount,
        tasaConversion: data.count > 0 ? (data.completedCount / data.count) * 100 : 0,
        tiempoMedio: data.completedCount > 0 ? data.totalTimeDays / data.completedCount : 0
      }))
      .sort((a, b) => b.importe - a.importe);

    // Tags Distribution (by Amount)
    const tagAmounts: Record<string, number> = {};
    filteredProcesses.forEach(p => {
      const amount = Number(p.amount) || 0;
      if (p.tags && p.tags.length > 0) {
        p.tags.forEach(tag => {
          tagAmounts[tag] = (tagAmounts[tag] || 0) + amount;
        });
      } else {
        tagAmounts['Sin etiqueta'] = (tagAmounts['Sin etiqueta'] || 0) + amount;
      }
    });
    const tagAmountData = Object.entries(tagAmounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Bottlenecks
    const stageStagnation: Record<string, { totalDays: number, count: number }> = {
      cotizacion: { totalDays: 0, count: 0 },
      proforma: { totalDays: 0, count: 0 },
      pedido: { totalDays: 0, count: 0 },
      albaran: { totalDays: 0, count: 0 },
      factura: { totalDays: 0, count: 0 }
    };
    
    const nowTimestamp = Date.now();
    filteredProcesses.forEach(p => {
      if (p.currentStage !== 'completado' && stageStagnation[p.currentStage]) {
        const daysInStage = differenceInDays(nowTimestamp, p.updatedAt);
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
    ].filter(s => s.dias > 0);

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

    return { 
      total, completed, active, kpiDelayed, avgCompletionDays, 
      stageData, funnelData, activityData, topClientsData, 
      salesPerformanceData, tagAmountData, stagnationData, 
      totalAmount, amountByStageData, isOverKPI
    };
  }, [filteredProcesses, logs]);

  // Detail view processes
  const detailedProcesses = useMemo(() => {
    if (!detailFilter) return [];
    
    return filteredProcesses.filter(p => {
      switch (detailFilter.type) {
        case 'total': return true;
        case 'active': return p.currentStage !== 'completado';
        case 'kpi': return p.currentStage !== 'completado' && stats.isOverKPI(p.createdAt);
        case 'stage': return p.currentStage === detailFilter.value;
        case 'client': return p.clientName === detailFilter.value;
        case 'commercial': return p.createdByName === detailFilter.value;
        case 'tag': return (p.tags || []).includes(detailFilter.value);
        case 'forecast': return forecastStages.includes(p.currentStage);
        default: return true;
      }
    });
  }, [filteredProcesses, detailFilter, stats, forecastStages]);

  // Calculate pipeline value based on selected forecast stages
  const pipelineValue = useMemo(() => {
    return filteredProcesses
      .filter(p => forecastStages.includes(p.currentStage))
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [filteredProcesses, forecastStages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Analítica de Gestión</h2>
          <p className="text-sm text-slate-500">Dashboard estratégico de DocuFlow</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <Clock className="h-4 w-4 text-slate-400" />
            <input 
              type="date" 
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-xs font-medium focus:outline-none"
            />
            <span className="text-slate-300">|</span>
            <input 
              type="date" 
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-xs font-medium focus:outline-none"
            />
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setDateFrom(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
              setDateTo(format(new Date(), 'yyyy-MM-dd'));
            }}
            className="text-xs"
          >
            Últimos 30 días
          </Button>
        </div>
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
      
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card 
          className="hover:shadow-md transition-all cursor-pointer hover:border-slate-300 active:scale-95"
          onClick={() => handleSetDetail('total', null, 'Todos los expedientes')}
        >
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Users className="h-5 w-5 text-slate-400 mb-2" />
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.total}</h3>
          </CardContent>
        </Card>
        <Card 
          className="hover:shadow-md transition-all cursor-pointer hover:border-codiagro-orange/30 active:scale-95"
          onClick={() => handleSetDetail('active', null, 'Expedientes activos')}
        >
          <CardContent className="p-4 flex flex-col items-center text-center">
            <TrendingUp className="h-5 w-5 text-codiagro-orange mb-2" />
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Activos</p>
            <h3 className="text-2xl font-bold text-codiagro-orange">{stats.active}</h3>
          </CardContent>
        </Card>
        <Card 
          className="hover:shadow-md transition-all cursor-pointer border-l-4 border-l-red-500 hover:border-red-300 active:scale-95"
          onClick={() => handleSetDetail('kpi', null, 'Expedientes fuera de KPI (> 3 días)')}
        >
          <CardContent className="p-4 flex flex-col items-center text-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mb-2" />
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Fuera KPI</p>
            <h3 className="text-2xl font-bold text-red-600">{stats.kpiDelayed}</h3>
            <p className="text-[10px] text-red-400 mt-1">&gt; 3 días hábiles</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Clock className="h-5 w-5 text-slate-400 mb-2" />
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Media Cierre</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.avgCompletionDays.toFixed(1)}d</h3>
          </CardContent>
        </Card>
        <Card 
          className="bg-codiagro-green/5 border-codiagro-green/20 hover:shadow-md transition-all cursor-pointer active:scale-95 group relative overflow-hidden md:col-span-2 lg:col-span-2"
          onClick={() => handleSetDetail('forecast', null, `Previsión: ${forecastStages.join(', ')}`)}
        >
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Target className="h-5 w-5 text-codiagro-green mb-2" />
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Cartera Seleccionada (Previsión)</p>
            <h3 className="text-2xl font-bold text-codiagro-green truncate w-full">
              {pipelineValue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
            </h3>
            
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {allStages.map(stage => (
                <button
                  key={stage.id}
                  onClick={() => toggleForecastStage(stage.id)}
                  className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${
                    forecastStages.includes(stage.id)
                      ? 'bg-codiagro-green text-white border-codiagro-green'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-codiagro-green/30'
                  }`}
                >
                  {stage.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic">Selecciona los estados para proyectar ingresos</p>
          </CardContent>
          <div className="absolute top-0 right-0 p-1">
            <div className="h-2 w-2 rounded-full bg-codiagro-green animate-pulse" />
          </div>
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
                    onClick={(data) => handleSetDetail('stage', data.name.toLowerCase(), `Fase: ${data.name}`)}
                    className="cursor-pointer outline-none"
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
                  <Bar 
                    dataKey="amount" 
                    name="Importe" 
                    radius={[0, 4, 4, 0]}
                    onClick={(data) => handleSetDetail('client', data.name, `Cliente: ${data.name}`)}
                    className="cursor-pointer"
                  >
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold">Embudo de Conversión</CardTitle>
            <Target className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.funnelData} layout="vertical" margin={{ left: -20, right: 40 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar 
                  dataKey="value" 
                  fill="#255837" 
                  radius={[0, 4, 4, 0]} 
                  barSize={30}
                  onClick={(data) => handleSetDetail('stage', data.name.toLowerCase(), `Fase: ${data.name}`)}
                  className="cursor-pointer"
                >
                  {stats.funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fillOpacity={1 - (index * 0.15)} />
                  ))}
                  <LabelList 
                    dataKey="value" 
                    position="right" 
                    formatter={(v: number) => `${v} (${((v / stats.total) * 100).toFixed(0)}%)`}
                    style={{ fontSize: '12px', fontWeight: 'bold', fill: '#475569' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold">Importe por Segmento (Etiqueta)</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="h-[300px]">
            {stats.tagAmountData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.tagAmountData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => percent > 0.05 ? `${name}` : ''}
                    labelLine={false}
                    onClick={(data) => handleSetDetail('tag', data.name, `Etiqueta: ${data.name}`)}
                    className="cursor-pointer outline-none"
                  >
                    {stats.tagAmountData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <p>Sin datos de etiquetas</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold text-slate-800">Tabla de Desempeño Comercial</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-500">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3">Comercial</th>
                    <th className="px-4 py-3 text-center">Exp.</th>
                    <th className="px-4 py-3 text-center">Conversión</th>
                    <th className="px-4 py-3 text-center">T. Medio</th>
                    <th className="px-4 py-3 text-right">Importe Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.salesPerformanceData.map((row, i) => (
                    <tr 
                      key={i} 
                      className="bg-white border-b hover:bg-slate-50 transition-colors cursor-pointer group"
                      onClick={() => handleSetDetail('commercial', row.name, `Comercial: ${row.name}`)}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 group-hover:text-codiagro-green transition-colors">{row.name}</td>
                      <td className="px-4 py-3 text-center">{row.cantidad}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                          row.tasaConversion > 50 ? 'bg-emerald-100 text-emerald-700' : 
                          row.tasaConversion > 25 ? 'bg-amber-100 text-amber-700' : 
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {row.tasaConversion.toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs">{row.tiempoMedio.toFixed(1)}d</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">
                        {row.importe.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {stats.salesPerformanceData.length === 0 && (
              <div className="text-center py-8 text-slate-400">No hay datos suficientes para generar el ranking</div>
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
                  <Bar 
                    dataKey="dias" 
                    name="Días en fase" 
                    fill="#ef4444" 
                    radius={[4, 4, 0, 0]} 
                    onClick={(data) => handleSetDetail('stage', data.name.toLowerCase(), `Estancamiento: ${data.name}`)}
                    className="cursor-pointer"
                  />
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
                  <Bar 
                    dataKey="importe" 
                    name="Importe" 
                    radius={[4, 4, 0, 0]}
                    onClick={(data) => handleSetDetail('stage', data.name.toLowerCase(), `Importes en Fase: ${data.name}`)}
                    className="cursor-pointer"
                  >
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

      {/* Detail Table Section */}
      {detailFilter && (
        <div ref={detailRef} className="mt-8 space-y-4 animate-in fade-in slide-in-from-bottom-5 duration-500">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border-l-4 border-l-codiagro-green shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-codiagro-green/10 rounded-lg">
                <FileText className="h-5 w-5 text-codiagro-green" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">{detailFilter.label}</h3>
                <p className="text-sm text-slate-500">{detailedProcesses.length} expedientes encontrados</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearDetail}
              className="text-slate-400 hover:text-red-500 hover:bg-red-50"
            >
              <X className="h-4 w-4 mr-2" />
              Cerrar Detalle
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-500">
                  <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b">
                    <tr>
                      <th className="px-4 py-3">Referencia</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Título</th>
                      <th className="px-4 py-3 text-center">Estado</th>
                      <th className="px-4 py-3 text-right">Importe</th>
                      <th className="px-4 py-3 text-right">Creado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailedProcesses.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400">#{p.id.slice(0, 8)}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{p.clientName}</td>
                        <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">{p.title}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.currentStage === 'completado' ? 'bg-emerald-100 text-emerald-700' :
                            p.currentStage === 'factura' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600 uppercase'
                          }`}>
                            {p.currentStage}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">
                          {p.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-400">
                          {format(new Date(p.createdAt), 'dd MMM yyyy', { locale: es })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {detailedProcesses.length === 0 && (
                <div className="py-12 text-center text-slate-400">
                  No hay expedientes que coincidan con este criterio
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
