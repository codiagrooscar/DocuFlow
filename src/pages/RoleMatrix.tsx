import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Role, roleTranslations } from '../types';
import { Badge } from '../components/ui/badge';
import { Check, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

interface Permission {
  id: string;
  module: string;
  action: string;
  roles: Role[];
}

const defaultPermissions: Permission[] = [
  { id: '1', module: 'Expedientes', action: 'Crear', roles: ['admin', 'sales'] },
  { id: '2', module: 'Expedientes', action: 'Eliminar', roles: ['admin'] },
  { id: '3', module: 'Expedientes', action: 'Duplicar', roles: ['admin', 'sales'] },
  { id: '4', module: 'Ofertas', action: 'Aprobar', roles: ['admin', 'sales'] },
  { id: '5', module: 'Riesgos', action: 'Autorizar SLA', roles: ['admin', 'risk'] },
  { id: '6', module: 'Normativa', action: 'Aprobar Certificados', roles: ['admin', 'compliance'] },
  { id: '7', module: 'Logística', action: 'Generar Albarán', roles: ['admin', 'logistics'] },
  { id: '8', module: 'Finanzas', action: 'Generar Factura', roles: ['admin', 'finance'] },
  { id: '9', module: 'Producción', action: 'Pasar a Logística', roles: ['admin', 'production'] },
];

export default function RoleMatrix() {
  const [permissions, setPermissions] = useState<Permission[]>(defaultPermissions);
  const roles: Role[] = ['admin', 'sales', 'compliance', 'risk', 'production', 'logistics', 'finance'];

  const togglePermission = (permId: string, role: Role) => {
    setPermissions(prev => prev.map(p => {
      if (p.id === permId) {
        if (p.roles.includes(role)) {
          return { ...p, roles: p.roles.filter(r => r !== role) };
        } else {
          return { ...p, roles: [...p.roles, role] };
        }
      }
      return p;
    }));
  };

  const saveChanges = () => {
    toast.success('Matriz de permisos actualizada correctamente');
  };

  return (
    <Card className="mt-8">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Matriz de Permisos Dinámica (RBAC)</CardTitle>
          <CardDescription>Configura el control de acceso basado en roles por módulo</CardDescription>
        </div>
        <Button onClick={saveChanges} className="bg-codiagro-green hover:bg-codiagro-green-dark">Guardar Cambios</Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Módulo / Acción</th>
              {roles.map(role => (
                <th key={role} className="px-4 py-3 text-center">
                  <Badge variant={role === 'admin' ? 'default' : 'secondary'} className={role === 'admin' ? 'bg-codiagro-green text-white' : ''}>
                    {roleTranslations[role]}
                  </Badge>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {permissions.map((perm) => (
              <tr key={perm.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-slate-800">
                  <span className="text-slate-500 mr-2">{perm.module}</span>
                  {perm.action}
                </td>
                {roles.map(role => (
                  <td key={role} className="px-4 py-3 text-center" onClick={() => role !== 'admin' && togglePermission(perm.id, role)}>
                    <div className={`mx-auto w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${perm.roles.includes(role) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}>
                      {perm.roles.includes(role) ? <Check className="w-4 h-4" /> : <X className="w-3 h-3" />}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
