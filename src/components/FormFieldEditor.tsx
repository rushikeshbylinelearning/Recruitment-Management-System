import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';
import { X, Plus, Trash2, GripVertical, Save } from 'lucide-react';

interface Form {
  id: string | number;
  name: string;
}

interface FormField {
  id?: number;
  label: string;
  field_key: string;
  field_type: string;
  is_required: boolean;
  options: string[] | null;
  placeholder: string;
  order_index: number;
  is_active: boolean;
}

interface FormFieldEditorProps {
  form: Form;
  onClose: () => void;
}

const getInitialNewField = (): Partial<FormField> => ({
  label: '',
  field_key: '',
  field_type: 'text',
  is_required: false,
  options: null,
  placeholder: '',
  order_index: 0,
  is_active: true
});

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'select', label: 'Dropdown' },
  { value: 'file', label: 'File Upload' }
];

const FormFieldEditor: React.FC<FormFieldEditorProps> = ({ form, onClose }) => {
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddField, setShowAddField] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null);
  const [editingValues, setEditingValues] = useState<Partial<FormField>>({});
  const [editingOptionsRaw, setEditingOptionsRaw] = useState('');
  const [newOptionsRaw, setNewOptionsRaw] = useState('');
  const [newField, setNewField] = useState<Partial<FormField>>(getInitialNewField());

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadFields();
  }, [form.id]);

  useEffect(() => {
    // Reset editor state when switching forms to avoid stale add-field UI/type.
    setShowAddField(false);
    setEditingFieldId(null);
    setEditingValues({});
    setEditingOptionsRaw('');
    setNewOptionsRaw('');
    setNewField(getInitialNewField());
    setLoadError(null);
  }, [form.id]);

  const loadFields = async () => {
    if (form?.id === undefined || form?.id === null || String(form.id).trim() === '') {
      console.error('Invalid form id for loading fields:', form?.id);
      setLoading(false);
      return;
    }

    try {
      setLoadError(null);
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API_BASE_URL}/form-builder/forms/${form.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFields(response.data.data.fields || []);
    } catch (error: any) {
      console.error('Failed to load fields:', error);
      if (error.response?.status === 500) {
        setLoadError('Server error loading fields. The form builder database tables may not be set up on the hosted server. Please run the migrations and try again.');
      } else if (error.code === 'ERR_NETWORK' || !error.response) {
        setLoadError('Cannot reach the server. Please check your connection.');
      } else {
        setLoadError(error.response?.data?.message || 'Failed to load fields. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const generateFieldKey = (label: string) => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  };

  const handleSaveEdit = async (fieldId: number) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('authToken');
      const payload = { ...editingValues };
      if (editingValues.field_type === 'select') {
        payload.options = editingOptionsRaw.split(',').map(o => o.trim()).filter(o => o);
      }
      await axios.put(
        `${API_BASE_URL}/form-builder/fields/${fieldId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditingFieldId(null);
      setEditingValues({});
      setEditingOptionsRaw('');
      loadFields();
    } catch (error) {
      console.error('Failed to update field:', error);
      alert('Failed to update field');
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (field: FormField) => {
    setEditingFieldId(field.id!);
    setEditingValues({
      label: field.label,
      field_type: field.field_type,
      is_required: field.is_required,
      placeholder: field.placeholder,
      options: field.options,
      is_active: field.is_active
    });
    setEditingOptionsRaw((field.options || []).join(', '));
  };

  const handleAddField = async () => {
    if (form?.id === undefined || form?.id === null || String(form.id).trim() === '') {
      alert('Please create and save the form first before adding fields.');
      return;
    }

    if (!newField.label || !newField.field_key) {
      alert('Please fill in required fields');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('authToken');
      const payload: Record<string, unknown> = {
        label: newField.label,
        field_key: newField.field_key,
        field_type: newField.field_type || 'text',
        is_required: Boolean(newField.is_required),
        placeholder: newField.placeholder || '',
        order_index: fields.length
      };
      if (newField.field_type === 'select') {
        payload.options = newOptionsRaw.split(',').map(o => o.trim()).filter(o => o);
      }
      await axios.post(
        `${API_BASE_URL}/form-builder/forms/${form.id}/fields`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setShowAddField(false);
      setNewOptionsRaw('');
      setNewField(getInitialNewField());
      loadFields();
    } catch (error: any) {
      console.error('Failed to add field:', error);
      if (error.code === 'ERR_NETWORK' || !error.response) {
        alert('Cannot reach the server. Please check your connection.');
      } else if (error.response?.status === 409) {
        alert('A field with this key already exists in this form. Please use a different Field Key.');
      } else if (error.response?.status === 400) {
        const msgs = error.response?.data?.errors?.map((e: any) => e.msg).join(', ');
        alert(msgs || error.response?.data?.message || 'Validation error. Please check all fields.');
      } else if (error.response?.status === 500) {
        alert('Server error while adding field. The database tables may not be set up on the hosted server. Please contact your administrator.');
      } else {
        alert(error.response?.data?.message || 'Failed to add field');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateField = async (fieldId: number, updates: Partial<FormField>) => {
    try {
      const token = localStorage.getItem('authToken');
      await axios.put(
        `${API_BASE_URL}/form-builder/fields/${fieldId}`,
        updates,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      loadFields();
    } catch (error) {
      console.error('Failed to update field:', error);
      alert('Failed to update field');
    }
  };

  const handleDeleteField = async (fieldId: number) => {
    if (!confirm('Are you sure you want to delete this field?')) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      await axios.delete(`${API_BASE_URL}/form-builder/fields/${fieldId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadFields();
    } catch (error) {
      console.error('Failed to delete field:', error);
      alert('Failed to delete field');
    }
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newFields.length) return;

    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    
    // Update order_index for both fields
    newFields.forEach((field, idx) => {
      if (field.id) {
        handleUpdateField(field.id, { order_index: idx });
      }
    });

    setFields(newFields);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Edit Form Fields</h2>
            <p className="text-sm text-gray-600 mt-1">{form.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Load error banner */}
          {loadError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <span className="text-red-500 text-lg flex-shrink-0">⚠️</span>
              <div>
                <p className="text-red-800 text-sm font-medium">Error loading fields</p>
                <p className="text-red-700 text-sm mt-1">{loadError}</p>
                <button
                  onClick={() => { setLoadError(null); setLoading(true); loadFields(); }}
                  className="mt-2 text-sm text-red-600 underline hover:text-red-800"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Existing Fields */}
          <div className="space-y-3 mb-6">
            {fields.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-600">No fields yet. Add your first field below.</p>
              </div>
            ) : (
              fields.map((field, index) => (
                <div
                  key={field.id}
                  className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                >
                  {editingFieldId === field.id ? (
                    /* Inline Edit Form */
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Label</label>
                          <input
                            type="text"
                            value={editingValues.label || ''}
                            onChange={(e) => setEditingValues(prev => ({ ...prev, label: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Field Type</label>
                          <select
                            value={editingValues.field_type || ''}
                            onChange={(e) => setEditingValues(prev => ({ ...prev, field_type: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          >
                            {FIELD_TYPES.map(type => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Placeholder</label>
                          <input
                            type="text"
                            value={editingValues.placeholder || ''}
                            onChange={(e) => setEditingValues(prev => ({ ...prev, placeholder: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      {editingValues.field_type === 'select' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Options (comma-separated)</label>
                          <input
                            type="text"
                            value={editingOptionsRaw}
                            onChange={(e) => setEditingOptionsRaw(e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            placeholder="Option 1, Option 2, Option 3"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editingValues.is_required || false}
                          onChange={(e) => setEditingValues(prev => ({ ...prev, is_required: e.target.checked }))}
                          className="rounded border-gray-300 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">Required</span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => { setEditingFieldId(null); setEditingValues({}); }}
                          className="flex-1 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => field.id && handleSaveEdit(field.id)}
                          disabled={saving}
                          className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <Save size={14} />
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Read-only view with edit button */
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => moveField(index, 'up')} disabled={index === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">▲</button>
                        <GripVertical size={16} className="text-gray-400" />
                        <button onClick={() => moveField(index, 'down')} disabled={index === fields.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">▼</button>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">{field.label}</span>
                          {Boolean(field.is_required) && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Required</span>}
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            {FIELD_TYPES.find(t => t.value === field.field_type)?.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">Key: {field.field_key}</p>
                        {field.placeholder && <p className="text-xs text-gray-500 mt-1">Placeholder: {field.placeholder}</p>}
                      </div>
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => startEditing(field)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit field"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => field.id && handleDeleteField(field.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete field"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add New Field */}
          {!showAddField ? (
            <button
              onClick={() => setShowAddField(true)}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Add New Field
            </button>
          ) : (
            <div className="bg-blue-50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-900 mb-3">Add New Field</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Label <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newField.label}
                    onChange={(e) => {
                      const label = e.target.value;
                      setNewField(prev => ({
                        ...prev,
                        label,
                        field_key: generateFieldKey(label)
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Full Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Field Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newField.field_key}
                    onChange={(e) => setNewField(prev => ({ ...prev, field_key: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="e.g., full_name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Field Type
                  </label>
                  <select
                    value={newField.field_type}
                    onChange={(e) => setNewField(prev => ({ ...prev, field_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {FIELD_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Placeholder
                  </label>
                  <input
                    type="text"
                    value={newField.placeholder}
                    onChange={(e) => setNewField(prev => ({ ...prev, placeholder: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Enter your name"
                  />
                </div>
              </div>

              {newField.field_type === 'select' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Options (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newOptionsRaw}
                    onChange={(e) => setNewOptionsRaw(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Option 1, Option 2, Option 3"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="new-field-required"
                  checked={newField.is_required}
                  onChange={(e) => setNewField(prev => ({ ...prev, is_required: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="new-field-required" className="text-sm text-gray-700">
                  Required field
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowAddField(false);
                    setNewOptionsRaw('');
                    setNewField(getInitialNewField());
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddField}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  {saving ? 'Adding...' : 'Add Field'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormFieldEditor;