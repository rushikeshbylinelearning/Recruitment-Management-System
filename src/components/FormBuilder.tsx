import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';
import { Plus, Edit2, Trash2, Copy, Eye, Settings, BarChart3, ExternalLink } from 'lucide-react';
import FormBuilderModal from './FormBuilderModal';
import FormFieldEditor from './FormFieldEditor';

interface Form {
  id: string | number;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  access_token: string;
  token_validity_hours: number;
  token_expires_at: string;
  job_title: string | null;
  created_by_name: string;
  submission_count: number;
  field_count: number;
  created_at: string;
}

interface SelectedForm {
  id: string | number;
  name: string;
}

const normalizeForm = (rawForm: any): Form => ({
  ...rawForm,
  // Preserve backend ID type; do not coerce to Number to avoid hosted ID issues.
  id: rawForm?.id
});

const hasValidFormId = (id: string | number | undefined | null): boolean => {
  if (id === null || id === undefined) return false;
  if (typeof id === 'number') return Number.isFinite(id) && id > 0;
  return String(id).trim().length > 0;
};

const FormBuilder: React.FC = () => {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedForm, setSelectedForm] = useState<SelectedForm | null>(null);
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | number | null>(null);

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API_BASE_URL}/form-builder/forms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const normalizedForms: Form[] = (response?.data?.data?.forms || []).map(normalizeForm);
      setForms(normalizedForms);
    } catch (error) {
      console.error('Failed to load forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const openFieldEditor = (form: Form) => {
    if (!hasValidFormId(form?.id)) {
      alert('This form has an invalid ID. Please refresh and try again.');
      return;
    }

    setSelectedForm({ id: form.id, name: form.name });
    setShowFieldEditor(true);
  };

  const handleDeleteForm = async (formId: string | number) => {
    if (!confirm('Are you sure you want to delete this form? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      await axios.delete(`${API_BASE_URL}/form-builder/forms/${formId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadForms();
    } catch (error) {
      console.error('Failed to delete form:', error);
      alert('Failed to delete form');
    }
  };

  const handleToggleActive = async (form: Form) => {
    try {
      const token = localStorage.getItem('authToken');
      await axios.put(
        `${API_BASE_URL}/form-builder/forms/${form.id}`,
        { is_active: !form.is_active },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      loadForms();
    } catch (error) {
      console.error('Failed to update form:', error);
    }
  };

  const copyFormLink = (form: Form) => {
    const link = `${window.location.origin}/apply/${form.slug}?token=${form.access_token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(form.id);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const regenerateToken = async (formId: string | number) => {
    if (!confirm('Are you sure you want to regenerate the access token? The old link will stop working.')) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      await axios.post(
        `${API_BASE_URL}/form-builder/forms/${formId}/regenerate-token`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      loadForms();
      alert('Access token regenerated successfully');
    } catch (error) {
      console.error('Failed to regenerate token:', error);
      alert('Failed to regenerate token');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Form Builder</h1>
          <p className="text-gray-600 mt-1">Create and manage custom candidate intake forms</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Create New Form
        </button>
      </div>

      {/* Forms Grid */}
      {forms.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-gray-400 text-5xl mb-4">📝</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No forms yet</h3>
          <p className="text-gray-600 mb-4">Create your first candidate intake form to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Form
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {forms.map(form => (
            <div key={form.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
              {/* Card Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 flex-1">{form.name}</h3>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      form.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {form.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {form.description && (
                  <p className="text-sm text-gray-600 mb-3">{form.description}</p>
                )}
                {form.job_title && (
                  <div className="inline-block bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                    {form.job_title}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="px-6 py-4 bg-gray-50 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600">Submissions</p>
                  <p className="text-2xl font-bold text-gray-900">{form.submission_count}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Fields</p>
                  <p className="text-2xl font-bold text-gray-900">{form.field_count}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-gray-200 flex flex-wrap gap-2">
                <button
                  onClick={() => copyFormLink(form)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                  title="Copy form link"
                >
                  {copiedToken === form.id ? (
                    <>✓ Copied</>
                  ) : (
                    <>
                      <Copy size={14} />
                      Copy Link
                    </>
                  )}
                </button>
                <button
                  onClick={() => openFieldEditor(form)}
                  disabled={!hasValidFormId(form?.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  title="Edit fields"
                >
                  <Settings size={14} />
                  Fields
                </button>
                <button
                  onClick={() => window.open(`/apply/${form.slug}?token=${form.access_token}`, '_blank')}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  title="Preview form"
                >
                  <ExternalLink size={14} />
                  Preview
                </button>
                <button
                  onClick={() => handleToggleActive(form)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded transition-colors ${
                    form.is_active
                      ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                      : 'bg-green-50 text-green-700 hover:bg-green-100'
                  }`}
                >
                  {form.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDeleteForm(form.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                  title="Delete form"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <FormBuilderModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadForms();
          }}
        />
      )}

      {showFieldEditor && selectedForm && (
        <FormFieldEditor
          form={selectedForm as any}
          onClose={() => {
            setShowFieldEditor(false);
            setSelectedForm(null);
            loadForms();
          }}
        />
      )}
    </div>
  );
};

export default FormBuilder;
