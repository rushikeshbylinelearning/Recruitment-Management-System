import { 
  X, MapPin, Calendar, Users, Briefcase, Clock, ExternalLink, 
  FileText, CheckCircle2, UserPlus, TrendingUp, Globe, AlertCircle 
} from 'lucide-react';
import { JobPosting } from '../types';
import { formatToDDMMYYYY } from '../utils/dateFormatter';
import '../styles/JobModalAnimations.css';

interface JobDetailsModalProps {
  job: JobPosting;
  onClose: () => void;
  onEdit: (job: JobPosting) => void;
  /** When false, hides "Edit Job" (e.g. HR Intern with jobs view + bulk import only). */
  allowEdit?: boolean;
}

export default function JobDetailsModal({ job, onClose, onEdit, allowEdit = true }: JobDetailsModalProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Paused': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Closed': return 'bg-slate-50 text-slate-700 border-slate-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getPortalStatusColor = (status: string) => {
    switch (status) {
      case 'Posted': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Draft': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Expired': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const totalPortalApplicants = job.portals.reduce((sum, portal) => sum + portal.applicants, 0);

  return (
    <div className="jm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="jm-details-panel-modern jm-panel">
        {/* Modern Header */}
        <div className="px-6 pt-6 pb-5 border-b border-slate-200/80">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4 flex-1 min-w-0">
              {/* Job Icon */}
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
                <Briefcase className="text-white" size={26} strokeWidth={2} />
              </div>
              
              {/* Title & Meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-slate-900 leading-tight">{job.title}</h2>
                  <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${getStatusColor(job.status)} flex-shrink-0`}>
                    {job.status}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-600">{job.department}</p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="ml-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all p-2 rounded-lg flex-shrink-0"
              aria-label="Close modal"
            >
              <X size={20} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
          {/* Quick Info Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3.5 hover:bg-slate-100/80 transition-colors">
              <div className="flex items-center gap-2.5 mb-1.5">
                <MapPin className="text-slate-500" size={16} strokeWidth={2} />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Location</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">{job.location}</p>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3.5 hover:bg-slate-100/80 transition-colors">
              <div className="flex items-center gap-2.5 mb-1.5">
                <Briefcase className="text-slate-500" size={16} strokeWidth={2} />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Job Type</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">{job.jobType}</p>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3.5 hover:bg-slate-100/80 transition-colors">
              <div className="flex items-center gap-2.5 mb-1.5">
                <Calendar className="text-slate-500" size={16} strokeWidth={2} />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Posted</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">{formatToDDMMYYYY(job.postedDate)}</p>
            </div>

            <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3.5 hover:bg-slate-100/80 transition-colors">
              <div className="flex items-center gap-2.5 mb-1.5">
                <Clock className="text-slate-500" size={16} strokeWidth={2} />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Deadline</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">{formatToDDMMYYYY(job.deadline)}</p>
            </div>
          </div>

          {/* Application Statistics - Compact */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200/60 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <TrendingUp className="text-blue-600" size={18} strokeWidth={2} />
              </div>
              <p className="text-2xl font-bold text-blue-700 mb-0.5">{job.applicantCount}</p>
              <p className="text-xs font-medium text-blue-600/80">Total Applications</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200/60 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <Users className="text-emerald-600" size={18} strokeWidth={2} />
              </div>
              <p className="text-2xl font-bold text-emerald-700 mb-0.5">{totalPortalApplicants}</p>
              <p className="text-xs font-medium text-emerald-600/80">Portal Applications</p>
            </div>

            <div className="bg-gradient-to-br from-violet-50 to-violet-100/50 border border-violet-200/60 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <Globe className="text-violet-600" size={18} strokeWidth={2} />
              </div>
              <p className="text-2xl font-bold text-violet-700 mb-0.5">{job.portals?.length || 0}</p>
              <p className="text-xs font-medium text-violet-600/80">Active Portals</p>
            </div>
          </div>

          {/* Job Description */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-3">
              <FileText className="text-slate-600" size={18} strokeWidth={2} />
              <h3 className="text-base font-bold text-slate-900">Job Description</h3>
            </div>
            <div className="prose prose-sm max-w-none">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{job.description}</p>
            </div>
          </div>

          {/* Requirements */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-3">
              <CheckCircle2 className="text-slate-600" size={18} strokeWidth={2} />
              <h3 className="text-base font-bold text-slate-900">Requirements</h3>
            </div>
            <ul className="space-y-2.5">
              {job.requirements.map((requirement, index) => (
                <li key={index} className="flex items-start gap-3 group">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0 group-hover:scale-125 transition-transform"></span>
                  <span className="text-sm text-slate-700 leading-relaxed">{requirement}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Assigned Team */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-3">
              <UserPlus className="text-slate-600" size={18} strokeWidth={2} />
              <h3 className="text-base font-bold text-slate-900">Assigned Team</h3>
            </div>
            {job.assignedTo && job.assignedTo.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {job.assignedTo.map((member, index) => (
                  <span 
                    key={index} 
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                  >
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {member.charAt(0).toUpperCase()}
                    </div>
                    {member}
                  </span>
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center">
                <AlertCircle className="text-slate-400 mx-auto mb-2" size={32} strokeWidth={1.5} />
                <p className="text-sm font-medium text-slate-600 mb-3">No team assigned yet</p>
                <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors">
                  Assign Team
                </button>
              </div>
            )}
          </div>

          {/* Job Portals */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <Globe className="text-slate-600" size={18} strokeWidth={2} />
              <h3 className="text-base font-bold text-slate-900">Job Portals</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {job.portals.map((portal, index) => (
                <div 
                  key={index} 
                  className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-4 hover:shadow-md hover:border-slate-300 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-gradient-to-br from-slate-200 to-slate-300 rounded-lg flex items-center justify-center">
                        <Globe className="text-slate-600" size={16} strokeWidth={2} />
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">{portal.name}</h4>
                    </div>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${getPortalStatusColor(portal.status)}`}>
                      {portal.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Users size={14} strokeWidth={2} />
                      <span className="text-sm font-semibold">{portal.applicants}</span>
                      <span className="text-xs text-slate-500">applicants</span>
                    </div>
                    <button className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium group-hover:gap-2 transition-all">
                      <span>View</span>
                      <ExternalLink size={14} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="px-6 py-4 border-t border-slate-200/80 bg-slate-50/50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all font-medium text-sm"
          >
            Close
          </button>
          {allowEdit && (
            <button
              onClick={() => onEdit(job)}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium text-sm shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30"
            >
              Edit Job
            </button>
          )}
        </div>
      </div>
    </div>
  );
}