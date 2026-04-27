import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Role, roleTranslations } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ShieldAlert, UserPlus, Save, Trash2, Mail, Edit, X } from 'lucide-react';
import { toast } from 'sonner';
import RoleMatrix from './RoleMatrix';

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  // New user form state
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<Role>('sales');

  // Edit user state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<Role>('sales');
  const [editPassword, setEditPassword] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('users').select('*').order('displayName');
      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast.error(`Error al cargar usuarios: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getAdminClient = async () => {
    const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error("No service key");
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(import.meta.env.VITE_SUPABASE_URL, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newName) return;

    setIsCreating(true);
    try {
      const adminSupabase = await getAdminClient();

      // Create user in Auth
      const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email: newEmail,
        password: newPassword,
        email_confirm: true,
        user_metadata: { full_name: newName }
      });

      if (authError) throw authError;

      if (authData?.user) {
        // Create user profile in public.users using adminSupabase to bypass RLS restrictions
        const { error: profileError } = await adminSupabase.from('users').insert([{
           uid: authData.user.id,
           email: newEmail,
           displayName: newName,
           role: newRole
        }]);

        if (profileError) throw profileError;
        
        toast.success(`Usuario ${newName} creado exitosamente`);
        setNewEmail(''); setNewPassword(''); setNewName('');
        fetchUsers();
      }
    } catch (error: any) {
      if (error.message === "No service key") {
        toast.error("VITE_SUPABASE_SERVICE_ROLE_KEY no está configurada en .env");
      } else {
        toast.error(`Error al crear usuario: ${error.message}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = (u: User) => {
    setEditingUserId(u.uid);
    setEditName(u.displayName);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditPassword('');
  };

  const handleUpdateUser = async (uid: string) => {
    if (!editName.trim()) return;
    try {
      const adminClient = await getAdminClient();
      
      // 1. Damos de alta los cambios en Auth (Nombre, Correo y/o Contraseña si se rellenó)
      const authUpdates: any = { 
          user_metadata: { full_name: editName },
          email: editEmail,
          email_confirm: true // Force confirmation if required by settings
      };
      if (editPassword.trim()) {
        authUpdates.password = editPassword.trim();
      }
      
      const { error: authError } = await adminClient.auth.admin.updateUserById(uid, authUpdates);
      if (authError) throw authError;

      // 2. Sincronizamos los cambios en public.users
      const { error: dbError } = await adminClient.from('users').update({ 
        displayName: editName,
        email: editEmail,
        role: editRole 
      }).eq('uid', uid);
      
      if (dbError) throw dbError;

      toast.success('Usuario actualizado correctamente');
      setEditingUserId(null);
      fetchUsers();
    } catch (error: any) {
      if (error.message === "No service key") toast.error("Falta VITE_SUPABASE_SERVICE_ROLE_KEY");
      else toast.error(`Error al actualizar: ${error.message}`);
    }
  };

  const handleDeleteUser = async (uid: string, name: string) => {
    if (!confirm(`¿Estás completamente seguro de eliminar al usuario "${name}"?\nEsta acción borrará irrevocablemente su cuenta. fallará si el usuario ya ha creado o interactuado con expedientes por motivos de seguridad legal.`)) return;

    try {
      const adminClient = await getAdminClient();
      const { error } = await adminClient.auth.admin.deleteUser(uid);
      
      if (error) throw error;
      
      toast.success(`Usuario ${name} eliminado con éxito`);
      fetchUsers();
    } catch (error: any) {
      if (error.message === "No service key") {
        toast.error("Falta VITE_SUPABASE_SERVICE_ROLE_KEY");
      } else if (error.message?.includes('foreign key constraint') || error.message?.includes('violates foreign key')) {
        toast.error("No se puede eliminar: Este usuario ya tiene expedientes o actividad asignada. Sólo puedes cambiar su contraseña o rol.");
      } else {
        toast.error(`Error al eliminar: ${error.message}`);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Gestión de Usuarios</h2>
        <p className="text-slate-500">Administra los roles y accesos de los empleados de la organización.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Directorio de Usuarios</CardTitle>
              <CardDescription>Usuarios registrados y sus roles actuales</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-slate-500">Cargando usuarios...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 rounded-tl-md">Nombre / Email</th>
                        <th className="px-4 py-3">Rol</th>
                        <th className="px-4 py-3 rounded-tr-md text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map(u => (
                        <tr key={u.uid} className={`hover:bg-slate-50/50 ${editingUserId === u.uid ? 'bg-indigo-50/30' : ''}`}>
                          {editingUserId === u.uid ? (
                            // Modo Edición
                            <>
                              <td className="px-4 py-3">
                                <div className="space-y-2">
                                  <input 
                                    type="text" 
                                    className="w-full text-xs p-1.5 border border-slate-300 rounded" 
                                    value={editName} onChange={e => setEditName(e.target.value)} 
                                    placeholder="Nombre completo"
                                  />
                                  <input 
                                    type="email" 
                                    className="w-full text-xs p-1.5 border border-slate-300 rounded" 
                                    value={editEmail} onChange={e => setEditEmail(e.target.value)} 
                                    placeholder="Correo electrónico"
                                  />
                                  <input 
                                    type="password" 
                                    className="w-full text-xs p-1.5 border border-slate-300 rounded" 
                                    value={editPassword} onChange={e => setEditPassword(e.target.value)} 
                                    placeholder="Nueva contraseña (opcional)"
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-3 align-top">
                                <select
                                    className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-codiagro-green focus:border-codiagro-green"
                                    value={editRole}
                                    onChange={(e) => setEditRole(e.target.value as Role)}
                                >
                                    {Object.entries(roleTranslations).map(([val, label]) => (
                                        <option key={val} value={val}>{label}</option>
                                    ))}
                                </select>
                              </td>
                              <td className="px-4 py-3 align-top text-right">
                                <div className="flex flex-col gap-1 items-end">
                                  <Button size="sm" onClick={() => handleUpdateUser(u.uid)} className="h-7 w-24 bg-codiagro-green hover:bg-codiagro-green-dark">
                                    <Save className="h-3 w-3 mr-1" /> Guardar
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingUserId(null)} className="h-7 w-24 text-slate-500">
                                    Cancelar
                                  </Button>
                                </div>
                              </td>
                            </>
                          ) : (
                            // Modo Lectura
                            <>
                              <td className="px-4 py-3">
                                <div className="font-medium text-slate-900 flex items-center gap-2">
                                  {u.displayName}
                                  {u.role === 'admin' && <Badge className="text-[9px] px-1 py-0 bg-red-100 text-red-700 border-red-200">Admin</Badge>}
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                  <Mail className="h-3 w-3" /> {u.email}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="bg-white">{roleTranslations[u.role]}</Badge>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-1">
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-codiagro-green" onClick={() => handleStartEdit(u)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteUser(u.uid, u.displayName)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Formulario Crear Usuario... */}
        <div>
          <Card className="bg-slate-50 border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-md flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-codiagro-green" />
                Dar de Alta Nuevo Usuario
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Nombre Completo</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ej. Juan Pérez"
                    className="w-full p-2 border border-slate-200 rounded-md text-sm"
                    value={newName} onChange={e => setNewName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Correo Electrónico</label>
                  <input 
                    type="email" 
                    required 
                    placeholder="Ej. juan@codiagro.es"
                    className="w-full p-2 border border-slate-200 rounded-md text-sm"
                    value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Contraseña Inicial</label>
                  <input 
                    type="password" 
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full p-2 border border-slate-200 rounded-md text-sm"
                    value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Rol Inicial</label>
                  <select 
                    className="w-full p-2 border border-slate-200 rounded-md text-sm"
                    value={newRole} onChange={e => setNewRole(e.target.value as Role)}
                  >
                    {Object.entries(roleTranslations).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>

                <Button type="submit" className="w-full bg-codiagro-green hover:bg-codiagro-green-dark" disabled={isCreating}>
                  {isCreating ? 'Creando...' : 'Crear Usuario'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

      </div>
      
      <RoleMatrix />
    </div>
  );
}
