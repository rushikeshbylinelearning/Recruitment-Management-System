import { useState, useEffect } from 'react';
import { Save, Plus, Edit, Trash2, Users, Shield, Bell, Globe, Database, X, MessageSquare, Mail, Phone, Calendar, Search, Send, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TeamMember } from '../types';
import { mockTeam } from '../data/mockData';
import { usersAPI, communicationsAPI, candidatesAPI, emailTemplatesAPI } from '../services/api';

export default function Settings() {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('team');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEditMember, setShowEditMember] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [memberFormData, setMemberFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'Recruiter' as 'Recruiter' | 'Admin' | 'HR Manager' | 'Team Lead' | 'Interviewer',
    status: 'Active' as 'Active' | 'Away' | 'Busy'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [integrations, setIntegrations] = useState([
    { name: 'LinkedIn', status: 'Connected', description: 'Post jobs and source candidates' },
    { name: 'Indeed', status: 'Connected', description: 'Automatic job posting and application sync' },
    { name: 'Naukri.com', status: 'Not Connected', description: 'Access to Indian job market' },
    { name: 'Slack', status: 'Connected', description: 'Team notifications and updates' },
    { name: 'Google Calendar', status: 'Connected', description: 'Interview scheduling integration' },
    { name: 'WhatsApp Business', status: 'Not Connected', description: 'Candidate communication via WhatsApp' },
  ]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, Array<{module: string, actions: string[]}>>>({});
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  
  // Communications state
  const [communications, setCommunications] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [communicationsLoading, setCommunicationsLoading] = useState(false);
  const [showAddCommunication, setShowAddCommunication] = useState(false);
  const [showEditCommunication, setShowEditCommunication] = useState(false);
  const [editingCommunication, setEditingCommunication] = useState<any>(null);
  const [communicationFormData, setCommunicationFormData] = useState({
    candidateId: '',
    type: 'Email',
    content: '',
    status: 'Sent',
    followUpDate: '',
    followUpNotes: ''
  });
  const [communicationErrors, setCommunicationErrors] = useState<Record<string, string>>({});
  const [communicationSearchTerm, setCommunicationSearchTerm] = useState('');
  const [communicationTypeFilter, setCommunicationTypeFilter] = useState('All');
  const [communicationStatusFilter, setCommunicationStatusFilter] = useState('All');
  
  // Email Templates state
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [templateCategories, setTemplateCategories] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [showEditTemplate, setShowEditTemplate] = useState(false);
  const [showSendTemplate, setShowSendTemplate] = useState(false);
  const [showPreviewTemplate, setShowPreviewTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [templateFormData, setTemplateFormData] = useState({
    name: '',
    subject: '',
    content: '',
    category: 'Custom',
    variables: [] as string[]
  });
  const [templateErrors, setTemplateErrors] = useState<Record<string, string>>({});
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('All');
  const [selectedCandidates, setSelectedCandidates] = useState<number[]>([]);
  const [sendingTemplate, setSendingTemplate] = useState(false);
  

  // Load role permissions on component mount
  useEffect(() => {
    loadRolePermissions();
  }, []);

  const tabs = [
    { id: 'team', label: 'Team Management', icon: Users },
    { id: 'permissions', label: 'Role Permissions', icon: Shield },
    { id: 'communications', label: 'Communications', icon: MessageSquare },
    { id: 'email-templates', label: 'Email Templates', icon: Mail },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'Integrations', icon: Globe },
    { id: 'system', label: 'System', icon: Database },
  ];

  // Load role permissions from API
  const loadRolePermissions = async () => {
    try {
      setPermissionsLoading(true);
      const response = await usersAPI.getRolePermissions();
      if (response.success && response.data) {
        setRolePermissions(response.data.rolePermissions);
      }
    } catch (error) {
      console.error('Error loading role permissions:', error);
    } finally {
      setPermissionsLoading(false);
    }
  };

  // Load team members from API
  const loadTeamMembers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getUsers({ limit: 100 });
      if (response.success && response.data) {
        // Transform API data to match TeamMember interface
        const members: TeamMember[] = response.data.users.map((user: any) => ({
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          username: user.username,
          password: '', // Not needed for display
          role: user.role as 'Recruiter' | 'Admin' | 'HR Manager' | 'Team Lead' | 'Interviewer',
          status: user.status as 'Active' | 'Away' | 'Busy',
          avatar: user.avatar,
          permissions: user.permissions || [],
          assignedJobs: [],
          tasksCompleted: user.statistics?.tasks_completed || 0,
          candidatesProcessed: user.statistics?.candidates_processed || 0,
          lastLogin: user.last_login,
          createdDate: user.created_at
        }));
        setTeamMembers(members);
        
      }
    } catch (error) {
      console.error('Error loading team members:', error);
      // Fallback to mock data if API fails
      setTeamMembers(mockTeam);
    } finally {
      setLoading(false);
    }
  };

  // Load communications from API
  const loadCommunications = async () => {
    try {
      setCommunicationsLoading(true);
      const [communicationsResponse, candidatesResponse] = await Promise.all([
        communicationsAPI.getCommunications({ limit: 100 }),
        candidatesAPI.getCandidates()
      ]);
      
      if (communicationsResponse.success && communicationsResponse.data) {
        setCommunications(communicationsResponse.data.communications || []);
      }
      
      if (candidatesResponse.success && candidatesResponse.data) {
        setCandidates(candidatesResponse.data.candidates || []);
      }
    } catch (error) {
      console.error('Error loading communications:', error);
    } finally {
      setCommunicationsLoading(false);
    }
  };

  // Communications CRUD functions
  const handleAddCommunication = () => {
    setCommunicationFormData({
      candidateId: '',
      type: 'Email',
      content: '',
      status: 'Sent',
      followUpDate: '',
      followUpNotes: ''
    });
    setCommunicationErrors({});
    setShowAddCommunication(true);
  };

  const handleEditCommunication = (communication: any) => {
    setEditingCommunication(communication);
    setCommunicationFormData({
      candidateId: communication.candidateId.toString(),
      type: communication.type,
      content: communication.content,
      status: communication.status,
      followUpDate: communication.followUpDate || '',
      followUpNotes: communication.followUpNotes || ''
    });
    setCommunicationErrors({});
    setShowEditCommunication(true);
  };

  const handleDeleteCommunication = async (communicationId: number) => {
    if (!confirm('Are you sure you want to delete this communication?')) {
      return;
    }

    try {
      setCommunicationsLoading(true);
      const response = await communicationsAPI.deleteCommunication(communicationId);
      if (response.success) {
        setCommunications(communications.filter(c => c.id !== communicationId));
      } else {
        alert('Failed to delete communication');
      }
    } catch (error) {
      console.error('Error deleting communication:', error);
      alert('Failed to delete communication');
    } finally {
      setCommunicationsLoading(false);
    }
  };

  const validateCommunicationForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!communicationFormData.candidateId) {
      newErrors.candidateId = 'Candidate is required';
    }
    if (!communicationFormData.content.trim()) {
      newErrors.content = 'Content is required';
    }
    
    setCommunicationErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitCommunication = async () => {
    if (!validateCommunicationForm()) {
      return;
    }

    try {
      setCommunicationsLoading(true);
      
      const communicationData = {
        candidateId: parseInt(communicationFormData.candidateId),
        type: communicationFormData.type,
        content: communicationFormData.content,
        status: communicationFormData.status,
        followUpDate: communicationFormData.followUpDate || undefined,
        followUpNotes: communicationFormData.followUpNotes || undefined
      };

      let response;
      if (editingCommunication) {
        response = await communicationsAPI.updateCommunication(editingCommunication.id, communicationData);
      } else {
        response = await communicationsAPI.createCommunication(communicationData);
      }

      if (response.success) {
        // Reload communications
        await loadCommunications();
        setShowAddCommunication(false);
        setShowEditCommunication(false);
        setEditingCommunication(null);
        setCommunicationErrors({});
      } else {
        alert(`Failed to ${editingCommunication ? 'update' : 'create'} communication`);
      }
    } catch (error) {
      console.error(`Error ${editingCommunication ? 'updating' : 'creating'} communication:`, error);
      alert(`Failed to ${editingCommunication ? 'update' : 'create'} communication`);
    } finally {
      setCommunicationsLoading(false);
    }
  };

  // Load team members on component mount
  useEffect(() => {
    if (activeTab === 'team') {
      loadTeamMembers();
    }
  }, [activeTab]);

  // Load communications when communications tab is active
  useEffect(() => {
    if (activeTab === 'communications') {
      loadCommunications();
    }
  }, [activeTab]);

  // Load email templates from API
  const loadEmailTemplates = async () => {
    try {
      setTemplatesLoading(true);
      const [templatesResponse, categoriesResponse] = await Promise.all([
        emailTemplatesAPI.getEmailTemplates({ limit: 100 }),
        emailTemplatesAPI.getTemplateCategories()
      ]);
      
      if (templatesResponse.success && templatesResponse.data) {
        setEmailTemplates(templatesResponse.data.templates || []);
      }
      
      if (categoriesResponse.success && categoriesResponse.data) {
        setTemplateCategories(categoriesResponse.data.categories || []);
      }
      
      // Template variables are not currently used
    } catch (error) {
      console.error('Error loading email templates:', error);
    } finally {
      setTemplatesLoading(false);
    }
  };

  // Load email templates when email-templates tab is active
  useEffect(() => {
    if (activeTab === 'email-templates') {
      loadEmailTemplates();
    }
  }, [activeTab]);

  // Email Templates CRUD functions
  const handleAddTemplate = () => {
    setTemplateFormData({
      name: '',
      subject: '',
      content: '',
      category: 'Custom',
      variables: []
    });
    setTemplateErrors({});
    setShowAddTemplate(true);
  };

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template);
    setTemplateFormData({
      name: template.name,
      subject: template.subject,
      content: template.content,
      category: template.category,
      variables: template.variables || []
    });
    setTemplateErrors({});
    setShowEditTemplate(true);
  };

  const handlePreviewTemplate = (template: any) => {
    setPreviewTemplate(template);
    setShowPreviewTemplate(true);
  };

  const handleSendTemplate = (template: any) => {
    setEditingTemplate(template);
    setSelectedCandidates([]);
    setShowSendTemplate(true);
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm('Are you sure you want to delete this email template?')) {
      return;
    }

    try {
      setTemplatesLoading(true);
      const response = await emailTemplatesAPI.deleteEmailTemplate(templateId);
      if (response.success) {
        setEmailTemplates(emailTemplates.filter(t => t.id !== templateId));
        alert('Email template deleted successfully!');
      } else {
        alert('Failed to delete email template');
      }
    } catch (error) {
      console.error('Error deleting email template:', error);
      alert('Failed to delete email template');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const validateTemplateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!templateFormData.name.trim()) {
      newErrors.name = 'Template name is required';
    }
    if (!templateFormData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }
    if (!templateFormData.content.trim()) {
      newErrors.content = 'Content is required';
    }
    
    setTemplateErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitTemplate = async () => {
    if (!validateTemplateForm()) {
      return;
    }

    try {
      setTemplatesLoading(true);
      
      const templateData = {
        name: templateFormData.name,
        subject: templateFormData.subject,
        content: templateFormData.content,
        category: templateFormData.category,
        variables: templateFormData.variables
      };

      let response;
      if (editingTemplate) {
        response = await emailTemplatesAPI.updateEmailTemplate(editingTemplate.id, templateData);
      } else {
        response = await emailTemplatesAPI.createEmailTemplate(templateData);
      }

      if (response.success) {
        // Reload templates
        await loadEmailTemplates();
        setShowAddTemplate(false);
        setShowEditTemplate(false);
        setEditingTemplate(null);
        setTemplateErrors({});
        alert(`Email template ${editingTemplate ? 'updated' : 'created'} successfully!`);
      } else {
        alert(`Failed to ${editingTemplate ? 'update' : 'create'} email template`);
      }
    } catch (error) {
      console.error(`Error ${editingTemplate ? 'updating' : 'creating'} email template:`, error);
      alert(`Failed to ${editingTemplate ? 'update' : 'create'} email template`);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleSendTemplateToCandidates = async () => {
    if (selectedCandidates.length === 0) {
      alert('Please select at least one candidate');
      return;
    }

    try {
      setSendingTemplate(true);
      const response = await emailTemplatesAPI.sendEmailTemplate(
        editingTemplate.id,
        selectedCandidates
      );

      if (response.success && response.data) {
        alert(`Email sent to ${response.data.sent} candidates successfully!`);
        setShowSendTemplate(false);
        setSelectedCandidates([]);
        setEditingTemplate(null);
      } else {
        alert('Failed to send email template');
      }
    } catch (error) {
      console.error('Error sending email template:', error);
      alert('Failed to send email template');
    } finally {
      setSendingTemplate(false);
    }
  };

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

  const handleSubmitMember = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      if (editingMember) {
        // Update existing member
        await usersAPI.updateUser(editingMember.id, {
          username: memberFormData.username,
          email: memberFormData.email,
          name: memberFormData.name,
          role: memberFormData.role,
          status: memberFormData.status,
          avatar: editingMember.avatar
        });
        alert(`Team member "${memberFormData.name}" has been updated successfully!`);
      } else {
        // Create new member
        await usersAPI.createUser({
          username: memberFormData.username,
          email: memberFormData.email,
          name: memberFormData.name,
          password: memberFormData.password,
          role: memberFormData.role,
          status: memberFormData.status
        });
        alert(`New team member "${memberFormData.name}" has been added successfully!`);
      }

      // Reload team members
      await loadTeamMembers();

      // Close modals and reset form
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
    } catch (error: any) {
      console.error('Error saving member:', error);
      const errorMessage = error.response?.data?.message || 'An error occurred while saving the member';
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
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




  const handleSaveRolePermissions = async () => {
    setPermissionsLoading(true);
    try {
      await usersAPI.updateRolePermissions(rolePermissions);
      alert('Role permissions updated successfully!');
      // Reload permissions to reflect the changes
      await loadRolePermissions();
    } catch (error: any) {
      console.error('Error updating role permissions:', error);
      const errorMessage = error.response?.data?.message || 'An error occurred while updating role permissions';
      alert(`Error: ${errorMessage}`);
    } finally {
      setPermissionsLoading(false);
    }
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
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  Loading team members...
                </td>
              </tr>
            ) : teamMembers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No team members found.
                </td>
              </tr>
            ) : (
              teamMembers.map((member) => (
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
                        title="Edit Member"
                      >
                        <Edit size={16} />
                      </button>
                    )}
                    {hasPermission('team', 'delete') && member.id !== user?.id && (
                      <button className="text-red-600 hover:text-red-900" title="Delete Member">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const PermissionsManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Role Permissions</h3>
        <div className="flex space-x-3">
          <button
            onClick={loadRolePermissions}
            disabled={permissionsLoading}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              permissionsLoading 
                ? 'bg-gray-400 text-white cursor-not-allowed' 
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
          >
            <span>{permissionsLoading ? 'Loading...' : 'Refresh'}</span>
          </button>
          <button
            onClick={handleSaveRolePermissions}
            disabled={permissionsLoading}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              permissionsLoading 
                ? 'bg-gray-400 text-white cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Save size={16} />
            <span>{permissionsLoading ? 'Saving...' : 'Save All Role Permissions'}</span>
          </button>
        </div>
      </div>
      
      {Object.keys(rolePermissions).length === 0 && !permissionsLoading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading permissions...</p>
        </div>
      )}
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">ℹ️ Role Permissions</h4>
        <p className="text-sm text-blue-700">
          Configure default permissions for each role. These permissions will be applied to all users with that role.
          Individual user permissions can be customized from the Team Management section.
        </p>
      </div>
      
      {Object.keys(rolePermissions).length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(rolePermissions).map(([role, permissions]) => (
          <div key={role} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-gray-900">{role}</h4>
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                {permissions.length} modules
              </span>
            </div>
            <div className="space-y-3">
              {permissions.map((permission) => (
                <div key={permission.module} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700 capitalize">{permission.module}</span>
                    <span className="text-xs text-gray-500">{permission.actions.length} actions</span>
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
      )}
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

  // Communications Management Component
  const CommunicationsManagement = () => {
    const filteredCommunications = communications.filter(comm => {
      const matchesSearch = comm.candidateName?.toLowerCase().includes(communicationSearchTerm.toLowerCase()) ||
                           comm.content?.toLowerCase().includes(communicationSearchTerm.toLowerCase());
      const matchesType = communicationTypeFilter === 'All' || comm.type === communicationTypeFilter;
      const matchesStatus = communicationStatusFilter === 'All' || comm.status === communicationStatusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });

    const getTypeIcon = (type: string) => {
      switch (type) {
        case 'Email': return <Mail size={16} className="text-blue-600" />;
        case 'Phone': return <Phone size={16} className="text-green-600" />;
        case 'SMS': return <MessageSquare size={16} className="text-purple-600" />;
        case 'Meeting': return <Calendar size={16} className="text-orange-600" />;
        default: return <MessageSquare size={16} className="text-gray-600" />;
      }
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'Sent': return 'bg-green-100 text-green-800';
        case 'Delivered': return 'bg-blue-100 text-blue-800';
        case 'Read': return 'bg-purple-100 text-purple-800';
        case 'Replied': return 'bg-yellow-100 text-yellow-800';
        case 'Failed': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Communications Management</h3>
          <button
            onClick={handleAddCommunication}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            <span>Add Communication</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search communications..."
              value={communicationSearchTerm}
              onChange={(e) => setCommunicationSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={communicationTypeFilter}
            onChange={(e) => setCommunicationTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="All">All Types</option>
            <option value="Email">Email</option>
            <option value="Phone">Phone</option>
            <option value="SMS">SMS</option>
            <option value="Meeting">Meeting</option>
          </select>
          <select
            value={communicationStatusFilter}
            onChange={(e) => setCommunicationStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="All">All Status</option>
            <option value="Sent">Sent</option>
            <option value="Delivered">Delivered</option>
            <option value="Read">Read</option>
            <option value="Replied">Replied</option>
            <option value="Failed">Failed</option>
          </select>
        </div>

        {/* Communications List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h4 className="font-semibold text-gray-900">All Communications</h4>
            <p className="text-sm text-gray-600 mt-1">{filteredCommunications.length} communications found</p>
          </div>
          <div className="divide-y divide-gray-200">
            {communicationsLoading ? (
              <div className="px-6 py-8 text-center text-gray-500">
                Loading communications...
              </div>
            ) : filteredCommunications.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No communications found.
              </div>
            ) : (
              filteredCommunications.map((communication) => (
                <div key={communication.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        {getTypeIcon(communication.type)}
                        <h4 className="font-medium text-gray-900">{communication.candidateName}</h4>
                        <span className="text-sm text-gray-500">{communication.candidatePosition}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(communication.status)}`}>
                          {communication.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{communication.content}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Type: {communication.type}</span>
                        <span>Date: {new Date(communication.date).toLocaleDateString()}</span>
                        <span>By: {communication.createdByName}</span>
                        {communication.followUpDate && (
                          <span>Follow-up: {new Date(communication.followUpDate).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEditCommunication(communication)}
                        className="p-1.5 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                        title="Edit Communication"
                      >
                        <Edit size={12} className="text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleDeleteCommunication(communication.id)}
                        className="p-1.5 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-colors"
                        title="Delete Communication"
                      >
                        <Trash2 size={12} className="text-gray-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // Email Templates Management Component
  const EmailTemplatesManagement = () => {
    const filteredTemplates = emailTemplates.filter(template => {
      const matchesSearch = template.name?.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
                           template.subject?.toLowerCase().includes(templateSearchTerm.toLowerCase());
      const matchesCategory = templateCategoryFilter === 'All' || template.category === templateCategoryFilter;
      return matchesSearch && matchesCategory;
    });

    const getCategoryColor = (category: string) => {
      switch (category) {
        case 'Interview Invite': return 'bg-blue-100 text-blue-800';
        case 'Rejection': return 'bg-red-100 text-red-800';
        case 'Offer': return 'bg-green-100 text-green-800';
        case 'Follow-up': return 'bg-yellow-100 text-yellow-800';
        case 'Custom': return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Email Templates Management</h3>
          <button
            onClick={handleAddTemplate}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            <span>Add Template</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search templates..."
              value={templateSearchTerm}
              onChange={(e) => setTemplateSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={templateCategoryFilter}
            onChange={(e) => setTemplateCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="All">All Categories</option>
            {templateCategories.map(category => (
              <option key={category.name} value={category.name}>
                {category.name} ({category.count})
              </option>
            ))}
          </select>
        </div>

        {/* Templates List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h4 className="font-semibold text-gray-900">Email Templates</h4>
            <p className="text-sm text-gray-600 mt-1">{filteredTemplates.length} templates found</p>
          </div>
          <div className="divide-y divide-gray-200">
            {templatesLoading ? (
              <div className="px-6 py-8 text-center text-gray-500">
                Loading templates...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No templates found.
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <div key={template.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <Mail size={16} className="text-blue-600" />
                        <h4 className="font-medium text-gray-900">{template.name}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(template.category)}`}>
                          {template.category}
                        </span>
                        {template.isActive ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2 font-medium">{template.subject}</p>
                      <p className="text-sm text-gray-500 mb-2 line-clamp-2">{template.content}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Created: {new Date(template.createdAt).toLocaleDateString()}</span>
                        <span>By: {template.createdByName}</span>
                        {template.variables && template.variables.length > 0 && (
                          <span>Variables: {template.variables.length}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handlePreviewTemplate(template)}
                        className="p-1.5 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                        title="Preview Template"
                      >
                        <Eye size={12} className="text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleSendTemplate(template)}
                        className="p-1.5 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-green-50 hover:border-green-200 transition-colors"
                        title="Send Template"
                      >
                        <Send size={12} className="text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleEditTemplate(template)}
                        className="p-1.5 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                        title="Edit Template"
                      >
                        <Edit size={12} className="text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="p-1.5 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-colors"
                        title="Delete Template"
                      >
                        <Trash2 size={12} className="text-gray-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'team': return <TeamManagement />;
      case 'permissions': return <PermissionsManagement />;
      case 'communications': return <CommunicationsManagement />;
      case 'email-templates': return <EmailTemplatesManagement />;
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
                    placeholder="zaki.byline@gmail.com"
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
                    onChange={(e) => setMemberFormData(prev => ({ ...prev, role: e.target.value as 'Recruiter' | 'Admin' | 'HR Manager' | 'Team Lead' | 'Interviewer' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Admin">Admin</option>
                    <option value="HR Manager">HR Manager</option>
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
                    onChange={(e) => setMemberFormData(prev => ({ ...prev, status: e.target.value as 'Active' | 'Away' | 'Busy' }))}
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
                    placeholder="zaki.byline@gmail.com"
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
                    onChange={(e) => setMemberFormData(prev => ({ ...prev, role: e.target.value as 'Recruiter' | 'Admin' | 'HR Manager' | 'Team Lead' | 'Interviewer' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Admin">Admin</option>
                    <option value="HR Manager">HR Manager</option>
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
                    onChange={(e) => setMemberFormData(prev => ({ ...prev, status: e.target.value as 'Active' | 'Away' | 'Busy' }))}
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

    
      {/* Add Communication Modal */}
      {showAddCommunication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add New Communication</h2>
              <button
                onClick={() => setShowAddCommunication(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Candidate *
                  </label>
                  <select
                    value={communicationFormData.candidateId}
                    onChange={(e) => setCommunicationFormData(prev => ({ ...prev, candidateId: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      communicationErrors.candidateId ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select a candidate</option>
                    {candidates.map(candidate => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} - {candidate.position}
                      </option>
                    ))}
                  </select>
                  {communicationErrors.candidateId && <p className="text-red-500 text-sm mt-1">{communicationErrors.candidateId}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type
                  </label>
                  <select
                    value={communicationFormData.type}
                    onChange={(e) => setCommunicationFormData(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Email">Email</option>
                    <option value="Phone">Phone</option>
                    <option value="SMS">SMS</option>
                    <option value="Meeting">Meeting</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={communicationFormData.status}
                    onChange={(e) => setCommunicationFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Sent">Sent</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Read">Read</option>
                    <option value="Replied">Replied</option>
                    <option value="Failed">Failed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Follow-up Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={communicationFormData.followUpDate}
                    onChange={(e) => setCommunicationFormData(prev => ({ ...prev, followUpDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content *
                </label>
                <textarea
                  value={communicationFormData.content}
                  onChange={(e) => setCommunicationFormData(prev => ({ ...prev, content: e.target.value }))}
                  rows={4}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    communicationErrors.content ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter communication content..."
                />
                {communicationErrors.content && <p className="text-red-500 text-sm mt-1">{communicationErrors.content}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Follow-up Notes (Optional)
                </label>
                <textarea
                  value={communicationFormData.followUpNotes}
                  onChange={(e) => setCommunicationFormData(prev => ({ ...prev, followUpNotes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter follow-up notes..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddCommunication(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitCommunication}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Save size={16} />
                <span>Create Communication</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Communication Modal */}
      {showEditCommunication && editingCommunication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Edit Communication</h2>
              <button
                onClick={() => setShowEditCommunication(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Candidate *
                  </label>
                  <select
                    value={communicationFormData.candidateId}
                    onChange={(e) => setCommunicationFormData(prev => ({ ...prev, candidateId: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      communicationErrors.candidateId ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select a candidate</option>
                    {candidates.map(candidate => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} - {candidate.position}
                      </option>
                    ))}
                  </select>
                  {communicationErrors.candidateId && <p className="text-red-500 text-sm mt-1">{communicationErrors.candidateId}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type
                  </label>
                  <select
                    value={communicationFormData.type}
                    onChange={(e) => setCommunicationFormData(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Email">Email</option>
                    <option value="Phone">Phone</option>
                    <option value="SMS">SMS</option>
                    <option value="Meeting">Meeting</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={communicationFormData.status}
                    onChange={(e) => setCommunicationFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Sent">Sent</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Read">Read</option>
                    <option value="Replied">Replied</option>
                    <option value="Failed">Failed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Follow-up Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={communicationFormData.followUpDate}
                    onChange={(e) => setCommunicationFormData(prev => ({ ...prev, followUpDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content *
                </label>
                <textarea
                  value={communicationFormData.content}
                  onChange={(e) => setCommunicationFormData(prev => ({ ...prev, content: e.target.value }))}
                  rows={4}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    communicationErrors.content ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter communication content..."
                />
                {communicationErrors.content && <p className="text-red-500 text-sm mt-1">{communicationErrors.content}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Follow-up Notes (Optional)
                </label>
                <textarea
                  value={communicationFormData.followUpNotes}
                  onChange={(e) => setCommunicationFormData(prev => ({ ...prev, followUpNotes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter follow-up notes..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowEditCommunication(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitCommunication}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Save size={16} />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Email Template Modal */}
      {showAddTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add New Email Template</h2>
              <button
                onClick={() => setShowAddTemplate(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={templateFormData.name}
                    onChange={(e) => setTemplateFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      templateErrors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter template name"
                  />
                  {templateErrors.name && <p className="text-red-500 text-sm mt-1">{templateErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={templateFormData.category}
                    onChange={(e) => setTemplateFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Custom">Custom</option>
                    <option value="Interview Invite">Interview Invite</option>
                    <option value="Rejection">Rejection</option>
                    <option value="Offer">Offer</option>
                    <option value="Follow-up">Follow-up</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject *
                  </label>
                  <input
                    type="text"
                    value={templateFormData.subject}
                    onChange={(e) => setTemplateFormData(prev => ({ ...prev, subject: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      templateErrors.subject ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter email subject"
                  />
                  {templateErrors.subject && <p className="text-red-500 text-sm mt-1">{templateErrors.subject}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Content *
                </label>
                <textarea
                  value={templateFormData.content}
                  onChange={(e) => setTemplateFormData(prev => ({ ...prev, content: e.target.value }))}
                  rows={12}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    templateErrors.content ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter email content. You can use variables like {{candidate_name}}, {{company_name}}, etc."
                />
                {templateErrors.content && <p className="text-red-500 text-sm mt-1">{templateErrors.content}</p>}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Available Variables</h4>
                <div className="text-sm text-blue-700">
                  <p className="mb-2">You can use these variables in your template:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="font-mono bg-blue-100 px-2 py-1 rounded">{'{{candidate_name}}'}</span>
                    <span className="font-mono bg-blue-100 px-2 py-1 rounded">{'{{company_name}}'}</span>
                    <span className="font-mono bg-blue-100 px-2 py-1 rounded">{'{{job_title}}'}</span>
                    <span className="font-mono bg-blue-100 px-2 py-1 rounded">{'{{interview_date}}'}</span>
                    <span className="font-mono bg-blue-100 px-2 py-1 rounded">{'{{interview_time}}'}</span>
                    <span className="font-mono bg-blue-100 px-2 py-1 rounded">{'{{hr_name}}'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddTemplate(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Save size={16} />
                <span>Create Template</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Email Template Modal */}
      {showEditTemplate && editingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Edit Email Template</h2>
              <button
                onClick={() => setShowEditTemplate(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={templateFormData.name}
                    onChange={(e) => setTemplateFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      templateErrors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter template name"
                  />
                  {templateErrors.name && <p className="text-red-500 text-sm mt-1">{templateErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={templateFormData.category}
                    onChange={(e) => setTemplateFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Custom">Custom</option>
                    <option value="Interview Invite">Interview Invite</option>
                    <option value="Rejection">Rejection</option>
                    <option value="Offer">Offer</option>
                    <option value="Follow-up">Follow-up</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject *
                  </label>
                  <input
                    type="text"
                    value={templateFormData.subject}
                    onChange={(e) => setTemplateFormData(prev => ({ ...prev, subject: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      templateErrors.subject ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter email subject"
                  />
                  {templateErrors.subject && <p className="text-red-500 text-sm mt-1">{templateErrors.subject}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Content *
                </label>
                <textarea
                  value={templateFormData.content}
                  onChange={(e) => setTemplateFormData(prev => ({ ...prev, content: e.target.value }))}
                  rows={12}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    templateErrors.content ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter email content. You can use variables like {{candidate_name}}, {{company_name}}, etc."
                />
                {templateErrors.content && <p className="text-red-500 text-sm mt-1">{templateErrors.content}</p>}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowEditTemplate(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Save size={16} />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Email Template Modal */}
      {showPreviewTemplate && previewTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Preview Email Template</h2>
              <button
                onClick={() => setShowPreviewTemplate(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-gray-900 mb-2">Subject:</h3>
                <p className="text-gray-700">{previewTemplate.subject}</p>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Content:</h3>
                <div className="prose max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: previewTemplate.content.replace(/\n/g, '<br>') }} />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowPreviewTemplate(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Email Template Modal */}
      {showSendTemplate && editingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Send Email Template</h2>
              <button
                onClick={() => setShowSendTemplate(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Template: {editingTemplate.name}</h3>
                <p className="text-blue-700 text-sm">Subject: {editingTemplate.subject}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Candidates *
                </label>
                <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg">
                  {candidates.map(candidate => (
                    <label key={candidate.id} className="flex items-center p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                      <input
                        type="checkbox"
                        checked={selectedCandidates.includes(candidate.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCandidates([...selectedCandidates, candidate.id]);
                          } else {
                            setSelectedCandidates(selectedCandidates.filter(id => id !== candidate.id));
                          }
                        }}
                        className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{candidate.name}</p>
                        <p className="text-sm text-gray-500">{candidate.email} • {candidate.position}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {selectedCandidates.length} candidate(s) selected
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowSendTemplate(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTemplateToCandidates}
                disabled={sendingTemplate || selectedCandidates.length === 0}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                  sendingTemplate || selectedCandidates.length === 0
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <Send size={16} />
                <span>{sendingTemplate ? 'Sending...' : 'Send Email'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}