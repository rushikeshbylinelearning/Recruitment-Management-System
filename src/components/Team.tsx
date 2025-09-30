import { useState, useEffect } from 'react';
import { Plus, Search, MoreVertical, Mail, CheckCircle, Clock, AlertCircle, X, Save, Edit } from 'lucide-react';
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

  // Load users and tasks from backend
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

  // Helper functions to calculate task statistics
  const getActiveTasksForMember = (memberId: number) => {
    return tasks.filter(task => 
      task.assignedTo === memberId && 
      (task.status === 'Pending' || task.status === 'In Progress')
    ).length;
  };

  const getCompletedTasksForMember = (memberId: number) => {
    return tasks.filter(task => 
      task.assignedTo === memberId && 
      task.status === 'Completed'
    ).length;
  };

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

  const filteredTeam = team?.filter((member) => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'All' || member.role === roleFilter;
    return matchesSearch && matchesRole;
  }) || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active': return <CheckCircle size={16} className="text-green-500" />;
      case 'Away': return <Clock size={16} className="text-yellow-500" />;
      case 'Busy': return <AlertCircle size={16} className="text-red-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Away': return 'bg-yellow-100 text-yellow-800';
      case 'Busy': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Define available roles based on current user's permissions
  const getAvailableRoles = () => {
    if (user?.role === 'Admin' || user?.role === 'HR Manager') {
      return ['Admin', 'HR Manager', 'Recruiter', 'Interviewer'];
    } else if (user?.role === 'Recruiter') {
      return ['Interviewer']; // Recruiters can only create Interviewers
    }
    return ['Interviewer']; // Default fallback
  };
  
  const roles = getAvailableRoles();
  const statuses = ['Active', 'Away', 'Busy'];

  const handleAddMember = () => {
    setMemberFormData({
      name: '',
      email: '',
      username: '',
      password: '',
      role: user?.role === 'Recruiter' ? 'Interviewer' : 'Recruiter',
      status: 'Active'
    });
    setErrors({});
    setShowAddMemberModal(true);
  };

  const handleEditMember = (member: User) => {
    setEditingMember(member as any); // Type assertion for compatibility
    setMemberFormData({
      name: member.name,
      email: member.email,
      username: member.username,
      password: '', // Don't show password in edit form
      role: member.role,
      status: member.status
    });
    setErrors({});
    setShowEditMemberModal(true);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!memberFormData.name.trim()) newErrors.name = 'Name is required';
    if (!memberFormData.email.trim()) newErrors.email = 'Email is required';
    if (!memberFormData.username.trim()) newErrors.username = 'Username is required';
    // Only require password when adding new member (not editing)
    if (!editingMember && !memberFormData.password.trim()) newErrors.password = 'Password is required';

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (memberFormData.email && !emailRegex.test(memberFormData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitMember = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      
      if (editingMember) {
        // Update existing member
        const updateData: any = {
          name: memberFormData.name,
          email: memberFormData.email,
          username: memberFormData.username,
          role: memberFormData.role,
          avatar: '',
          status: memberFormData.status
        };
        
        // Only include password if it's provided
        if (memberFormData.password.trim()) {
          updateData.password = memberFormData.password;
        }
        
        const response = await usersAPI.updateUser(editingMember.id, updateData);
        if (response.success) {
          // Clear any previous errors
          setError('');
          // Reload users to get updated data
          const usersResponse = await usersAPI.getUsers();
          if (usersResponse.success && usersResponse.data) {
            setTeam(usersResponse.data.users);
          }
        } else {
          setError('Failed to update team member');
        }
      } else {
        // Add new member - we'll use the auth register endpoint
        const registerData = {
          name: memberFormData.name,
          email: memberFormData.email,
          username: memberFormData.username,
          password: memberFormData.password,
          role: memberFormData.role.toLowerCase()
        };
        
        const response = await fetch('http://localhost:3001/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify(registerData)
        });
        
        const result = await response.json();
        if (result.success) {
          // Clear any previous errors
          setError('');
          // Reload users to get updated data
          const usersResponse = await usersAPI.getUsers();
          if (usersResponse.success && usersResponse.data) {
            setTeam(usersResponse.data.users);
          }
        } else {
          setError('Failed to add team member');
        }
      }
      
      setShowAddMemberModal(false);
      setShowEditMemberModal(false);
      setEditingMember(null);
      setMemberFormData({
        name: '',
        email: '',
        username: '',
        password: '',
        role: user?.role === 'Recruiter' ? 'Interviewer' : 'Recruiter',
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-600 mt-1">Manage your hiring team members and their performance</p>
        </div>
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

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading team members...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      {!loading && (
        <>
          <div className="flex space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search team members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="All">All Roles</option>
          <option value="Recruiter">Recruiter</option>
          <option value="HR Manager">HR Manager</option>
          <option value="Admin">Admin</option>
        </select>
      </div>

      {/* Team Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredTeam.map((member) => (
          <div key={member.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{member.name}</h3>
                  <p className="text-sm text-gray-600">{member.role}</p>
                </div>
              </div>
              <div className="flex space-x-1">
                {hasPermission('team', 'edit') && (user?.role === 'Admin' || user?.role === 'HR Manager' || member.role === 'Interviewer') && (
                  <button
                    onClick={() => handleEditMember(member)}
                    className="text-gray-400 hover:text-blue-600 p-1"
                    title="Edit member"
                  >
                    <Edit size={16} />
                  </button>
                )}
                {hasPermission('team', 'delete') && member.id !== user?.id && (user?.role === 'Admin' || user?.role === 'HR Manager' || member.role === 'Interviewer') && (
                  <button 
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this team member?')) {
                        // Handle delete logic here
                        console.log('Delete member:', member.id);
                      }
                    }}
                    className="text-gray-400 hover:text-red-600 p-1"
                    title="Delete member"
                  >
                    <MoreVertical size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center space-x-2">
                <Mail size={16} className="text-gray-400" />
                <span className="text-sm text-gray-600 truncate">{member.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(member.status)}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(member.status)}`}>
                    {member.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{getActiveTasksForMember(member.id)}</p>
                  <p className="text-xs text-gray-600">Active Tasks</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{getCompletedTasksForMember(member.id)}</p>
                  <p className="text-xs text-gray-600">Tasks Completed</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Team Performance Overview */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Performance Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{team?.length || 0}</p>
            <p className="text-sm text-gray-600">Total Members</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {team?.filter(m => m.status === 'Active').length || 0}
            </p>
            <p className="text-sm text-gray-600">Active Now</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">
              {tasks.filter(task => task.status === 'Completed').length}
            </p>
            <p className="text-sm text-gray-600">Tasks Completed</p>
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add New Team Member</h2>
              <button
                onClick={() => setShowAddMemberModal(false)}
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
                    onChange={(e) => setMemberFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter full name"
                  />
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={memberFormData.email}
                    onChange={(e) => setMemberFormData(prev => ({ ...prev, email: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.email ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="member@company.com"
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={memberFormData.username}
                    onChange={(e) => setMemberFormData(prev => ({ ...prev, username: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.username ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="username"
                  />
                  {errors.username && <p className="text-red-500 text-sm mt-1">{errors.username}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={memberFormData.password}
                    onChange={(e) => setMemberFormData(prev => ({ ...prev, password: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.password ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter password"
                  />
                  {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    value={memberFormData.role}
                    onChange={(e) => setMemberFormData(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={memberFormData.status}
                    onChange={(e) => setMemberFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {statuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitMember}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Save size={16} />
                <span>Add Member</span>
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
                onClick={() => setShowEditMemberModal(false)}
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
                    onChange={(e) => setMemberFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter full name"
                  />
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={memberFormData.email}
                    onChange={(e) => setMemberFormData(prev => ({ ...prev, email: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.email ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="member@company.com"
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={memberFormData.username}
                    onChange={(e) => setMemberFormData(prev => ({ ...prev, username: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.username ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="username"
                  />
                  {errors.username && <p className="text-red-500 text-sm mt-1">{errors.username}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={memberFormData.password}
                    onChange={(e) => setMemberFormData(prev => ({ ...prev, password: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.password ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter password"
                  />
                  {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    value={memberFormData.role}
                    onChange={(e) => setMemberFormData(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={memberFormData.status}
                    onChange={(e) => setMemberFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {statuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Current Statistics</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-blue-700">Active Tasks</p>
                    <p className="font-semibold text-blue-900">{editingMember ? getActiveTasksForMember(editingMember.id) : 0}</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Tasks Completed</p>
                    <p className="font-semibold text-blue-900">{editingMember ? getCompletedTasksForMember(editingMember.id) : 0}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowEditMemberModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              {hasPermission('team', 'delete') && editingMember?.id !== user?.id && (user?.role === 'Admin' || user?.role === 'HR Manager' || editingMember?.role === 'Interviewer') && (
                <button
                  onClick={async () => {
                    if (confirm(`Are you sure you want to delete ${editingMember?.name}?`)) {
                      try {
                        setLoading(true);
                        const response = await usersAPI.deleteUser(editingMember!.id);
                        if (response.success) {
                          // Clear any previous errors
                          setError('');
                          // Reload users to get updated data
                          const usersResponse = await usersAPI.getUsers();
                          if (usersResponse.success && usersResponse.data) {
                            setTeam(usersResponse.data.users);
                          }
                          setShowEditMemberModal(false);
                          setEditingMember(null);
                        } else {
                          setError('Failed to delete team member');
                        }
                      } catch (err) {
                        console.error('Error deleting member:', err);
                        setError('Failed to delete team member');
                      } finally {
                        setLoading(false);
                      }
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              )}
              {hasPermission('team', 'edit') && (user?.role === 'Admin' || user?.role === 'HR Manager' || editingMember?.role === 'Interviewer') && (
                <button
                  onClick={handleSubmitMember}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Save size={16} />
                  <span>Save Changes</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}