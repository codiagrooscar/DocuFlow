import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Settings, Plus, Trash2, ArrowRight, Save, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '../contexts/DataContext';

interface Rule {
  id: string;
  name: string;
  condition: string;
  action: string;
  active: boolean;
}

export default function Automations() {
  const { processes } = useData();
  const [rules, setRules] = useState<Rule[]>([
    {
      id: '1',
      name: 'Asignación VIP por Monto',
      condition: 'AMOUNT_GT_10000',
      action: 'ADD_TAG_VIP',
      active: true
    },
    {
      id: '2',
      name: 'Alerta SLA Riesgos',
      condition: 'STAGE_RISK_GT_2_DAYS',
      action: 'NOTIFY_ADMIN',
      active: true
    }
  ]);

  const toggleRule = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, active: !r.active } : r));
    toast.success('Estado de la regla actualizado');
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
    toast.success('Regla eliminada');
  };

  const addRule = () => {
    const newRule: Rule = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Nueva Regla',
      condition: 'STAGE_EQUALS_PEDIDO',
      action: 'NOTIFY_PRODUCTION',
      active: false
    };
    setRules([...rules, newRule]);
  };

  const renderConditionLabel = (cond: string) => {
    switch(cond) {
      case 'AMOUNT_GT_10000': return 'Si monto > 10.000€';
      case 'STAGE_RISK_GT_2_DAYS': return 'Si en misma fase > 2 días';
      case 'STAGE_EQUALS_PEDIDO': return 'Si cambia a fase Pedido';
      default: return cond;
    }
  };

  const renderActionLabel = (act: string) => {
    switch(act) {
      case 'ADD_TAG_VIP': return 'Añadir etiqueta "VIP"';
      case 'NOTIFY_ADMIN': return 'Notificar a Administrador';
      case 'NOTIFY_PRODUCTION': return 'Notificar a Producción';
      default: return act;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Automatizaciones</h2>
          <p className="text-slate-500 mt-1">Configura reglas de negocio para el flujo documental.</p>
        </div>
        <Button onClick={addRule} className="bg-codiagro-green hover:bg-codiagro-green-dark">
          <Plus className="w-4 h-4 mr-2" /> Nueva Regla
        </Button>
      </div>

      <div className="grid gap-4">
        {rules.map((rule) => (
          <Card key={rule.id} className={rule.active ? 'border-codiagro-green/50 shadow-sm' : 'border-slate-200 opacity-70'}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-slate-800">{rule.name}</h3>
                  <Badge variant={rule.active ? 'success' : 'secondary'}>
                    {rule.active ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-3 mt-1 text-sm bg-slate-50 p-2 rounded-md border border-slate-100">
                  <div className="flex items-center gap-1.5 text-codiagro-orange font-medium">
                    <Settings className="w-4 h-4" /> 
                    <span>SI</span>
                  </div>
                  <span className="text-slate-700 bg-white px-2 py-0.5 rounded border shadow-sm">
                    {renderConditionLabel(rule.condition)}
                  </span>
                  
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  
                  <div className="flex items-center gap-1.5 text-codiagro-green font-medium">
                    <Play className="w-4 h-4" />
                    <span>ENTONCES</span>
                  </div>
                  <span className="text-slate-700 bg-white px-2 py-0.5 rounded border shadow-sm">
                    {renderActionLabel(rule.action)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => toggleRule(rule.id)}>
                  {rule.active ? 'Desactivar' : 'Activar'}
                </Button>
                <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteRule(rule.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {rules.length === 0 && (
          <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
            <Settings className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No hay reglas de automatización configuradas.</p>
            <Button variant="outline" className="mt-4" onClick={addRule}>Crear mi primera regla</Button>
          </div>
        )}
      </div>
    </div>
  );
}
