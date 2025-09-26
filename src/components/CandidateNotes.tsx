import React, { useState, useEffect } from 'react';
import { candidateNotesAPI } from '../services/api';
import { CandidateNote, CreateCandidateNote } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit, Trash2, Lock, Search } from 'lucide-react';

interface CandidateNotesProps {
  candidateId: number;
  candidateName: string;
}

const CandidateNotes: React.FC<CandidateNotesProps> = ({ candidateId, candidateName }) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<CandidateNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNote, setEditingNote] = useState<CandidateNote | null>(null);
  const [filters, setFilters] = useState({ noteType: '', userRole: '' });
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState<CreateCandidateNote>({
    noteType: 'General',
    content: '',
    isPrivate: false
  });

  useEffect(() => {
    loadNotes();
  }, [candidateId, filters]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const response = await candidateNotesAPI.getNotes(candidateId, filters);
      setNotes(response.data?.notes || []);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await candidateNotesAPI.addNote(candidateId, formData);
      setFormData({ noteType: 'General', content: '', isPrivate: false });
      setShowAddForm(false);
      loadNotes();
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  const handleUpdateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;

    try {
      await candidateNotesAPI.updateNote(editingNote.id, {
        content: formData.content,
        isPrivate: formData.isPrivate
      });
      setEditingNote(null);
      setFormData({ noteType: 'General', content: '', isPrivate: false });
      loadNotes();
    } catch (error) {
      console.error('Failed to update note:', error);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;

    try {
      await candidateNotesAPI.deleteNote(noteId);
      loadNotes();
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const startEdit = (note: CandidateNote) => {
    setEditingNote(note);
    setFormData({
      noteType: note.note_type,
      content: note.content,
      isPrivate: note.is_private
    });
  };

  const cancelEdit = () => {
    setEditingNote(null);
    setFormData({ noteType: 'General', content: '', isPrivate: false });
  };

  const canEditNote = (note: CandidateNote) => {
    return note.user_id === user?.id || user?.role === 'Admin' || user?.role === 'HR Manager';
  };

  const canViewPrivateNote = (note: CandidateNote) => {
    return !note.is_private || note.user_id === user?.id || user?.role === 'Admin' || user?.role === 'HR Manager';
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         note.user_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const canView = canViewPrivateNote(note);
    return matchesSearch && canView;
  });

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-red-100 text-red-800';
      case 'HR Manager': return 'bg-purple-100 text-purple-800';
      case 'Interviewer': return 'bg-blue-100 text-blue-800';
      case 'Recruiter': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getNoteTypeColor = (type: string) => {
    switch (type) {
      case 'Pre-Interview': return 'bg-yellow-100 text-yellow-800';
      case 'Interview': return 'bg-blue-100 text-blue-800';
      case 'Post-Interview': return 'bg-green-100 text-green-800';
      case 'General': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Notes for {candidateName}</h3>
          <p className="text-sm text-gray-500">Multi-user notes and feedback</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          <span>Add Note</span>
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={filters.noteType}
            onChange={(e) => setFilters(prev => ({ ...prev, noteType: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300"
          >
            <option value="">All Types</option>
            <option value="Pre-Interview">Pre-Interview</option>
            <option value="Interview">Interview</option>
            <option value="Post-Interview">Post-Interview</option>
            <option value="General">General</option>
          </select>
          <select
            value={filters.userRole}
            onChange={(e) => setFilters(prev => ({ ...prev, userRole: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300"
          >
            <option value="">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="HR Manager">HR Manager</option>
            <option value="Interviewer">Interviewer</option>
            <option value="Recruiter">Recruiter</option>
          </select>
        </div>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingNote) && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">
            {editingNote ? 'Edit Note' : 'Add New Note'}
          </h4>
          <form onSubmit={editingNote ? handleUpdateNote : handleAddNote} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note Type</label>
                <select
                  value={formData.noteType}
                  onChange={(e) => setFormData(prev => ({ ...prev, noteType: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300"
                  required
                >
                  <option value="General">General</option>
                  <option value="Pre-Interview">Pre-Interview</option>
                  <option value="Interview">Interview</option>
                  <option value="Post-Interview">Post-Interview</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPrivate"
                  checked={formData.isPrivate}
                  onChange={(e) => setFormData(prev => ({ ...prev, isPrivate: e.target.checked }))}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="isPrivate" className="text-sm font-medium text-gray-700">
                  Private note (only visible to Admin/HR Manager)
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300"
                placeholder="Enter your note here..."
                required
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={editingNote ? cancelEdit : () => setShowAddForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {editingNote ? 'Update Note' : 'Add Note'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Notes List */}
      <div className="space-y-4">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No notes found for this candidate.</p>
          </div>
        ) : (
          filteredNotes.map((note) => (
            <div key={note.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getNoteTypeColor(note.note_type)}`}>
                      {note.note_type}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(note.user_role)}`}>
                      {note.user_role}
                    </span>
                    {note.is_private && (
                      <span className="flex items-center text-xs text-gray-500">
                        <Lock size={12} className="mr-1" />
                        Private
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    {new Date(note.created_at).toLocaleDateString()}
                  </span>
                  {canEditNote(note) && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => startEdit(note)}
                        className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-gray-700">
                <p className="whitespace-pre-wrap">{note.content}</p>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>By {note.user_name || 'Unknown User'}</span>
                  {note.updated_at !== note.created_at && (
                    <span>Updated {new Date(note.updated_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CandidateNotes;
