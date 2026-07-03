import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';
import { Plus, Trash2, Copy, Settings, ExternalLink, Link, RefreshCw, X, CheckCircle, XCircle } from 'lucide-react';
import FormBuilderModal from './FormBuilderModal';
import FormFieldEditor from './FormFieldEditor';
import { useAuth } from '../contexts/AuthContext';

// Base URL for the frontend app — used to build shareable form links
const APP_URL = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');

if (import.meta.env.DEV) {
  console.log('APP_URL (FormBuilder):', APP_URL);
}

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

interface ShareLink {
  id: number;
  token: string;
  link: string;
  created_at: string;
  expires_at: string | null;
  used_count: number;
  is_active: boolean;
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
  const { user } = useAuth();
  const isIntern = user?.role === 'HR Intern';
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedForm, setSelectedForm] = useState<SelectedForm | null>(null);
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | number | null>(null);
  const [manageLinksForm, setManageLinksForm] = useState<Form | null>(null);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [shareLinksLoading, setShareLinksLoading] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<number | null>(null);

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

  const copyFormLink = async (form: Form) => {
    const applyUrl = `${APP_URL}/apply/${form.slug}?token=${form.access_token}`;
    if (isIntern) {
      try {
        await navigator.clipboard.writeText(applyUrl);
        setCopiedToken(form.id);
        setTimeout(() => setCopiedToken(null), 2000);
      } catch (err) {
        console.error('Failed to copy link:', err);
        alert('Could not copy link to clipboard');
      }
      return;
    }

    try {
      const authToken = localStorage.getItem('authToken');
      const response = await axios.post(
        `${API_BASE_URL}/form-builder/forms/${form.id}/generate-share-link`,
        {},
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      const link = response.data?.data?.link;
      if (link) {
        console.log('Generated share link:', link);
        await navigator.clipboard.writeText(link);
        setCopiedToken(form.id);
        setTimeout(() => setCopiedToken(null), 2000);
      }
    } catch (error) {
      console.error('Failed to generate share link:', error);
      // Fallback: build the link client-side using the correct frontend base URL
      const link = applyUrl;
      console.log('Fallback share link:', link);
      navigator.clipboard.writeText(link);
      setCopiedToken(form.id);
      setTimeout(() => setCopiedToken(null), 2000);
    }
  };

  const openManageLinks = async (form: Form) => {
    setManageLinksForm(form);
    setShareLinksLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(
        `${API_BASE_URL}/form-builder/forms/${form.id}/share-links`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShareLinks(response.data?.data?.links || []);
    } catch (error) {
      console.error('Failed to load share links:', error);
      setShareLinks([]);
    } finally {
      setShareLinksLoading(false);
    }
  };

  const revokeShareLink = async (tokenId: number) => {
    if (!confirm('Revoke this link? Anyone using it will no longer be able to access the form.')) return;
    try {
      const token = localStorage.getItem('authToken');
      await axios.patch(
        `${API_BASE_URL}/form-builder/share-links/${tokenId}/revoke`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShareLinks(prev => prev.map(l => l.id === tokenId ? { ...l, is_active: false } : l));
    } catch (error) {
      console.error('Failed to revoke link:', error);
      alert('Failed to revoke link');
    }
  };

  const generateNewLinkFromModal = async () => {
    if (!manageLinksForm) return;
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await axios.post(
        `${API_BASE_URL}/form-builder/forms/${manageLinksForm.id}/generate-share-link`,
        {},
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      const newLink = response.data?.data;
      if (newLink) {
        setShareLinks(prev => [{
          id: Date.now(), // temp id until refresh
          token: newLink.shareToken,
          link: newLink.link,
          created_at: new Date().toISOString(),
          expires_at: null,
          used_count: 0,
          is_active: true
        }, ...prev]);
        await navigator.clipboard.writeText(newLink.link);
        setCopiedToken(manageLinksForm.id);
        setTimeout(() => setCopiedToken(null), 2000);
      }
    } catch (error) {
      console.error('Failed to generate link:', error);
      alert('Failed to generate new link');
    }
  };

  const copyLinkToClipboard = async (link: ShareLink) => {
    await navigator.clipboard.writeText(link.link);
    setCopiedLinkId(link.id);
    setTimeout(() => setCopiedLinkId(null), 2000);
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
          <p className="text-gray-600 mt-1">
            {isIntern
              ? 'View active intake forms and copy the public apply link.'
              : 'Create and manage custom candidate intake forms'}
          </p>
        </div>
        {!isIntern && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Create New Form
          </button>
        )}
      </div>

      {/* Forms Grid */}
      {forms.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-gray-400 text-5xl mb-4">📝</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No forms yet</h3>
          <p className="text-gray-600 mb-4">
            {isIntern
              ? 'Ask an admin or recruiter to publish a form. You can copy its apply link when it appears here.'
              : 'Create your first candidate intake form to get started'}
          </p>
          {!isIntern && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Form
            </button>
          )}
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
                  title="Copy apply link"
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
                {!isIntern && (
                  <button
                    onClick={() => openManageLinks(form)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition-colors"
                    title="Manage share links"
                  >
                    <Link size={14} />
                    Manage Links
                  </button>
                )}
                {!isIntern && (
                  <button
                    onClick={() => openFieldEditor(form)}
                    disabled={!hasValidFormId(form?.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    title="Edit fields"
                  >
                    <Settings size={14} />
                    Fields
                  </button>
                )}
                {!isIntern && (
                  <button
                    onClick={() => window.open(`${APP_URL}/apply/${form.slug}?token=${form.access_token}`, '_blank')}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    title="Preview form"
                  >
                    <ExternalLink size={14} />
                    Preview
                  </button>
                )}
                {!isIntern && (
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
                )}
                {!isIntern && (
                  <button
                    onClick={() => handleDeleteForm(form.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                    title="Delete form"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                )}
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

      {/* Manage Share Links Modal */}
      {manageLinksForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Manage Share Links</h2>
                <p className="text-sm text-gray-500 mt-0.5">{manageLinksForm.name}</p>
              </div>
              <button
                onClick={() => { setManageLinksForm(null); setShareLinks([]); }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Generate New Link */}
            <div className="px-6 py-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between gap-4">
              <p className="text-sm text-blue-700">Generate a new unique share link for this form. Each link can be tracked and revoked independently.</p>
              <button
                onClick={generateNewLinkFromModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                <RefreshCw size={14} />
                Generate New Link
              </button>
            </div>

            {/* Links List */}
            <div className="flex-1 overflow-y-auto p-6">
              {shareLinksLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : shareLinks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Link size={32} className="mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No share links yet</p>
                  <p className="text-sm mt-1">Generate a link above to share this form.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {shareLinks.map(link => (
                    <div
                      key={link.id}
                      className={`border rounded-lg p-4 ${link.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {link.is_active ? (
                              <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                <CheckCircle size={10} /> Active
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                <XCircle size={10} /> Revoked
                              </span>
                            )}
                            <span className="text-xs text-gray-400">
                              Used {link.used_count} time{link.used_count !== 1 ? 's' : ''}
                            </span>
                            <span className="text-xs text-gray-400">
                              · Created {new Date(link.created_at).toLocaleDateString()}
                            </span>
                            {link.expires_at && (
                              <span className="text-xs text-gray-400">
                                · Expires {new Date(link.expires_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 font-mono truncate">{link.link}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {link.is_active && (
                            <>
                              <button
                                onClick={() => copyLinkToClipboard(link)}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                              >
                                {copiedLinkId === link.id ? '✓ Copied' : <><Copy size={12} /> Copy</>}
                              </button>
                              <button
                                onClick={() => revokeShareLink(link.id)}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                              >
                                <XCircle size={12} /> Revoke
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormBuilder;
