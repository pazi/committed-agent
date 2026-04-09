'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../src/lib/supabase-browser';
import { Sidebar } from '../../components/Sidebar';

interface UserTenant {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'client';
  is_active: boolean;
  tenants: UserTenant[];
  created_at: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  client: 'Client',
};

const roleBadgeColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  client: 'bg-gray-100 text-gray-600',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [currentUserId, setCurrentUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('');

  // Filter state
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterTenant, setFilterTenant] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSearch, setFilterSearch] = useState('');

  // Create form state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<string>('client');
  const [newTenantIds, setNewTenantIds] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const isAllTenantsRole = (role: string) => role === 'admin' || role === 'manager';

  async function fetchUsers() {
    const res = await fetch('/api/admin/users');
    if (!res.ok) {
      setError('Geen toegang of fout bij het laden van users.');
      setLoading(false);
      return;
    }
    setUsers(await res.json());
    setLoading(false);
  }

  async function fetchTenants() {
    const res = await fetch('/api/admin/tenants');
    if (res.ok) setTenants(await res.json());
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? '');
      setUserEmail(data.user?.email ?? '');
      setUserRole(data.user?.user_metadata?.role ?? '');
    });
    fetchUsers();
    fetchTenants();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function toggleTenant(tenantId: string) {
    setNewTenantIds((prev) => {
      const next = new Set(prev);
      if (next.has(tenantId)) next.delete(tenantId);
      else next.add(tenantId);
      return next;
    });
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    const tenant_ids = isAllTenantsRole(newRole)
      ? tenants.map((t) => t.id)
      : Array.from(newTenantIds);

    if (tenant_ids.length === 0) {
      setFormError('Selecteer minimaal 1 account.');
      setFormLoading(false);
      return;
    }

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newEmail, full_name: newName, password: newPassword, role: newRole, tenant_ids,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setFormError(data.error);
    } else {
      setShowCreateForm(false);
      setNewEmail(''); setNewName(''); setNewPassword(''); setNewRole('client');
      setNewTenantIds(new Set());
      fetchUsers();
    }
    setFormLoading(false);
  }

  async function handleSaveEdit(updates: Partial<User> & { tenant_ids?: string[] }) {
    if (!editingUser) return;
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: editingUser.id, ...updates }),
    });
    setEditingUser(null);
    fetchUsers();
  }

  async function handleToggleActive(userId: string, isActive: boolean) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, is_active: !isActive }),
    });
    fetchUsers();
  }

  async function handleDelete(userId: string, email: string) {
    if (!confirm(`Weet je zeker dat je ${email} wilt verwijderen?`)) return;
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) alert(data.error);
    else fetchUsers();
  }

  // Apply filters
  const filteredUsers = users.filter(u => {
    if (filterRole !== 'all' && u.role !== filterRole) return false;
    if (filterStatus === 'active' && !u.is_active) return false;
    if (filterStatus === 'inactive' && u.is_active) return false;
    if (filterTenant !== 'all' && !u.tenants.some(t => t.id === filterTenant)) return false;
    if (filterSearch && !u.full_name.toLowerCase().includes(filterSearch.toLowerCase()) && !u.email.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex h-screen">
      <Sidebar userEmail={userEmail} userRole={userRole} onSignOut={handleSignOut} />

      <div className="flex-1 overflow-y-auto bg-gray-50/50">
        {loading ? (
          <div className="p-8 text-gray-500">Laden...</div>
        ) : error ? (
          <div className="p-8 text-red-600">{error}</div>
        ) : (
          <div className="max-w-5xl mx-auto p-8">
            <header className="mb-6 flex items-end justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Gebruikersbeheer</h1>
                <p className="text-sm text-gray-500 mt-1">{filteredUsers.length} van {users.length} gebruiker(s)</p>
              </div>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              >
                + Nieuwe gebruiker
              </button>
            </header>

            {/* Filters */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 shadow-sm flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Zoek op naam of e-mail..."
                className="flex-1 min-w-[200px] bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
              >
                <option value="all">Alle rollen</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="client">Client</option>
              </select>
              <select
                value={filterTenant}
                onChange={(e) => setFilterTenant(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
              >
                <option value="all">Alle accounts</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
              >
                <option value="all">Alle statussen</option>
                <option value="active">Actief</option>
                <option value="inactive">Inactief</option>
              </select>
            </div>

            {/* Create form */}
            {showCreateForm && (
              <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Nieuwe gebruiker aanmaken</h2>
                {formError && (
                  <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4 border border-red-200">{formError}</div>
                )}
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Naam" />
                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="E-mail" />
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Wachtwoord (min. 8 tekens)" />
                    <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="client">Client</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Accounts</label>
                      {!isAllTenantsRole(newRole) && (
                        <button
                          type="button"
                          onClick={() => setNewTenantIds(
                            newTenantIds.size === tenants.length ? new Set() : new Set(tenants.map(t => t.id))
                          )}
                          className="text-xs text-blue-600 hover:text-blue-500 font-medium"
                        >
                          {newTenantIds.size === tenants.length ? 'Deselecteer alle' : 'Selecteer alle'}
                        </button>
                      )}
                    </div>
                    {isAllTenantsRole(newRole) && (
                      <p className="text-xs text-gray-400 mb-2">{newRole === 'admin' ? 'Admins' : 'Managers'} hebben automatisch toegang tot alle accounts.</p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {tenants.map((tenant) => {
                        const allAccess = isAllTenantsRole(newRole);
                        const checked = allAccess || newTenantIds.has(tenant.id);
                        return (
                          <label key={tenant.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                            allAccess ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                            : checked ? 'bg-blue-50 border-blue-200 text-blue-800 cursor-pointer'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 cursor-pointer'}`}>
                            <input type="checkbox" checked={checked} disabled={allAccess} onChange={() => toggleTenant(tenant.id)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40" />
                            <span className={allAccess ? 'opacity-50' : ''}>{tenant.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <button type="button" onClick={() => setShowCreateForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5">Annuleren</button>
                    <button type="submit" disabled={formLoading} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors">
                      {formLoading ? 'Aanmaken...' : 'Aanmaken'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Users table */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Naam</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">E-mail</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Accounts</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Rol</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {user.full_name}
                        {user.id === currentUserId && <span className="ml-2 text-xs text-blue-600">(jij)</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {user.tenants.length === 0 && <span className="text-xs text-gray-400">Geen</span>}
                          {user.tenants.map((t) => (
                            <span key={t.id} className="bg-orange-50 text-orange-700 text-xs font-medium px-2 py-0.5 rounded-full">{t.name}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${roleBadgeColors[user.role]}`}>{roleLabels[user.role]}</span>
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => handleToggleActive(user.id, user.is_active)} className={`text-xs font-medium px-2.5 py-1 rounded-full ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {user.is_active ? 'Actief' : 'Inactief'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-3">
                          <button onClick={() => setEditingUser(user)} className="text-xs text-blue-600 hover:text-blue-700 transition-colors">Bewerken</button>
                          {user.id !== currentUserId && (
                            <button onClick={() => handleDelete(user.id, user.email)} className="text-xs text-red-500 hover:text-red-700 transition-colors">Verwijderen</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          tenants={tenants}
          isAllTenantsRole={isAllTenantsRole}
          isCurrentUser={editingUser.id === currentUserId}
          onClose={() => setEditingUser(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}

// ============================================
// Edit User Modal
// ============================================

function EditUserModal({
  user, tenants, isAllTenantsRole, isCurrentUser, onClose, onSave,
}: {
  user: User;
  tenants: Tenant[];
  isAllTenantsRole: (role: string) => boolean;
  isCurrentUser: boolean;
  onClose: () => void;
  onSave: (updates: Partial<User> & { tenant_ids?: string[] }) => void;
}) {
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState(user.role);
  const [tenantIds, setTenantIds] = useState<Set<string>>(new Set(user.tenants.map(t => t.id)));

  // Wachtwoord wijzigen (alleen voor eigen account)
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function handlePasswordSubmit() {
    setPasswordError('');
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setPasswordError('Nieuwe wachtwoorden komen niet overeen');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Nieuw wachtwoord moet minimaal 8 tekens zijn');
      return;
    }
    setPasswordLoading(true);
    const res = await fetch('/api/me/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPasswordError(data.error ?? 'Onbekende fout');
    } else {
      setPasswordSuccess(true);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    }
    setPasswordLoading(false);
  }

  function toggleTenant(id: string) {
    setTenantIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const allAccess = isAllTenantsRole(role);
    onSave({
      full_name: fullName,
      role,
      tenant_ids: allAccess ? tenants.map(t => t.id) : Array.from(tenantIds),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Gebruiker bewerken</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Naam</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input type="text" value={user.email} disabled className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
            <select value={role} onChange={(e) => setRole(e.target.value as User['role'])} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="client">Client</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Accounts</label>
              {!isAllTenantsRole(role) && (
                <button
                  type="button"
                  onClick={() => setTenantIds(
                    tenantIds.size === tenants.length ? new Set() : new Set(tenants.map(t => t.id))
                  )}
                  className="text-xs text-blue-600 hover:text-blue-500 font-medium"
                >
                  {tenantIds.size === tenants.length ? 'Deselecteer alle' : 'Selecteer alle'}
                </button>
              )}
            </div>
            {isAllTenantsRole(role) && (
              <p className="text-xs text-gray-400 mb-2">{role === 'admin' ? 'Admins' : 'Managers'} hebben automatisch toegang tot alle accounts.</p>
            )}
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {tenants.map(t => {
                const allAccess = isAllTenantsRole(role);
                const checked = allAccess || tenantIds.has(t.id);
                return (
                  <label key={t.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
                    allAccess ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                    : checked ? 'bg-blue-50 border-blue-200 text-blue-800 cursor-pointer'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 cursor-pointer'}`}>
                    <input type="checkbox" checked={checked} disabled={allAccess} onChange={() => toggleTenant(t.id)} className="rounded border-gray-300 text-blue-600" />
                    <span className={allAccess ? 'opacity-50' : ''}>{t.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
          {isCurrentUser && (
            <div className="border-t border-gray-200 pt-4">
              {!showPasswordSection ? (
                <button
                  type="button"
                  onClick={() => setShowPasswordSection(true)}
                  className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                >
                  Wachtwoord wijzigen
                </button>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">Wachtwoord wijzigen</h3>
                  {passwordError && (
                    <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg border border-red-200">{passwordError}</div>
                  )}
                  {passwordSuccess && (
                    <div className="bg-green-50 text-green-700 text-xs px-3 py-2 rounded-lg border border-green-200">Wachtwoord succesvol gewijzigd.</div>
                  )}
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Huidig wachtwoord"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nieuw wachtwoord (min. 8 tekens)"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Bevestig nieuw wachtwoord"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => { setShowPasswordSection(false); setPasswordError(''); setPasswordSuccess(false); }}
                      className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
                    >
                      Annuleren
                    </button>
                    <button
                      type="button"
                      onClick={handlePasswordSubmit}
                      disabled={passwordLoading || !currentPassword || !newPassword}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
                    >
                      {passwordLoading ? 'Opslaan...' : 'Wachtwoord opslaan'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Annuleren</button>
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-6 py-2 rounded-xl transition-colors">Opslaan</button>
          </div>
        </form>
      </div>
    </div>
  );
}

