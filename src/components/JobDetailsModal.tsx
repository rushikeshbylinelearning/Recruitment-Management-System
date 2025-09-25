import React from 'react';
import { X, MapPin, Calendar, Users, Briefcase, Clock, ExternalLink } from 'lucide-react';
import { JobPosting } from '../types';

interface JobDetailsModalProps {
  job: JobPosting;
  onClose: () => void;
  onEdit: (job: JobPosting) => void;
}

export default function JobDetailsModal({ job, onClose, onEdit }: JobDetailsModalProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Paused': return 'bg-yellow-100 text-yellow-800';
      case 'Closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
              <Briefcase className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">{job.title}</h2>
              <div className="flex items-center space-x-3 mt-1">
                <p className="text-gray-600">{job.department}</p>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                  {job.status}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3">
              <MapPin className="text-gray-400" size={20} />
              <div>
                <p className="text-sm text-gray-600">Location</p>
                <p className="font-medium text-gray-900">{job.location}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Briefcase className="text-gray-400" size={20} />
              <div>
                <p className="text-sm text-gray-600">Job Type</p>
                <p className="font-medium text-gray-900">{job.jobType}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Calendar className="text-gray-400" size={20} />
              <div>
                <p className="text-sm text-gray-600">Posted Date</p>
                <p className="font-medium text-gray-900">{new Date(job.postedDate).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Clock className="text-gray-400" size={20} />
              <div>
                <p className="text-sm text-gray-600">Deadline</p>
                <p className="font-medium text-gray-900">{new Date(job.deadline).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Description</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
            </div>
          </div>

          {/* Requirements */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Requirements</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <ul className="space-y-2">
                {job.requirements.map((requirement, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                    <span className="text-gray-700">{requirement}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Team Assignment */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Assigned Team</h3>
            <div className="flex flex-wrap gap-2">
              {job.assignedTo.map((member, index) => (
                <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  {member}
                </span>
              ))}
            </div>
          </div>

          {/* Job Portals */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Portals</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {job.portals.map((portal, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{portal.name}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      portal.status === 'Posted' ? 'bg-green-100 text-green-800' :
                      portal.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {portal.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Users size={14} />
                      <span>{portal.applicants} applicants</span>
                    </div>
                    <button className="flex items-center space-x-1 text-blue-600 hover:text-blue-800">
                      <ExternalLink size={14} />
                      <span>View</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Statistics */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Application Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{job.applicantCount}</p>
                <p className="text-sm text-gray-600">Total Applications</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">
                  {job.portals.reduce((sum, portal) => sum + portal.applicants, 0)}
                </p>
                <p className="text-sm text-gray-600">Portal Applications</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-600">{job.portals?.length || 0}</p>
                <p className="text-sm text-gray-600">Active Portals</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
          <button 
            onClick={() => onEdit(job)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Edit Job
          </button>
        </div>
      </div>
    </div>
  );
}