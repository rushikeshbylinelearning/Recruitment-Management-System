import React, { useState } from 'react';
import { Plus, Edit, Trash2, Mail, Copy, X, Save } from 'lucide-react';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: 'Application' | 'Interview' | 'Offer' | 'Rejection' | 'Follow-up';
  variables: string[];
}

interface EmailTemplatesProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: EmailTemplate) => void;
}

export default function EmailTemplates({ isOpen, onClose, onSelectTemplate }: EmailTemplatesProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([
    {
      id: '1',
      name: 'Application Received',
      subject: 'Thank you for your application - {{position}}',
      body: `Dear {{candidateName}},

Thank you for your interest in the {{position}} role at {{companyName}}. We have received your application and our team is currently reviewing it.

We will be in touch within the next few days to update you on the next steps in our hiring process.

If you have any questions in the meantime, please don't hesitate to reach out.

Best regards,
{{recruiterName}}
{{companyName}} Recruitment Team`,
      category: 'Application',
      variables: ['candidateName', 'position', 'companyName', 'recruiterName']
    },
    {
      id: '2',
      name: 'Interview Invitation',
      subject: 'Interview Invitation - {{position}} at {{companyName}}',
      body: `Dear {{candidateName}},

We are pleased to invite you for an interview for the {{position}} role at {{companyName}}.

Interview Details:
- Date: {{interviewDate}}
- Time: {{interviewTime}}
- Duration: {{duration}} minutes
- Type: {{interviewType}}
- Location: {{location}}
{{#if meetingLink}}
- Meeting Link: {{meetingLink}}
{{/if}}

Please confirm your availability by replying to this email. If you need to reschedule, please let us know as soon as possible.

We look forward to speaking with you!

Best regards,
{{recruiterName}}
{{companyName}} Recruitment Team`,
      category: 'Interview',
      variables: ['candidateName', 'position', 'companyName', 'interviewDate', 'interviewTime', 'duration', 'interviewType', 'location', 'meetingLink', 'recruiterName']
    },
    {
      id: '3',
      name: 'Job Offer',
      subject: 'Job Offer - {{position}} at {{companyName}}',
      body: `Dear {{candidateName}},

Congratulations! We are delighted to offer you the position of {{position}} at {{companyName}}.

Offer Details:
- Position: {{position}}
- Department: {{department}}
- Start Date: {{startDate}}
- Salary: {{salary}}
- Benefits: {{benefits}}

Please review the attached offer letter for complete details. We would appreciate your response by {{responseDeadline}}.

If you have any questions about the offer, please don't hesitate to contact me.

We are excited about the possibility of you joining our team!

Best regards,
{{recruiterName}}
{{companyName}} Recruitment Team`,
      category: 'Offer',
      variables: ['candidateName', 'position', 'companyName', 'department', 'startDate', 'salary', 'benefits', 'responseDeadline', 'recruiterName']
    },
    {
      id: '4',
      name: 'Application Rejection',
      subject: 'Update on your application - {{position}}',
      body: `Dear {{candidateName}},

Thank you for your interest in the {{position}} role at {{companyName}} and for taking the time to interview with our team.

After careful consideration, we have decided to move forward with another candidate whose experience more closely matches our current needs.

We were impressed by your qualifications and encourage you to apply for future opportunities that match your skills and experience.

We wish you all the best in your job search.

Best regards,
{{recruiterName}}
{{companyName}} Recruitment Team`,
      category: 'Rejection',
      variables: ['candidateName', 'position', 'companyName', 'recruiterName']
    },
    {
      id: '5',
      name: 'Follow-up After Interview',
      subject: 'Thank you for interviewing - {{position}}',
      body: `Dear {{candidateName}},

Thank you for taking the time to interview for the {{position}} role at {{companyName}} yesterday. It was a pleasure speaking with you about your experience and learning more about your interest in joining our team.

We are currently reviewing all candidates and will be in touch with next steps by {{followUpDate}}.

If you have any additional questions about the role or our company, please feel free to reach out.

Best regards,
{{recruiterName}}
{{companyName}} Recruitment Team`,
      category: 'Follow-up',
      variables: ['candidateName', 'position', 'companyName', 'followUpDate', 'recruiterName']
    }
  ]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [templateForm, setTemplateForm] = useState({
    name: '',
    subject: '',
    body: '',
    category: 'Application' as EmailTemplate['category']
  });

  if (!isOpen) return null;

  const categories = ['All', 'Application', 'Interview', 'Offer', 'Rejection', 'Follow-up'];
  
  const filteredTemplates = selectedCategory === 'All' 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  const handleCreateTemplate = () => {
    setTemplateForm({
      name: '',
      subject: '',
      body: '',
      category: 'Application'
    });
    setEditingTemplate(null);
    setShowCreateModal(true);
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setTemplateForm({
      name: template.name,
      subject: template.subject,
      body: template.body,
      category: template.category
    });
    setEditingTemplate(template);
    setShowCreateModal(true);
  };

  const handleSaveTemplate = () => {
    const variables = extractVariables(templateForm.subject + ' ' + templateForm.body);
    
    if (editingTemplate) {
      setTemplates(prev => prev.map(t => 
        t.id === editingTemplate.id 
          ? { ...t, ...templateForm, variables }
          : t
      ));
    } else {
      const newTemplate: EmailTemplate = {
        id: Date.now().toString(),
        ...templateForm,
        variables
      };
      setTemplates(prev => [...prev, newTemplate]);
    }
    
    setShowCreateModal(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    }
  };

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    
    return [...new Set(matches.map(match => match.replace(/[{}]/g, '')))];
  };

  const copyTemplate = (template: EmailTemplate) => {
    navigator.clipboard.writeText(template.body);
    alert('Template copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Email Templates</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Sidebar */}
          <div className="w-80 border-r border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-gray-900">Templates</h3>
              <button
                onClick={handleCreateTemplate}
                className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus size={14} />
                <span>New</span>
              </button>
            </div>

            {/* Category Filter */}
            <div className="mb-4">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Templates List */}
            <div className="space-y-2 overflow-y-auto max-h-96">
              {filteredTemplates.map(template => (
                <div
                  key={template.id}
                  className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer group"
                  onClick={() => onSelectTemplate(template)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900 text-sm">{template.name}</h4>
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyTemplate(template);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTemplate(template);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(template.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">{template.subject}</p>
                  <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                    {template.category}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6">
            <div className="text-center py-12">
              <Mail size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Template</h3>
              <p className="text-gray-600">Choose a template from the sidebar to preview or use it.</p>
            </div>
          </div>
        </div>

        {/* Create/Edit Template Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingTemplate ? 'Edit Template' : 'Create Template'}
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Template Name
                    </label>
                    <input
                      type="text"
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter template name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={templateForm.category}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, category: e.target.value as EmailTemplate['category'] }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Application">Application</option>
                      <option value="Interview">Interview</option>
                      <option value="Offer">Offer</option>
                      <option value="Rejection">Rejection</option>
                      <option value="Follow-up">Follow-up</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={templateForm.subject}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter email subject"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Body
                  </label>
                  <textarea
                    value={templateForm.body}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, body: e.target.value }))}
                    rows={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter email body. Use {{variableName}} for dynamic content."
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Available Variables</h4>
                  <p className="text-sm text-blue-700 mb-2">
                    Use these variables in your template: {"{variableName}"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['candidateName', 'position', 'companyName', 'recruiterName', 'interviewDate', 'interviewTime', 'location', 'salary'].map(variable => (
                      <span key={variable} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {`{{${variable}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTemplate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Save size={16} />
                  <span>{editingTemplate ? 'Update' : 'Create'} Template</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}