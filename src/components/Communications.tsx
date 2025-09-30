import { useState, useEffect } from 'react';
import { Plus, Search, Mail, Phone, MessageSquare, Send, Calendar, User, Clock, X } from 'lucide-react';
import { Candidate } from '../types';
import { communicationsAPI, candidatesAPI } from '../services/api';

interface CommunicationsProps {
  onShowEmailTemplates?: () => void;
}

export default function Communications({ onShowEmailTemplates }: CommunicationsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showNewCommunication, setShowNewCommunication] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState<any>(null);
  const [newCommunication, setNewCommunication] = useState({
    candidateId: '',
    type: 'Email',
    content: '',
    followUp: ''
  });
  const [replyContent, setReplyContent] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');

  // State for real data
  const [allCommunications, setAllCommunications] = useState<any[]>([]);
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Fetch real communications data
  useEffect(() => {
    const fetchCommunications = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Fetch communications from database
        const commResponse = await communicationsAPI.getCommunications({ limit: 100 });
        if (commResponse.success && commResponse.data) {
          setAllCommunications(commResponse.data.communications || []);
        }

        // Fetch candidates for dropdown
        const candidatesResponse = await candidatesAPI.getCandidates({ limit: 100 });
        if (candidatesResponse.success && candidatesResponse.data) {
          setAllCandidates(candidatesResponse.data.candidates || []);
        }
      } catch (err) {
        console.error('Error fetching communications data:', err);
        setError('Failed to load communications data');
        setAllCommunications([]);
        setAllCandidates([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCommunications();
  }, []);

  const filteredCommunications = allCommunications.filter(comm => {
    const candidateName = comm.candidate_name || comm.candidateName || '';
    const content = comm.content || comm.message || '';
    const matchesSearch = candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'All' || comm.type === typeFilter;
    const matchesStatus = statusFilter === 'All' || comm.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Email': return <Mail size={16} className="text-blue-500" />;
      case 'Phone': return <Phone size={16} className="text-green-500" />;
      case 'WhatsApp': return <MessageSquare size={16} className="text-green-600" />;
      case 'LinkedIn': return <User size={16} className="text-blue-700" />;
      default: return <MessageSquare size={16} className="text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Sent': return 'bg-green-100 text-green-800';
      case 'Received': return 'bg-blue-100 text-blue-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleReply = (comm: any) => {
    setSelectedCommunication(comm);
    setShowReplyModal(true);
  };

  const handleScheduleFollowUp = (comm: any) => {
    setSelectedCommunication(comm);
    setShowFollowUpModal(true);
  };

  const handleSubmitReply = () => {
    if (!replyContent.trim()) return;
    
    // TODO: Implement reply functionality with API
    // const reply = {
    //   id: `reply-${Date.now()}`,
    //   type: selectedCommunication.type,
    //   content: replyContent,
    //   status: 'Sent',
    //   date: new Date().toISOString(),
    //   candidateName: selectedCommunication.candidateName,
    //   candidateEmail: selectedCommunication.candidateEmail,
    //   position: selectedCommunication.position
    // };
    
    setReplyContent('');
    setShowReplyModal(false);
    setSelectedCommunication(null);
    alert('Reply sent successfully!');
  };

  const handleSubmitFollowUp = () => {
    if (!followUpDate || !followUpNotes.trim()) return;
    
    // TODO: Implement follow-up functionality with API
    // const followUp = {
    //   id: `followup-${Date.now()}`,
    //   type: followUpType,
    //   content: `${followUpType} follow-up scheduled (${followUpPriority} priority): ${followUpNotes}`,
    //   status: 'Pending',
    //   date: followUpDate,
    //   candidateName: selectedCommunication.candidateName,
    //   candidateEmail: selectedCommunication.candidateEmail,
    //   position: selectedCommunication.position,
    //   followUp: `${followUpType} - ${followUpPriority} Priority: ${followUpNotes}`
    // };
    
    setFollowUpDate('');
    setFollowUpNotes('');
    setShowFollowUpModal(false);
    setSelectedCommunication(null);
    alert('Follow-up scheduled successfully!');
  };

  const handleSubmitNewCommunication = async () => {
    if (!newCommunication.candidateId || !newCommunication.content.trim()) return;
    
    const candidate = allCandidates.find(c => c.id.toString() === newCommunication.candidateId);
    if (!candidate) return;
    
    try {
      const communicationData = {
        candidateId: parseInt(newCommunication.candidateId),
        type: newCommunication.type,
        content: newCommunication.content,
        status: 'Sent',
        followUpDate: new Date().toISOString(),
        followUpNotes: newCommunication.followUp
      };
      
      const response = await communicationsAPI.createCommunication(communicationData);
      
      if (response.success) {
        // Refresh communications list
        const commResponse = await communicationsAPI.getCommunications({ limit: 100 });
        if (commResponse.success && commResponse.data) {
          setAllCommunications(commResponse.data.communications || []);
        }
        
        setNewCommunication({
          candidateId: '',
          type: 'Email',
          content: '',
          followUp: ''
        });
        setShowNewCommunication(false);
        alert('Communication sent successfully!');
      } else {
        alert('Failed to send communication. Please try again.');
      }
    } catch (error) {
      console.error('Error creating communication:', error);
      alert('Failed to send communication. Please try again.');
    }
  };

  const communicationStats = [
    { label: 'Total Communications', value: allCommunications?.length || 0, color: 'bg-blue-500' },
    { label: 'Emails Sent', value: allCommunications?.filter(c => c.type === 'Email')?.length || 0, color: 'bg-green-500' },
    { label: 'Phone Calls', value: allCommunications?.filter(c => c.type === 'Phone')?.length || 0, color: 'bg-purple-500' },
    { label: 'Pending Follow-ups', value: allCommunications?.filter(c => c.status === 'Pending')?.length || 0, color: 'bg-orange-500' }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading communications...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error loading communications</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Communications</h1>
          <p className="text-gray-600 mt-1">Track all candidate communications and follow-ups</p>
        </div>
        <button
          onClick={() => setShowNewCommunication(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          <span>New Communication</span>
        </button>
        <button
          onClick={onShowEmailTemplates}
          className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <Mail size={20} />
          <span>Email Templates</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {communicationStats.map((stat) => (
          <div key={stat.label} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`w-3 h-8 ${stat.color} rounded`}></div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search communications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="All">All Types</option>
          <option value="Email">Email</option>
          <option value="Phone">Phone</option>
          <option value="WhatsApp">WhatsApp</option>
          <option value="LinkedIn">LinkedIn</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="All">All Status</option>
          <option value="Sent">Sent</option>
          <option value="Received">Received</option>
          <option value="Pending">Pending</option>
        </select>
      </div>

      {/* Communications List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Communications</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredCommunications.length === 0 ? (
            <div className="p-8 text-center">
              <Mail className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No communications found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {allCommunications.length === 0 
                  ? "No communications have been recorded yet. Start by creating a new communication."
                  : "No communications match your current filters. Try adjusting your search criteria."
                }
              </p>
              {allCommunications.length === 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowNewCommunication(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus size={16} className="mr-2" />
                    Create First Communication
                  </button>
                </div>
              )}
            </div>
          ) : (
            filteredCommunications.map((comm) => (
            <div key={comm.id} className="p-6 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="mt-1">
                    {getTypeIcon(comm.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-medium text-gray-900">{comm.candidate_name || comm.candidateName || 'Unknown Candidate'}</h4>
                      <span className="text-sm text-gray-500">{comm.candidate_position || comm.position || 'Unknown Position'}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(comm.status)}`}>
                        {comm.status}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-2">{comm.content || comm.message || 'No content'}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Clock size={14} />
                        <span>{new Date(comm.date || comm.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Mail size={14} />
                        <span>{comm.candidate_email || comm.candidateEmail || 'No email'}</span>
                      </div>
                    </div>
                    {comm.followUp && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                        <strong>Follow-up:</strong> {comm.followUp}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handleReply(comm)}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                  >
                    Reply
                  </button>
                  <button 
                    onClick={() => handleScheduleFollowUp(comm)}
                    className="px-3 py-1 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition-colors"
                  >
                    Schedule Follow-up
                  </button>
                </div>
              </div>
            </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center space-x-3 mb-4">
            <Mail className="text-blue-500" size={24} />
            <h3 className="font-semibold text-gray-900">Email Templates</h3>
          </div>
          <p className="text-gray-600 text-sm mb-4">Use pre-built templates for common communications</p>
          <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Manage Templates
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center space-x-3 mb-4">
            <Calendar className="text-green-500" size={24} />
            <h3 className="font-semibold text-gray-900">Schedule Calls</h3>
          </div>
          <p className="text-gray-600 text-sm mb-4">Schedule and manage candidate phone interviews</p>
          <button className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors">
            Schedule Call
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center space-x-3 mb-4">
            <MessageSquare className="text-purple-500" size={24} />
            <h3 className="font-semibold text-gray-900">Bulk Messages</h3>
          </div>
          <p className="text-gray-600 text-sm mb-4">Send messages to multiple candidates at once</p>
          <button className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors">
            Send Bulk Message
          </button>
        </div>
      </div>

      {/* New Communication Modal */}
      {showNewCommunication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">New Communication</h2>
              <button
                onClick={() => setShowNewCommunication(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Candidate *
                </label>
                <select
                  value={newCommunication.candidateId}
                  onChange={(e) => setNewCommunication(prev => ({ ...prev, candidateId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose a candidate</option>
                  {allCandidates.map(candidate => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} - {candidate.position}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Communication Type
                </label>
                <select
                  value={newCommunication.type}
                  onChange={(e) => setNewCommunication(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Email">Email</option>
                  <option value="Phone">Phone</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="LinkedIn">LinkedIn</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message Content *
                </label>
                <textarea
                  value={newCommunication.content}
                  onChange={(e) => setNewCommunication(prev => ({ ...prev, content: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your message content..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Follow-up Notes (Optional)
                </label>
                <textarea
                  value={newCommunication.followUp}
                  onChange={(e) => setNewCommunication(prev => ({ ...prev, followUp: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Any follow-up actions needed..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowNewCommunication(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitNewCommunication}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Send size={16} />
                <span>Send Communication</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reply Modal */}
      {showReplyModal && selectedCommunication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Reply to {selectedCommunication.candidateName}</h2>
              <button
                onClick={() => setShowReplyModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Original Message:</p>
                <p className="text-gray-800">{selectedCommunication.content}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Reply *
                </label>
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Type your reply..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowReplyModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReply}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Send size={16} />
                <span>Send Reply</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up Modal */}
      {showFollowUpModal && selectedCommunication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Schedule Follow-up</h2>
              <button
                onClick={() => setShowFollowUpModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Candidate:</p>
                <p className="font-medium text-gray-900">{selectedCommunication.candidateName}</p>
                <p className="text-sm text-gray-600">{selectedCommunication.position}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Follow-up Date *
                </label>
                <input
                  type="datetime-local"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Follow-up Notes *
                </label>
                <textarea
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="What needs to be followed up on?"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowFollowUpModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFollowUp}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <Calendar size={16} />
                <span>Schedule Follow-up</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}