import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Mail,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Save,
  Edit
} from 'lucide-react';

import { TeamMember } from '../types';
import { usersAPI, User, tasksAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function Team() {
  const { hasPermission, user } = useAuth();

  const [team, setTeam] = useState<User[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);

  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  const [memberFormData, setMemberFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'Recruiter',
    status: 'Active'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load users
        const usersResponse = await usersAPI.getUsers();

        if (usersResponse.success && usersResponse.data) {
          setTeam(usersResponse.data.users);
        } else {
          setError('Failed to load team members');
        }

        // Load tasks
        const tasksResponse = await tasksAPI.getTasks();

        if (tasksResponse.success && tasksResponse.data) {
          setTasks(tasksResponse.data.tasks || []);
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load team data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Task statistics
  const getActiveTasksForMember = (memberId: number) => {
    return tasks.filter(
      (task) =>
        task.assignedTo === memberId &&
        (task.status === 'Pending' || task.status === 'In Progress')
    ).length;
  };

  const getCompletedTasksForMember = (memberId: number) => {
    return tasks.filter(
      (task) =>
        task.assignedTo === memberId &&
        task.status === 'Completed'
    ).length;
  };

  // Filtered team
  const filteredTeam =
    team?.filter((member) => {
      const matchesSearch =
        (member.name || '')
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (member.email || '')
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesRole =
        roleFilter === 'All' || member.role === roleFilter;

      return matchesSearch && matchesRole;
    }) || [];

  // Status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active':
        return (
          <CheckCircle
            size={16}
            className="text-green-500"
          />
        );

      case 'Away':
        return (
          <Clock
            size={16}
            className="text-yellow-500"
          />
        );

      case 'Busy':
        return (
          <AlertCircle
            size={16}
            className="text-red-500"
          />
        );

      default:
        return null;
    }
  };

  // Status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800';

      case 'Away':
        return 'bg-yellow-100 text-yellow-800';

      case 'Busy':
        return 'bg-red-100 text-red-800';

      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Roles
  const getAvailableRoles = () => {
    if (user?.role === 'Admin') {
      return [
        'Admin',
        'Recruiter',
        'Interviewer',
        'HR Intern'
      ];
    } else if (user?.role === 'Recruiter') {
      return ['Interviewer'];
    }

    return ['Interviewer'];
  };

  const roles = getAvailableRoles();

  const statuses = ['Active', 'Away', 'Busy'];

  // Add member
  const handleAddMember = () => {
    setMemberFormData({
      name: '',
      email: '',
      username: '',
      password: '',
      role:
        user?.role === 'Recruiter'
          ? 'Interviewer'
          : 'Recruiter',
      status: 'Active'
    });

    setErrors({});
    setShowAddMemberModal(true);
  };

  // Edit member
  const handleEditMember = (member: User) => {
    setEditingMember(member as any);

    setMemberFormData({
      name: member.name,
      email: member.email,
      username: member.username,
      password: '',
      role: member.role,
      status: member.status
    });

    setErrors({});
    setShowEditMemberModal(true);
  };

  // Validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!memberFormData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!memberFormData.email.trim()) {
      newErrors.email = 'Email is required';
    }

    if (!memberFormData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (
      !editingMember &&
      !memberFormData.password.trim()
    ) {
      newErrors.password = 'Password is required';
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      memberFormData.email &&
      !emailRegex.test(memberFormData.email)
    ) {
      newErrors.email =
        'Please enter a valid email address';
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // Submit member
  const handleSubmitMember = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      // Edit existing member
      if (editingMember) {
        const updateData: Partial<User> & {
          password?: string;
        } = {
          name: memberFormData.name,
          email: memberFormData.email,
          username: memberFormData.username,
          role: memberFormData.role as User['role'],
          avatar: editingMember.avatar || null,
          status: memberFormData.status as User['status']
        };

        const trimmedPassword =
          memberFormData.password.trim();

        if (trimmedPassword) {
          updateData.password = trimmedPassword;
        }

        const response =
          await usersAPI.updateUser(
            editingMember.id,
            updateData
          );

        if (response.success) {
          setError('');

          const usersResponse =
            await usersAPI.getUsers();

          if (
            usersResponse.success &&
            usersResponse.data
          ) {
            setTeam(usersResponse.data.users);
          }
        } else {
          setError('Failed to update team member');
        }
      }

      // Add new member
      else {
        const createData = {
          name: memberFormData.name,
          email: memberFormData.email,
          username: memberFormData.username,
          password: memberFormData.password,
          role: memberFormData.role,
          status: memberFormData.status
        };

        const result = await usersAPI.createUser(createData);

        if (result.success) {
          setError('');

          const usersResponse =
            await usersAPI.getUsers();

          if (
            usersResponse.success &&
            usersResponse.data
          ) {
            setTeam(usersResponse.data.users);
          }
        } else {
          setError('Failed to add team member');
        }
      }

      // Reset state
      setShowAddMemberModal(false);
      setShowEditMemberModal(false);

      setEditingMember(null);

      setMemberFormData({
        name: '',
        email: '',
        username: '',
        password: '',
        role:
          user?.role === 'Recruiter'
            ? 'Interviewer'
            : 'Recruiter',
        status: 'Active'
      });

      setErrors({});
    } catch (err) {
      console.error('Error submitting member:', err);
      setError('Failed to save team member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-end items-center">
        <div>
          {hasPermission('team', 'create') && (
            <button
              onClick={handleAddMember}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              <span>Add Member</span>
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>

          <span className="ml-2 text-gray-600">
            Loading team members...
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Main Content */}
      {!loading && (
        <>
          {/* Filters */}
          <div className="flex space-x-4">
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />

              <input
                type="text"
                placeholder="Search team members..."
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(e.target.value)
                }
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(e.target.value)
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="All">
                All Roles
              </option>

              <option value="Recruiter">
                Recruiter
              </option>

              <option value="HR Intern">
                HR Intern
              </option>

              <option value="Admin">
                Admin
              </option>
            </select>
          </div>

          {/* Team Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

            {filteredTeam.map((member) => (
              <div
                key={member.id}
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
              >

                {/* CARD CONTENT HERE */}

                <div className="flex items-center justify-between mb-4">

                  <div className="flex items-center space-x-3">

                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium">
                        {member.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {member.name}
                      </h3>

                      <p className="text-sm text-gray-600">
                        {member.role}
                      </p>
                    </div>
                  </div>

                  <div className="flex space-x-1">

                    {hasPermission('team', 'edit') && (
                      <button
                        onClick={() =>
                          handleEditMember(member)
                        }
                        className="text-gray-400 hover:text-blue-600 p-1"
                      >
                        <Edit size={16} />
                      </button>
                    )}

                  </div>
                </div>

                <div className="space-y-3 mb-4">

                  <div className="flex items-center space-x-2">
                    <Mail
                      size={16}
                      className="text-gray-400"
                    />

                    <span className="text-sm text-gray-600 truncate">
                      {member.email}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">

                    <span className="text-sm text-gray-600">
                      Status
                    </span>

                    <div className="flex items-center space-x-2">
                      {getStatusIcon(member.status)}

                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          member.status
                        )}`}
                      >
                        {member.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">

                  <div className="grid grid-cols-2 gap-4 text-center">

                    <div>
                      <p className="text-2xl font-bold text-blue-600">
                        {getActiveTasksForMember(
                          member.id
                        )}
                      </p>

                      <p className="text-xs text-gray-600">
                        Active Tasks
                      </p>
                    </div>

                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        {getCompletedTasksForMember(
                          member.id
                        )}
                      </p>

                      <p className="text-xs text-gray-600">
                        Tasks Completed
                      </p>
                    </div>

                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add New Team Member</h2>
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setErrors({});
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={memberFormData.name}
                    onChange={(e) =>
                      setMemberFormData((prev) => ({
                        ...prev,
                        name: e.target.value
                      }))
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.name
                        ? 'border-red-300'
                        : 'border-gray-300'
                    }`}
                    placeholder="Enter full name"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={memberFormData.email}
                    onChange={(e) =>
                      setMemberFormData((prev) => ({
                        ...prev,
                        email: e.target.value
                      }))
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.email
                        ? 'border-red-300'
                        : 'border-gray-300'
                    }`}
                    placeholder="member@company.com"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={memberFormData.username}
                    onChange={(e) =>
                      setMemberFormData((prev) => ({
                        ...prev,
                        username: e.target.value
                      }))
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.username
                        ? 'border-red-300'
                        : 'border-gray-300'
                    }`}
                    placeholder="username"
                  />
                  {errors.username && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.username}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={memberFormData.password}
                    onChange={(e) =>
                      setMemberFormData((prev) => ({
                        ...prev,
                        password: e.target.value
                      }))
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.password
                        ? 'border-red-300'
                        : 'border-gray-300'
                    }`}
                    placeholder="Enter password"
                  />
                  {errors.password && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.password}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    value={memberFormData.role}
                    onChange={(e) =>
                      setMemberFormData((prev) => ({
                        ...prev,
                        role: e.target.value
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={memberFormData.status}
                    onChange={(e) =>
                      setMemberFormData((prev) => ({
                        ...prev,
                        status: e.target.value
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setErrors({});
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitMember}
                disabled={loading}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                  loading
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Save size={16} />
                <span>{loading ? 'Adding...' : 'Add Member'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {showEditMemberModal && editingMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Edit Team Member</h2>
              <button
                onClick={() => {
                  setShowEditMemberModal(false);
                  setEditingMember(null);
                  setErrors({});
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={memberFormData.name}
                    onChange={(e) =>
                      setMemberFormData((prev) => ({
                        ...prev,
                        name: e.target.value
                      }))
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.name
                        ? 'border-red-300'
                        : 'border-gray-300'
                    }`}
                    placeholder="Enter full name"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={memberFormData.email}
                    onChange={(e) =>
                      setMemberFormData((prev) => ({
                        ...prev,
                        email: e.target.value
                      }))
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.email
                        ? 'border-red-300'
                        : 'border-gray-300'
                    }`}
                    placeholder="member@company.com"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={memberFormData.username}
                    onChange={(e) =>
                      setMemberFormData((prev) => ({
                        ...prev,
                        username: e.target.value
                      }))
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.username
                        ? 'border-red-300'
                        : 'border-gray-300'
                    }`}
                    placeholder="username"
                  />
                  {errors.username && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.username}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password{' '}
                    <span className="text-gray-400 font-normal">
                      (leave blank to keep current)
                    </span>
                  </label>
                  <input
                    type="password"
                    value={memberFormData.password}
                    onChange={(e) =>
                      setMemberFormData((prev) => ({
                        ...prev,
                        password: e.target.value
                      }))
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.password
                        ? 'border-red-300'
                        : 'border-gray-300'
                    }`}
                    placeholder="Enter new password to change it"
                  />
                  {errors.password && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.password}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    value={memberFormData.role}
                    onChange={(e) =>
                      setMemberFormData((prev) => ({
                        ...prev,
                        role: e.target.value
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={memberFormData.status}
                    onChange={(e) =>
                      setMemberFormData((prev) => ({
                        ...prev,
                        status: e.target.value
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowEditMemberModal(false);
                  setEditingMember(null);
                  setErrors({});
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitMember}
                disabled={loading}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                  loading
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Save size={16} />
                <span>{loading ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}