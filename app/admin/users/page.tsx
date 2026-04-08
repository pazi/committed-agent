'use client';

import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';

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

  // Create form state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<string>('client');
  const [newTenantIds, setNewTenantIds] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

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

  useEffect(() => { fetchUsers(); fetchTenants(); }, []);

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
      setFormError('Selecteer minimaal 1 tenant.');
      setFormLoading(false);
      return;
    }

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newEmail,
        full_name: newName,
        password: newPassword,
        role: newRole,
        tenant_ids,
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

  async function handleUpdateRole(userId: string, role: string) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    });
    fetchUsers();
    setEditingUser(null);
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

  if (loading) return <div className="p-8 text-gray-500">Laden...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Gebruikersbeheer</h1>
          <p className="text-sm text-gray-500">{users.length} gebruiker(s) &middot; {tenants.length} tenant(s)</p>
        </div>
        <div className="flex gap-3">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
            &larr; Terug naar chat
          </Link>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            + Nieuwe gebruiker
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-8">
        {/* Create form */}
        {showCreateForm && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Nieuwe gebruiker aanmaken</h2>

            {formError && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4 border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Naam</label>
                  <input
                    type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Volledige naam"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input
                    type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="naam@bedrijf.nl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wachtwoord</label>
                  <input
                    type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Min. 8 tekens"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                  <select
                    value={newRole} onChange={(e) => setNewRole(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="client">Client</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {/* Tenant checkboxes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tenants</label>
                {isAllTenantsRole(newRole) && (
                  <p className="text-xs text-gray-400 mb-2">
                    {newRole === 'admin' ? 'Admins' : 'Managers'} hebben automatisch toegang tot alle tenants.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {tenants.map((tenant) => {
                    const allAccess = isAllTenantsRole(newRole);
                    const checked = allAccess || newTenantIds.has(tenant.id);
                    return (
                      <label
                        key={tenant.id}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                          allAccess
                            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                            : checked
                              ? 'bg-blue-50 border-blue-200 text-blue-800 cursor-pointer'
                              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={allAccess}
                          onChange={() => toggleTenant(tenant.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                        />
                        <span className={allAccess ? 'opacity-50' : ''}>{tenant.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowCreateForm(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5">
                  Annuleren
                </button>
                <button type="submit" disabled={formLoading}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors">
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
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Tenants</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Rol</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Acties</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.full_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {user.tenants.length === 0 && (
                        <span className="text-xs text-gray-400">Geen</span>
                      )}
                      {user.tenants.map((t) => (
                        <span
                          key={t.id}
                          className="bg-orange-50 text-orange-700 text-xs font-medium px-2 py-0.5 rounded-full"
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {editingUser?.id === user.id ? (
                      <select
                        value={editingUser.role}
                        onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                        className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1"
                        autoFocus
                        onBlur={() => setEditingUser(null)}
                      >
                        <option value="client">Client</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingUser(user)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${roleBadgeColors[user.role]}`}
                        title="Klik om rol te wijzigen"
                      >
                        {roleLabels[user.role]}
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(user.id, user.is_active)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {user.is_active ? 'Actief' : 'Inactief'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(user.id, user.email)}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Verwijderen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
