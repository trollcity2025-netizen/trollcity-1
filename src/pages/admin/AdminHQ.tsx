import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Users, Briefcase, DollarSign, FileText, Activity, Plus, Edit, Trash2, Eye, X, Search, UserPlus, Gift, Shield } from 'lucide-react';
import BroadcastLockdownControl from './components/BroadcastLockdownControl';
import { supabase, UserRole } from '../../lib/supabase';
import RequireRole from '../../components/RequireRole';

interface User {
  id: string;
  username: string;
}

interface Role {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  description?: string;
  budget_allocation?: number;
  manager_id?: string;
  manager?: { user?: User };
  staff_count?: number;
}

interface PayModel {
  id: string;
  name: string;
  description?: string;
  model_type: 'percentage' | 'fixed' | 'hybrid';
  percentage?: number;
  base_amount?: number;
  bonus_structure?: string;
}

interface Staff {
  id: string;
  user_id: string;
  user?: User;
  company_role_id?: string;
  company_role?: Role;
  department_id?: string;
  department?: Department;
  pay_model_id?: string;
  pay_model?: PayModel;
  employment_status: 'active' | 'terminated' | 'on_leave';
  hire_date: string;
  base_salary: number;
  contract_terms: string;
}

interface RevenueSource {
  id: string;
  name: string;
  description?: string;
  category: string;
  estimated_monthly: number;
}

interface Invoice {
  id: string;
  staff_id: string;
  staff?: Staff;
  period_start: string;
  period_end: string;
  gross_amount: number;
  deductions: number;
  taxes: number;
  net_amount: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Tab Components
// Hire Staff Modal Component
function HireStaffModal({ isOpen, onClose, onHire }: { isOpen: boolean; onClose: () => void; onHire: () => void }) {
  const [formData, setFormData] = useState({
    userId: '',
    roleId: '',
    departmentId: '',
    payModelId: '',
    baseSalary: '',
    contractTerms: '',
    startDate: new Date().toISOString().split('T')[0]
  });
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [payModels, setPayModels] = useState<PayModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadFormData = useCallback(async () => {
    try {
      const [usersRes, rolesRes, deptRes, payRes] = await Promise.all([
        supabase.from('user_profiles').select('id, username').limit(100),
        supabase.from('company_roles').select('*'),
        supabase.from('departments').select('*'),
        supabase.from('pay_models').select('*')
      ]);

      setUsers(usersRes.data || []);
      setRoles(rolesRes.data || []);
      setDepartments(deptRes.data || []);
      setPayModels(payRes.data || []);
    } catch (error) {
      console.error('Error loading form data:', error);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadFormData();
    }
  }, [isOpen, loadFormData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.rpc('hire_staff', {
        p_user_id: formData.userId,
        p_company_role_id: formData.roleId,
        p_department_id: formData.departmentId,
        p_pay_model_id: formData.payModelId,
        p_base_salary: parseFloat(formData.baseSalary),
        p_contract_terms: formData.contractTerms,
        p_start_date: formData.startDate
      });

      if (error) throw error;

      onHire();
      onClose();
      setFormData({
        userId: '',
        roleId: '',
        departmentId: '',
        payModelId: '',
        baseSalary: '',
        contractTerms: '',
        startDate: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Error hiring staff:', error);
      alert('Error hiring staff. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">Hire New Staff Member</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select User</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="mt-2 max-h-32 overflow-y-auto bg-zinc-800 rounded-lg">
              {filteredUsers.slice(0, 10).map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, userId: user.id })}
                  className={`w-full text-left px-3 py-2 hover:bg-zinc-700 ${
                    formData.userId === user.id ? 'bg-blue-600' : ''
                  }`}
                >
                  {user.username}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Role</label>
              <select
                value={formData.roleId}
                onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Department</label>
              <select
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Pay Model</label>
              <select
                value={formData.payModelId}
                onChange={(e) => setFormData({ ...formData, payModelId: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Pay Model</option>
                {payModels.map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Base Salary ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.baseSalary}
                onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Start Date</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Contract Terms</label>
            <textarea
              value={formData.contractTerms}
              onChange={(e) => setFormData({ ...formData, contractTerms: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter contract terms and conditions..."
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Hiring...' : 'Hire Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StaffRolesTab() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHireModal, setShowHireModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load staff with details
      const { data: staffData } = await supabase
        .from('staff')
        .select(`
          *,
          user:user_profiles(username),
          company_role:company_roles(name),
          department:departments(name),
          pay_model:pay_models(name)
        `);

      // Load roles and departments
      const { data: rolesData } = await supabase.from('company_roles').select('*');
      const { data: deptData } = await supabase.from('departments').select('*');

      setStaff(staffData || []);
      setRoles(rolesData || []);
      setDepartments(deptData || []);
    } catch (error) {
      console.error('Error loading staff data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const terminateStaff = async (staffId: string) => {
    const reason = prompt('Enter termination reason:');
    if (!reason) return;

    try {
      const { error } = await supabase.rpc('terminate_staff', {
        p_staff_id: staffId,
        p_reason: reason
      });

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error terminating staff:', error);
      alert('Error terminating staff. Please try again.');
    }
  };

  const filteredStaff = staff.filter(member => {
    const matchesSearch = member.user?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.company_role?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.department?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || member.employment_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="animate-pulse">Loading staff data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Staff & Roles Management</h2>
        <button
          onClick={() => setShowHireModal(true)}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Hire Staff
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-900 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-400">{staff.filter(s => s.employment_status === 'active').length}</div>
          <div className="text-sm text-gray-400">Active Staff</div>
        </div>
        <div className="bg-zinc-900 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-400">{roles.length}</div>
          <div className="text-sm text-gray-400">Company Roles</div>
        </div>
        <div className="bg-zinc-900 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-400">{departments.length}</div>
          <div className="text-sm text-gray-400">Departments</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search staff, roles, departments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      <div className="bg-zinc-900 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-800">
            <tr>
              <th className="px-4 py-3 text-left">Staff Member</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Department</th>
              <th className="px-4 py-3 text-left">Pay Model</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Hire Date</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map((member) => (
              <tr key={member.id} className="border-t border-zinc-700">
                <td className="px-4 py-3">{member.user?.username || 'Unknown'}</td>
                <td className="px-4 py-3">{member.company_role?.name || 'Unknown'}</td>
                <td className="px-4 py-3">{member.department?.name || 'Unknown'}</td>
                <td className="px-4 py-3">{member.pay_model?.name || 'Unknown'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    member.employment_status === 'active' ? 'bg-green-600' :
                    member.employment_status === 'terminated' ? 'bg-red-600' : 'bg-gray-600'
                  }`}>
                    {member.employment_status}
                  </span>
                </td>
                <td className="px-4 py-3">{new Date(member.hire_date).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="p-1 bg-blue-600 hover:bg-blue-700 rounded" title="Edit">
                      <Edit className="w-3 h-3" />
                    </button>
                    {member.employment_status === 'active' && (
                      <button
                        onClick={() => terminateStaff(member.id)}
                        className="p-1 bg-red-600 hover:bg-red-700 rounded"
                        title="Terminate"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <HireStaffModal
        isOpen={showHireModal}
        onClose={() => setShowHireModal(false)}
        onHire={loadData}
      />
    </div>
  );
}

// Department Modal Component
function DepartmentModal({ isOpen, onClose, onSave, department }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  department?: Department;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    budget_allocation: '',
    manager_id: ''
  });
  const [managers, setManagers] = useState<{ id: string; user: { username: string } }[]>([]);
  const [loading, setLoading] = useState(false);

  const loadManagers = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('staff')
        .select(`
          id,
          user:user_profiles(username)
        `)
        .eq('employment_status', 'active');

      // @ts-expect-error Supabase select typed as unknown[]
      setManagers(data || []);
    } catch (error) {
      console.error('Error loading managers:', error);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadManagers();
      if (department) {
        setFormData({
          name: department.name || '',
          description: department.description || '',
          budget_allocation: department.budget_allocation?.toString() || '',
          manager_id: department.manager_id || ''
        });
      } else {
        setFormData({
          name: '',
          description: '',
          budget_allocation: '',
          manager_id: ''
        });
      }
    }
  }, [isOpen, department, loadManagers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        name: formData.name,
        description: formData.description,
        budget_allocation: parseFloat(formData.budget_allocation) || 0,
        manager_id: formData.manager_id || null
      };

      if (department) {
        const { error } = await supabase
          .from('departments')
          .update(data)
          .eq('id', department.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('departments')
          .insert([data]);

        if (error) throw error;
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving department:', error);
      alert('Error saving department. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">{department ? 'Edit Department' : 'Add New Department'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Department Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Budget Allocation ($)</label>
            <input
              type="number"
              step="0.01"
              value={formData.budget_allocation}
              onChange={(e) => setFormData({ ...formData, budget_allocation: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Department Manager</label>
            <select
              value={formData.manager_id}
              onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Manager (Optional)</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.user?.username || 'Unknown'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Saving...' : (department ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TeamsDepartmentsTab() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);

  const loadDepartments = useCallback(async () => {
    try {
      setLoading(true);
      // Load departments with manager info
      const { data: deptData } = await supabase
        .from('departments')
        .select(`
          *,
          manager:staff(user:user_profiles(username))
        `);

      // Load staff counts separately
      const { data: staffCounts } = await supabase
        .from('staff')
        .select('department_id')
        .eq('employment_status', 'active');

      // Count staff per department
      const counts: { [key: string]: number } = {};
      staffCounts?.forEach(staff => {
        counts[staff.department_id] = (counts[staff.department_id] || 0) + 1;
      });

      // Combine data
      const departmentsWithCounts = deptData?.map(dept => ({
        ...dept,
        staff_count: counts[dept.id] || 0
      })) || [];

      setDepartments(departmentsWithCounts);
    } catch (error) {
      console.error('Error loading departments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingDepartment(null);
    setShowModal(true);
  };

  const handleDelete = async (departmentId: string) => {
    if (!confirm('Are you sure you want to delete this department? This action cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', departmentId);

      if (error) throw error;
      await loadDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
      alert('Error deleting department. Please try again.');
    }
  };

  if (loading) {
    return <div className="animate-pulse">Loading departments...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Teams & Departments</h2>
        <button
          onClick={handleAdd}
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Department
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept) => (
          <div key={dept.id} className="bg-zinc-900 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{dept.name}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(dept)}
                  className="p-1 bg-blue-600 hover:bg-blue-700 rounded"
                  title="Edit"
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDelete(dept.id)}
                  className="p-1 bg-red-600 hover:bg-red-700 rounded"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4">{dept.description}</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Budget:</span>
                <span className="text-green-400">${dept.budget_allocation || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Manager:</span>
                <span>{dept.manager?.user?.username || 'Not assigned'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Staff Count:</span>
                <span>{dept.staff_count || 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <DepartmentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={loadDepartments}
        department={editingDepartment || undefined}
      />
    </div>
  );
}

// Pay Model Modal Component
function PayModelModal({ isOpen, onClose, onSave, payModel }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  payModel?: PayModel;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    model_type: 'percentage',
    percentage: '',
    base_amount: '',
    bonus_structure: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (payModel) {
        setFormData({
          name: payModel.name || '',
          description: payModel.description || '',
          model_type: payModel.model_type || 'percentage',
          percentage: payModel.percentage?.toString() || '',
          base_amount: payModel.base_amount?.toString() || '',
          bonus_structure: payModel.bonus_structure || ''
        });
      } else {
        setFormData({
          name: '',
          description: '',
          model_type: 'percentage',
          percentage: '',
          base_amount: '',
          bonus_structure: ''
        });
      }
    }
  }, [isOpen, payModel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        name: formData.name,
        description: formData.description,
        model_type: formData.model_type,
        percentage: formData.percentage ? parseFloat(formData.percentage) : null,
        base_amount: formData.base_amount ? parseFloat(formData.base_amount) : null,
        bonus_structure: formData.bonus_structure
      };

      if (payModel) {
        const { error } = await supabase
          .from('pay_models')
          .update(data)
          .eq('id', payModel.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pay_models')
          .insert([data]);

        if (error) throw error;
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving pay model:', error);
      alert('Error saving pay model. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">{payModel ? 'Edit Pay Model' : 'Add New Pay Model'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Model Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Model Type</label>
            <select
              value={formData.model_type}
              onChange={(e) => setFormData({ ...formData, model_type: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>

          {(formData.model_type === 'percentage' || formData.model_type === 'hybrid') && (
            <div>
              <label className="block text-sm font-medium mb-2">Percentage (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.percentage}
                onChange={(e) => setFormData({ ...formData, percentage: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {(formData.model_type === 'fixed' || formData.model_type === 'hybrid') && (
            <div>
              <label className="block text-sm font-medium mb-2">Base Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.base_amount}
                onChange={(e) => setFormData({ ...formData, base_amount: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Bonus Structure</label>
            <textarea
              value={formData.bonus_structure}
              onChange={(e) => setFormData({ ...formData, bonus_structure: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe bonus conditions..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Saving...' : (payModel ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Revenue Source Modal Component
function RevenueSourceModal({ isOpen, onClose, onSave, revenueSource }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  revenueSource?: RevenueSource;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'subscription',
    estimated_monthly: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (revenueSource) {
        setFormData({
          name: revenueSource.name || '',
          description: revenueSource.description || '',
          category: revenueSource.category || 'subscription',
          estimated_monthly: revenueSource.estimated_monthly?.toString() || ''
        });
      } else {
        setFormData({
          name: '',
          description: '',
          category: 'subscription',
          estimated_monthly: ''
        });
      }
    }
  }, [isOpen, revenueSource]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        estimated_monthly: parseFloat(formData.estimated_monthly) || 0
      };

      if (revenueSource) {
        const { error } = await supabase
          .from('revenue_sources')
          .update(data)
          .eq('id', revenueSource.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('revenue_sources')
          .insert([data]);

        if (error) throw error;
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving revenue source:', error);
      alert('Error saving revenue source. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">{revenueSource ? 'Edit Revenue Source' : 'Add New Revenue Source'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Source Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="subscription">Subscription</option>
              <option value="transaction">Transaction Fees</option>
              <option value="advertising">Advertising</option>
              <option value="premium">Premium Features</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Estimated Monthly Revenue ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.estimated_monthly}
              onChange={(e) => setFormData({ ...formData, estimated_monthly: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Saving...' : (revenueSource ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RevenueShareTab() {
  const [payModels, setPayModels] = useState<PayModel[]>([]);
  const [revenueSources, setRevenueSources] = useState<RevenueSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayModelModal, setShowPayModelModal] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [editingPayModel, setEditingPayModel] = useState<PayModel | null>(null);
  const [editingRevenueSource, setEditingRevenueSource] = useState<RevenueSource | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: models } = await supabase.from('pay_models').select('*');
      const { data: sources } = await supabase.from('revenue_sources').select('*');

      setPayModels(models || []);
      setRevenueSources(sources || []);
    } catch (error) {
      console.error('Error loading revenue data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEditPayModel = (model: PayModel) => {
    setEditingPayModel(model);
    setShowPayModelModal(true);
  };

  const handleEditRevenueSource = (source: RevenueSource) => {
    setEditingRevenueSource(source);
    setShowRevenueModal(true);
  };

  const handleDeletePayModel = async (modelId: string) => {
    if (!confirm('Are you sure you want to delete this pay model?')) return;

    try {
      const { error } = await supabase
        .from('pay_models')
        .delete()
        .eq('id', modelId);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error deleting pay model:', error);
      alert('Error deleting pay model. Please try again.');
    }
  };

  const handleDeleteRevenueSource = async (sourceId: string) => {
    if (!confirm('Are you sure you want to delete this revenue source?')) return;

    try {
      const { error } = await supabase
        .from('revenue_sources')
        .delete()
        .eq('id', sourceId);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error deleting revenue source:', error);
      alert('Error deleting revenue source. Please try again.');
    }
  };

  const calculateEarnings = async () => {
    try {
      const { error } = await supabase.rpc('calculate_staff_earnings', {
        p_period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        p_period_end: new Date().toISOString()
      });

      if (error) throw error;
      alert('Earnings calculated successfully!');
      await loadData();
    } catch (error) {
      console.error('Error calculating earnings:', error);
      alert('Error calculating earnings. Please try again.');
    }
  };

  if (loading) {
    return <div className="animate-pulse">Loading revenue data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Revenue Sharing</h2>
        <div className="flex gap-3">
          <button
            onClick={calculateEarnings}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <DollarSign className="w-4 h-4" />
            Calculate Earnings
          </button>
          <button
            onClick={() => setShowPayModelModal(true)}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Pay Model
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Pay Models</h3>
            <button
              onClick={() => setShowRevenueModal(true)}
              className="text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded"
            >
              Add Revenue Source
            </button>
          </div>
          <div className="space-y-3">
            {payModels.map((model) => (
              <div key={model.id} className="bg-zinc-900 p-4 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold">{model.name}</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditPayModel(model)}
                      className="p-1 bg-blue-600 hover:bg-blue-700 rounded"
                      title="Edit"
                    >
                      <Edit className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeletePayModel(model.id)}
                      className="p-1 bg-red-600 hover:bg-red-700 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mb-2">{model.description}</p>
                <div className="flex justify-between items-center">
                  <span className={`px-2 py-1 rounded text-xs ${
                    model.model_type === 'percentage' ? 'bg-blue-600' :
                    model.model_type === 'fixed' ? 'bg-green-600' : 'bg-purple-600'
                  }`}>
                    {model.model_type}
                  </span>
                  <div className="text-right text-sm">
                    {model.percentage && (
                      <div className="text-green-400">{model.percentage}% of revenue</div>
                    )}
                    {model.base_amount && (
                      <div className="text-blue-400">${model.base_amount}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Revenue Sources</h3>
          <div className="space-y-3">
            {revenueSources.map((source) => (
              <div key={source.id} className="bg-zinc-900 p-4 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold">{source.name}</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditRevenueSource(source)}
                      className="p-1 bg-blue-600 hover:bg-blue-700 rounded"
                      title="Edit"
                    >
                      <Edit className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteRevenueSource(source.id)}
                      className="p-1 bg-red-600 hover:bg-red-700 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mb-2">{source.description}</p>
                <div className="flex justify-between items-center text-sm">
                  <span className="px-2 py-1 bg-gray-600 rounded text-xs capitalize">
                    {source.category}
                  </span>
                  <span className="text-green-400">
                    Est. ${source.estimated_monthly || 0}/month
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <PayModelModal
        isOpen={showPayModelModal}
        onClose={() => { setShowPayModelModal(false); setEditingPayModel(null); }}
        onSave={loadData}
        payModel={editingPayModel}
      />

      <RevenueSourceModal
        isOpen={showRevenueModal}
        onClose={() => { setShowRevenueModal(false); setEditingRevenueSource(null); }}
        onSave={loadData}
        revenueSource={editingRevenueSource}
      />
    </div>
  );
}

// Invoice Details Modal Component
function InvoiceDetailsModal({ isOpen, onClose, invoice }: {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}) {
  if (!isOpen || !invoice) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">Invoice Details</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400">Staff Member</label>
              <div className="text-white">{invoice.staff?.user?.username || 'Unknown'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">Status</label>
              <span className={`px-2 py-1 rounded-full text-xs ${
                invoice.status === 'pending' ? 'bg-yellow-600' :
                invoice.status === 'approved' ? 'bg-blue-600' :
                invoice.status === 'paid' ? 'bg-green-600' :
                invoice.status === 'rejected' ? 'bg-red-600' : 'bg-gray-600'
              }`}>
                {invoice.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400">Period Start</label>
              <div className="text-white">{new Date(invoice.period_start).toLocaleDateString()}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">Period End</label>
              <div className="text-white">{new Date(invoice.period_end).toLocaleDateString()}</div>
            </div>
          </div>

          <div className="bg-zinc-800 p-4 rounded-lg">
            <h4 className="font-semibold mb-3">Payment Breakdown</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Gross Earnings:</span>
                <span>${invoice.gross_amount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Deductions:</span>
                <span>-${invoice.deductions || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxes:</span>
                <span>-${invoice.taxes || 0}</span>
              </div>
              <hr className="border-zinc-600" />
              <div className="flex justify-between font-semibold text-green-400">
                <span>Net Amount:</span>
                <span>${invoice.net_amount || 0}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Notes</label>
              <div className="bg-zinc-800 p-3 rounded-lg text-white">{invoice.notes}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400">Created</label>
              <div className="text-white text-sm">{new Date(invoice.created_at).toLocaleString()}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">Last Updated</label>
              <div className="text-white text-sm">{new Date(invoice.updated_at).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoicesPayoutsTab() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('invoices')
        .select(`
          *,
          staff:staff(
            user:user_profiles(username)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      setInvoices(data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const generateInvoices = async () => {
    try {
      const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const periodEnd = new Date();

      const { error } = await supabase.rpc('generate_staff_invoices', {
        p_period_start: periodStart.toISOString(),
        p_period_end: periodEnd.toISOString()
      });

      if (error) throw error;
      alert('Invoices generated successfully!');
      await loadInvoices();
    } catch (error) {
      console.error('Error generating invoices:', error);
      alert('Error generating invoices. Please try again.');
    }
  };

  const updateInvoiceStatus = async (invoiceId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', invoiceId);

      if (error) throw error;
      await loadInvoices();
    } catch (error) {
      console.error('Error updating invoice:', error);
      alert('Error updating invoice. Please try again.');
    }
  };

  const processPayout = async (invoiceId: string) => {
    try {
      // This would integrate with Gift Card API
      alert('Gift Card payout integration would be implemented here');
      await updateInvoiceStatus(invoiceId, 'paid');
    } catch (error) {
      console.error('Error processing payout:', error);
      alert('Error processing payout. Please try again.');
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.staff?.user?.username?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPending = invoices.filter(i => i.status === 'pending').length;
  const totalApproved = invoices.filter(i => i.status === 'approved').length;
  const totalPaid = invoices.filter(i => i.status === 'paid').length;
  const totalRejected = invoices.filter(i => i.status === 'rejected').length;

  if (loading) {
    return <div className="animate-pulse">Loading invoices...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Invoices & Payouts</h2>
        <button
          onClick={generateInvoices}
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Generate Invoices
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-400">{totalPending}</div>
          <div className="text-sm text-gray-400">Pending Approval</div>
        </div>
        <div className="bg-zinc-900 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-400">{totalApproved}</div>
          <div className="text-sm text-gray-400">Approved</div>
        </div>
        <div className="bg-zinc-900 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-400">{totalPaid}</div>
          <div className="text-sm text-gray-400">Paid</div>
        </div>
        <div className="bg-zinc-900 p-4 rounded-lg">
          <div className="text-2xl font-bold text-red-400">{totalRejected}</div>
          <div className="text-sm text-gray-400">Rejected</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by staff member..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="bg-zinc-900 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-800">
            <tr>
              <th className="px-4 py-3 text-left">Staff Member</th>
              <th className="px-4 py-3 text-left">Period</th>
              <th className="px-4 py-3 text-left">Gross</th>
              <th className="px-4 py-3 text-left">Net Amount</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((invoice) => (
              <tr key={invoice.id} className="border-t border-zinc-700">
                <td className="px-4 py-3">{invoice.staff?.user?.username || 'Unknown'}</td>
                <td className="px-4 py-3 text-sm">
                  {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">${invoice.gross_amount || 0}</td>
                <td className="px-4 py-3 font-semibold text-green-400">${invoice.net_amount || 0}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    invoice.status === 'pending' ? 'bg-yellow-600' :
                    invoice.status === 'approved' ? 'bg-blue-600' :
                    invoice.status === 'paid' ? 'bg-green-600' :
                    invoice.status === 'rejected' ? 'bg-red-600' : 'bg-gray-600'
                  }`}>
                    {invoice.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setShowDetailsModal(true);
                      }}
                      className="p-1 bg-gray-600 hover:bg-gray-700 rounded"
                      title="View Details"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                    {invoice.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateInvoiceStatus(invoice.id, 'approved')}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateInvoiceStatus(invoice.id, 'rejected')}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {invoice.status === 'approved' && (
                      <button
                        onClick={() => processPayout(invoice.id)}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                      >
                        Process Payout
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InvoiceDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        invoice={selectedInvoice}
      />
    </div>
  );
}

interface AuditLog {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  user?: User;
  details?: any;
  description?: string;
  ip_address?: string;
  created_at: string;
}

function AuditLogTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    actionType: 'all',
    entityType: 'all',
    userSearch: '',
    dateFrom: '',
    dateTo: ''
  });

  const loadAuditLog = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('audit_log')
        .select(`
          *,
          user:user_profiles(username)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      // Apply filters
      if (filters.actionType !== 'all') {
        query = query.eq('action_type', filters.actionType);
      }
      if (filters.entityType !== 'all') {
        query = query.eq('entity_type', filters.entityType);
      }
      if (filters.userSearch) {
        query = query.ilike('user.username', `%${filters.userSearch}%`);
      }
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo + 'T23:59:59');
      }

      const { data } = await query;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading audit log:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadAuditLog();
  }, [loadAuditLog]);

  const getActionTypeColor = (actionType: string) => {
    switch (actionType.toLowerCase()) {
      case 'create': return 'bg-green-600';
      case 'update': return 'bg-blue-600';
      case 'delete': return 'bg-red-600';
      case 'login': return 'bg-purple-600';
      case 'logout': return 'bg-gray-600';
      default: return 'bg-yellow-600';
    }
  };

  const getEntityTypeColor = (entityType: string) => {
    switch (entityType.toLowerCase()) {
      case 'user': return 'bg-blue-700';
      case 'staff': return 'bg-green-700';
      case 'invoice': return 'bg-yellow-700';
      case 'department': return 'bg-purple-700';
      case 'pay_model': return 'bg-pink-700';
      default: return 'bg-gray-700';
    }
  };

  // Get unique values for filter dropdowns
  const actionTypes = [...new Set(logs.map(log => log.action_type))];
  const entityTypes = [...new Set(logs.map(log => log.entity_type))];

  if (loading) {
    return <div className="animate-pulse">Loading audit log...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Audit Log</h2>
        <button
          onClick={() => setFilters({
            actionType: 'all',
            entityType: 'all',
            userSearch: '',
            dateFrom: '',
            dateTo: ''
          })}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm"
        >
          Clear Filters
        </button>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900 p-4 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Action Type</label>
            <select
              value={filters.actionType}
              onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Actions</option>
              {actionTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Entity Type</label>
            <select
              value={filters.entityType}
              onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Entities</option>
              {entityTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">User Search</label>
            <input
              type="text"
              placeholder="Search by username..."
              value={filters.userSearch}
              onChange={(e) => setFilters({ ...filters, userSearch: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">From Date</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">To Date</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-800">
            <tr>
              <th className="px-4 py-3 text-left">Timestamp</th>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Entity</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">IP Address</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-zinc-700 hover:bg-zinc-800">
                <td className="px-4 py-3 text-sm">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">{log.user?.username || 'System'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${getActionTypeColor(log.action_type)}`}>
                    {log.action_type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${getEntityTypeColor(log.entity_type)}`}>
                    {log.entity_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm max-w-xs truncate" title={log.description}>
                  {log.description}
                </td>
                <td className="px-4 py-3 text-sm font-mono">
                  {log.ip_address || 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {logs.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No audit log entries found matching the current filters.
        </div>
      )}
    </div>
  );
}

// Main Admin HQ Component
export default function AdminHQ() {
  const [activeTab, setActiveTab] = useState('staff');

  const tabs = [
    { id: 'staff', name: 'Staff & Roles', icon: <Users className="w-5 h-5" />, component: StaffRolesTab },
    { id: 'teams', name: 'Teams / Departments', icon: <Briefcase className="w-5 h-5" />, component: TeamsDepartmentsTab },
    { id: 'revenue', name: 'Revenue Share', icon: <DollarSign className="w-5 h-5" />, component: RevenueShareTab },
    { id: 'invoices', name: 'Invoices & Payouts', icon: <FileText className="w-5 h-5" />, component: InvoicesPayoutsTab },
    { id: 'audit', name: 'Audit Log', icon: <Activity className="w-5 h-5" />, component: AuditLogTab },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || StaffRolesTab;

  return (
    <RequireRole roles={UserRole.ADMIN}>
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6 pt-16 lg:pt-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
            <div className="flex items-center gap-4">
              <Building2 className="w-8 h-8 text-purple-400" />
              <div>
                <h1 className="text-3xl font-bold">Admin HQ</h1>
                <p className="text-gray-400">Company Operations & Staff Management</p>
              </div>
            </div>
            
            <Link 
              to="/admin/cashout-manager"
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-4 py-2 rounded-lg font-semibold transition-colors shadow-lg shadow-purple-900/20"
            >
              <Gift className="w-5 h-5" />
              Manage User Cashouts
            </Link>
          </div>

          {/* Broadcast Lockdown Control */}
          <div className="mb-6">
            <BroadcastLockdownControl />
          </div>

          {/* Tabs */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-zinc-900 p-1 rounded-lg">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {tab.icon}
                  {tab.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-zinc-900/50 rounded-lg p-6">
            <ActiveComponent />
          </div>
        </div>
      </div>
    </RequireRole>
  );
}
