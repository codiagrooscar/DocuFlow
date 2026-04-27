import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  Settings, 
  Plus, 
  Trash2, 
  ArrowRight, 
  Play, 
  Zap, 
  Clock, 
  ShieldAlert, 
  Globe, 
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Bell
} from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '../contexts/DataContext';
import { ProcessStage, ProcessTag, Role, roleTranslations } from '../types';

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: 'ON_CREATE' | 'ON_STAGE_CHANGE' | 'ON_STAGNANT';
  condition: {
    field: 'amount' | 'stage' | 'days_in_stage' | 'currency';
    operator: 'gt' | 'eq' | 'neq';
    value: any;
  };
  action: {
    type: 'ADD_TAG' | 'NOTIFY_ROLE' | 'SET_PRIORITY';
    value: string;
  };
  active: boolean;
  lastRun?: number;
}

const DEFAULT_RULES: AutomationRule[] = [
  {
    id: 'rule-vip',
    name: 'Asignación VIP Automática',
    description: 'Añade etiqueta VIP a pedidos de alto valor.',
    trigger: 'ON_CREATE',
    condition: { field: 'amount', operator: 'gt', value: 25000 },
    action: { type: 'ADD_TAG', value: 'VIP' },
    active: true,
    lastRun: Date.now() - 3600000
  },
  {
    id: 'rule-export',
    name: 'Detección de Exportación',
    description: 'Etiqueta expedientes internacionales por moneda.',
    trigger: 'ON_CREATE',
    condition: { field: 'currency', operator: 'neq', value: 'EUR' },
    action: { type: 'ADD_TAG', value: 'Exportación' },
    active: true
  },
  {
    id: 'rule-sla',
    name: 'Alerta SLA Logística',
    description: 'Avisa si un pedido se estanca en logística.',
    trigger: 'ON_STAGNANT',
    condition: { field: 'days_in_stage', operator: 'gt', value: 2 },
    action: { type: 'NOTIFY_ROLE', value: 'logistics' },
    active: true
  }
];

export default function Automations() {
  const { processes } = useData();
  const [rules, setRules] = useState<AutomationRule[]>(DEFAULT_RULES);
  const [isAdding, setIsAdding] = useState(false);

  const toggleRule = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, active: !r.active } : r));
    toast.success('Estado de la regla actualizado');
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
    toast.success('Regla eliminada');
  };

  const runSimulation = (id: string) => {
    toast.promise(
      new Promise(resolve => setTimeout(resolve, 1500)),
      {
        loading: 'Ejecutando simulación de automatización...',
        success: 'Regla ejecutada. Se han procesado 12 expedientes y aplicado 3 cambios.',
        error: 'Error al ejecutar la regla',
      }
    );
    setRules(rules.map(r => r.id === id ? { ...r, lastRun: Date.now() } : r));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-codiagro-orange fill-codiagro-orange" />
            <span className="text-xs font-bold text-codiagro-orange uppercase tracking-widest">Motor de Reglas v2.0</span>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Automatizaciones</h2>
          <p className="text-lg text-slate-500 mt-1">Flujos inteligentes para optimizar la operativa documental.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-slate-300">
            <Settings className="w-4 h-4 mr-2" /> Historial de Ejecución
          </Button>
          <Button onClick={() => setIsAdding(true)} className="bg-codiagro-green hover:bg-codiagro-green-dark shadow-lg shadow-codiagro-green/20">
            <Plus className="w-4 h-4 mr-2" /> Crear Regla Real
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-codiagro-green to-codiagro-green-dark text-white border-none shadow-xl">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-white/20 rounded-lg">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <Badge className="bg-white/20 text-white border-none">Hoy</Badge>
            </div>
            <p className="text-3xl font-bold">142</p>
            <p className="text-sm opacity-80">Acciones Automatizadas</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-codiagro-orange/10 rounded-lg text-codiagro-orange">
                <Clock className="w-6 h-6" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-800">4.2h</p>
            <p className="text-sm text-slate-500">Tiempo Manual Ahorrado</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <Bell className="w-6 h-6" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-800">18</p>
            <p className="text-sm text-slate-500">Alertas de SLA Evitadas</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider pl-1">Reglas en Producción</h3>
        {rules.map((rule) => (
          <Card key={rule.id} className={`group transition-all hover:shadow-md ${rule.active ? 'border-codiagro-green/30' : 'border-slate-200 grayscale opacity-60'}`}>
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row">
                <div className={`w-2 md:w-1.5 ${rule.trigger === 'ON_CREATE' ? 'bg-blue-500' : rule.trigger === 'ON_STAGNANT' ? 'bg-codiagro-orange' : 'bg-purple-500'}`} />
                <div className="flex-1 p-6">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xl font-bold text-slate-800">{rule.name}</h4>
                        {rule.trigger === 'ON_CREATE' && <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Al Crear</Badge>}
                        {rule.trigger === 'ON_STAGNANT' && <Badge variant="outline" className="text-codiagro-orange border-codiagro-orange/20 bg-codiagro-orange/5">Por Estancamiento</Badge>}
                      </div>
                      <p className="text-slate-500">{rule.description}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right hidden lg:block">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Última ejecución</p>
                        <p className="text-xs text-slate-600 font-medium">{rule.lastRun ? new Date(rule.lastRun).toLocaleString() : 'Nunca'}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-codiagro-green hover:bg-codiagro-green/10"
                        onClick={() => runSimulation(rule.id)}
                        disabled={!rule.active}
                      >
                        <Play className="w-4 h-4 mr-2" /> Simular
                      </Button>
                      <div className="h-8 w-[1px] bg-slate-100 mx-1" />
                      <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteRule(rule.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                    <div className="lg:col-span-5 bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-4">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <ShieldAlert className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Condición Lógica</p>
                        <p className="text-sm font-semibold text-slate-700">
                          Si <span className="text-codiagro-orange font-bold uppercase">{rule.condition.field}</span> {rule.condition.operator === 'gt' ? '>' : rule.condition.operator === 'neq' ? '≠' : '='} <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">{rule.condition.value}{rule.condition.field === 'amount' ? '€' : ''}</span>
                        </p>
                      </div>
                    </div>

                    <div className="lg:col-span-1 flex justify-center">
                      <ArrowRight className="w-6 h-6 text-slate-300" />
                    </div>

                    <div className="lg:col-span-5 bg-codiagro-green/5 rounded-xl p-4 border border-codiagro-green/10 flex items-center gap-4">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <Zap className="w-5 h-5 text-codiagro-green" />
                      </div>
                      <div>
                        <p className="text-[10px] text-codiagro-green uppercase font-bold">Acción Inmediata</p>
                        <p className="text-sm font-semibold text-slate-700">
                          {rule.action.type === 'ADD_TAG' && <>Añadir etiqueta <Badge className="bg-codiagro-green/10 text-codiagro-green border-none ml-1">{rule.action.value}</Badge></>}
                          {rule.action.type === 'NOTIFY_ROLE' && <>Notificar a <span className="font-bold text-codiagro-green">{roleTranslations[rule.action.value as Role]}</span></>}
                        </p>
                      </div>
                    </div>

                    <div className="lg:col-span-1 flex justify-end">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={rule.active} onChange={() => toggleRule(rule.id)} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-codiagro-green"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {rules.length === 0 && (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-10 h-10 text-slate-300" />
          </div>
          <h4 className="text-xl font-bold text-slate-800">No hay automatizaciones activas</h4>
          <p className="text-slate-500 max-w-xs mx-auto mt-2">Crea flujos de trabajo inteligentes para reducir tareas manuales.</p>
          <Button className="mt-6 bg-codiagro-green" onClick={() => setIsAdding(true)}>Empezar a Automatizar</Button>
        </div>
      )}
    </div>
  );
}
