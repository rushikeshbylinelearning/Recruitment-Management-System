import React, { useState } from 'react';
import { Save, Plus, Edit, Trash2, Users, Shield, Bell, Globe, Database, Key, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TeamMember, Permission } from '../types';
import { mockTeam } from '../data/mockData';

export default function Settings() {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('team');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEditMember, setShowEditMember] = useState(false);
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
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
  const [connectionForm, setConnectionForm] = useState({
    apiKey: '',
    username: '',
    password: '',
    clientId: '',
    clientSecret: ''
  });
  const [connectionErrors, setConnectionErrors] = useState<Record<string, string>>({});
  const [integrations, setIntegrations] = useState([
    { name: 'LinkedIn', status: 'Connected', description: 'Post jobs and source candidates' },
    { name: 'Indeed', status: 'Connected', description: 'Automatic job posting and application sync' },
    { name: 'Naukri.com', status: 'Not Connected', description: 'Access to Indian job market' },
    { name: 'Slack', status: 'Connected', description: 'Team notifications and updates' },
    { name: 'Google Calendar', status: 'Connected', description: 'Interview scheduling integration' },
    { name: 'WhatsApp Business', status: 'Not Connected', description: 'Candidate communication via WhatsApp' },
  ]);
  const [rolePermissions, setRolePermissions] = useState({
    'Admin': [
      { module: 'dashboard', actions: ['view'] },
      { module: 'jobs', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'candidates', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'communications', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'tasks', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'team', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'analytics', actions: ['view'] },
      { module: 'settings', actions: ['view', 'edit'] },
    ],
    'HR Manager': [
      { module: 'dashboard', actions: ['view'] },
      { module: 'jobs', actions: ['view', 'create', 'edit'] },
      { module: 'candidates', actions: ['view', 'create', 'edit'] },
      { module: 'communications', actions: ['view', 'create', 'edit'] },
      { module: 'tasks', actions: ['view', 'create', 'edit'] },
      { module: 'team', actions: ['view'] },
      { module: 'analytics', actions: ['view'] },
    ],
    'Team Lead': [
      { module: 'dashboard', actions: ['view'] },
      { module: 'jobs', actions: ['view', 'edit'] },
      { module: 'candidates', actions: ['view', 'edit'] },
      { module: 'communications', actions: ['view', 'create', 'edit'] },
      { module: 'tasks', actions: ['view', 'create', 'edit'] },
      { module: 'team', actions: ['view'] },
      { module: 'analytics', actions: ['view'] },
    ],
    'Recruiter': [
      { module: 'dashboard', actions: ['view'] },
      { module: 'jobs', actions: ['view'] },
      { module: 'candidates', actions: ['view', 'edit'] },
      { module: 'communications', actions: ['view', 'create'] },
      { module: 'tasks', actions: ['view', 'create', 'edit'] },
      { module: 'analytics', actions: ['view'] },
    ],
  });

  const tabs = [
    { id: 'team', label: 'Team Management', icon: Users },
    { id: 'permissions', label: 'Permissions', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'Integrations', icon: Globe },
    { id: 'system', label: 'System', icon: Database },
  ];

  const handleAddMember = () => {
    setMemberFormData({
      name: '',
      email: '',
      username: '',
      password: '',
      role: 'Recruiter',
      status: 'Active'
    });
    setErrors({});
    setShowAddMember(true);
  };

  const handleEditMember = (member: TeamMember) => {
    setEditingMember(member);
    setMemberFormData({
      name: member.name,
      email: member.email,
      username: member.username,
      password: member.password,
      role: member.role,
      status: member.status
    });
    setErrors({});
    setShowEditMember(true);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!memberFormData.name.trim()) newErrors.name = 'Name is required';
    if (!memberFormData.email.trim()) newErrors.email = 'Email is required';
    if (!memberFormData.username.trim()) newErrors.username = 'Username is required';
    if (!memberFormData.password.trim()) newErrors.password = 'Password is required';

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (memberFormData.email && !emailRegex.test(memberFormData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitMember = () => {
    if (!validateForm()) return;

    const memberData = {
      ...memberFormData,
      id: editingMember?.id || (mockTeam.length + 1).toString(),
      permissions: getDefaultPermissions(memberFormData.role),
      avatar: '',
      assignedJobs: editingMember?.assignedJobs || [],
      tasksCompleted: editingMember?.tasksCompleted || 0,
      candidatesProcessed: editingMember?.candidatesProcessed || 0,
      lastLogin: editingMember?.lastLogin || new Date().toISOString(),
      createdDate: editingMember?.createdDate || new Date().toISOString()
    };

    if (editingMember) {
      alert(`Team member "${memberData.name}" has been updated successfully!`);
    } else {
      alert(`New team member "${memberData.name}" has been added successfully!`);
    }

    setShowAddMember(false);
    setShowEditMember(false);
    setEditingMember(null);
    setMemberFormData({
      name: '',
      email: '',
      username: '',
      password: '',
      role: 'Recruiter',
      status: 'Active'
    });
    setErrors({});
  };

  const getDefaultPermissions = (role: string) => {
    return rolePermissions[role as keyof typeof rolePermissions] || [];
  };

  const handleTogglePermission = (role: string, module: string, action: string) => {
    setRolePermissions(prev => {
      const newPermissions = { ...prev };
      const rolePerms = [...newPermissions[role as keyof typeof newPermissions]];
      const moduleIndex = rolePerms.findIndex(p => p.module === module);
      
      if (moduleIndex >= 0) {
        const modulePerms = { ...rolePerms[moduleIndex] };
        if (modulePerms.actions.includes(action)) {
          modulePerms.actions = modulePerms.actions.filter(a => a !== action);
        } else {
          modulePerms.actions = [...modulePerms.actions, action];
        }
        rolePerms[moduleIndex] = modulePerms;
      }

      newPermissions[role as keyof typeof newPermissions] = rolePerms;
      return newPermissions;
    });
  };

  const handleToggleIntegration = (integrationName: string) => {
    setIntegrations(prev => prev.map(integration => {
      if (integration.name === integrationName) {
        if (integration.status === 'Connected') {
          return { ...integration, status: 'Not Connected' };
        } else {
          return { ...integration, status: 'Connected' };
        }
      }
      return integration;
    }));
  };

  const onUpdateIntegration = (name: string, status: string, form: any) => {
    setIntegrations(prev => prev.map(integration => 
      integration.name === name ? { ...integration, status } : integration
    ));
    setShowConnectionModal(false);
    setSelectedIntegration(null);
    setConnectionForm({
      apiKey: '',
      username: '',
      password: '',
      clientId: '',
      clientSecret: ''
    });
  };

  const handleConnectIntegration = () => {
    onUpdateIntegration(selectedIntegration.name, 'Connecting...', connectionForm);

    // Simulate connection process
    setTimeout(() => {
      onUpdateIntegration(selectedIntegration.name, 'Connected', connectionForm);
    }, 2000);
  };

  const TeamManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {mockTeam.map((member) => (
              <tr key={member.id}>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <p className="text-sm text-gray-500">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{member.role}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    member.status === 'Active' ? 'bg-green-100 text-green-800' :
                    member.status === 'Away' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {member.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {member.lastLogin ? new Date(member.lastLogin).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex space-x-2">
                    {hasPermission('team', 'edit') && (
                      <button
                        onClick={() => handleEditMember(member)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit size={16} />
                      </button>
                    )}
                    {hasPermission('team', 'delete') && member.id !== user?.id && (
                      <button className="text-red-600 hover:text-red-900">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const PermissionsManagement = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Role Permissions</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(rolePermissions).map(([role, permissions]) => (
          <div key={role} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-gray-900">{role}</h4>
              <button
                onClick={() => alert(`Permissions for ${role} saved successfully!`)}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
            </div>
            <div className="space-y-3">
              {permissions.map((permission) => (
                <div key={permission.module} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700 capitalize">{permission.module}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['view', 'create', 'edit', 'delete'].map((action) => (
                      <button
                        key={action}
                        onClick={() => handleTogglePermission(role, permission.module, action)}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          permission.actions.includes(action)
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const NotificationSettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="space-y-4">
          {[
            { label: 'New Applications', description: 'Get notified when new candidates apply' },
            { label: 'Interview Reminders', description: 'Receive reminders before scheduled interviews' },
            { label: 'Task Deadlines', description: 'Get alerts for upcoming task deadlines' },
            { label: 'Team Updates', description: 'Notifications about team member activities' },
            { label: 'System Alerts', description: 'Important system notifications and updates' },
          ].map((setting) => (
            <div key={setting.label} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{setting.label}</p>
                <p className="text-sm text-gray-600">{setting.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const IntegrationSettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Third-party Integrations</h3>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Integration Status</h4>
        <p className="text-sm text-blue-700">
          Connect your recruitment system with popular job boards and communication platforms to streamline your hiring process.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {integrations.map((integration) => (
          <div key={integration.name} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">{integration.name}</h4>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                integration.status === 'Connected' 
                  ? 'bg-green-100 text-green-800' 
                  : integration.status === 'Connecting...'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {integration.status}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4">{integration.description}</p>
            
            {integration.status === 'Connected' && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-700">Active and syncing data</span>
                </div>
              </div>
            )}
            
            <button 
              onClick={() => handleToggleIntegration(integration.name)}
              disabled={integration.status === 'Connecting...'}
              className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                integration.status === 'Connecting...'
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : integration.status === 'Connected'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {integration.status === 'Connecting...' ? 'Connecting...' : 
               integration.status === 'Connected' ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        ))}
      </div>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-medium text-yellow-900 mb-2">⚠️ Important Notes</h4>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• Disconnecting integrations will stop data synchronization</li>
          <li>• Some integrations may require API keys or authentication</li>
          <li>• Changes may take a few minutes to take effect</li>
        </ul>
      </div>
    </div>
  );

  const SystemSettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">System Configuration</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-4">Database Settings</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Backup Frequency</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Data Retention (months)</label>
              <input
                type="number"
                defaultValue={24}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-4">Security Settings</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Two-Factor Authentication</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Session Timeout (minutes)</label>
              <input
                type="number"
                defaultValue={30}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          onClick={() => alert('System settings saved successfully!')}
          className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Save size={20} />
          <span>Save Settings</span>
        </button>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'team': return <TeamManagement />;
      case 'permissions': return <PermissionsManagement />;
      case 'notifications': return <NotificationSettings />;
      case 'integrations': return <IntegrationSettings />;
      case 'system': return <SystemSettings />;
      default: return <TeamManagement />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Configure your recruitment system preferences</p>
      </div>

      {/* Tabs */}
      <div>
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={20} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add New Team Member</h2>
              <button
                onClick={() => setShowAddMember(false)}
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
                    <option value="Admin">Admin</option>
                    <option value="HR Manager">HR Manager</option>
                    <option value="Team Lead">Team Lead</option>
                    <option value="Recruiter">Recruiter</option>
                    <option value="Interviewer">Interviewer</option>
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
                    <option value="Active">Active</option>
                    <option value="Away">Away</option>
                    <option value="Busy">Busy</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddMember(false)}
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
      {showEditMember && editingMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Edit Team Member</h2>
              <button
                onClick={() => setShowEditMember(false)}
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
                    <option value="Admin">Admin</option>
                    <option value="HR Manager">HR Manager</option>
                    <option value="Team Lead">Team Lead</option>
                    <option value="Recruiter">Recruiter</option>
                    <option value="Interviewer">Interviewer</option>
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
                    <option value="Active">Active</option>
                    <option value="Away">Away</option>
                    <option value="Busy">Busy</option>
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Current Statistics</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-blue-700">Jobs Assigned</p>
                    <p className="font-semibold text-blue-900">{editingMember.assignedJobs.length}</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Tasks Completed</p>
                    <p className="font-semibold text-blue-900">{editingMember.tasksCompleted}</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Candidates Processed</p>
                    <p className="font-semibold text-blue-900">{editingMember.candidatesProcessed}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowEditMember(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitMember}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Save size={16} />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}