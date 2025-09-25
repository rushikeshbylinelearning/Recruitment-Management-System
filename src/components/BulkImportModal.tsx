import React, { useState } from 'react';
import { X, Upload, Download, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { JobPosting } from '../types';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (candidates: any[]) => void;
  jobs: JobPosting[];
}

export default function BulkImportModal({ isOpen, onClose, onImport, jobs }: BulkImportModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };

  const handleFiles = (files: File[]) => {
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'));
    if (csvFile) {
      parseCSV(csvFile);
    }
  };

  const parseCSV = (file: File) => {
    setImportStatus('processing');
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const candidates = lines.slice(1)
          .filter(line => line.trim())
          .map((line, index) => {
            const values = line.split(',').map(v => v.trim());
            const candidate: any = { id: `import-${index}` };
            
            headers.forEach((header, i) => {
              const value = values[i] || '';
              switch (header) {
                case 'name':
                case 'full name':
                  candidate.name = value;
                  break;
                case 'email':
                case 'email address':
                  candidate.email = value;
                  break;
                case 'phone':
                case 'phone number':
                  candidate.phone = value;
                  break;
                case 'experience':
                case 'years of experience':
                  candidate.experience = value;
                  break;
                case 'skills':
                  candidate.skills = value.split(';').map(s => s.trim()).filter(Boolean);
                  break;
                case 'source':
                  candidate.source = value || 'Bulk Import';
                  break;
                case 'notes':
                  candidate.notes = value;
                  break;
                default:
                  candidate[header] = value;
              }
            });
            
            // Set defaults
            candidate.stage = 'Applied';
            candidate.appliedDate = new Date().toISOString();
            candidate.score = 0;
            candidate.communications = [];
            
            return candidate;
          });
        
        setImportData(candidates);
        setImportStatus('success');
      } catch (error) {
        setImportStatus('error');
      }
    };
    
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!selectedJob || (importData?.length || 0) === 0) return;
    
    const selectedJobData = jobs.find(job => job.id === selectedJob);
    const candidatesWithJob = importData.map(candidate => ({
      ...candidate,
      jobId: selectedJob,
      position: selectedJobData?.title || '',
      assignedTo: selectedJobData?.assignedTo[0] || 'Unassigned'
    }));
    
    onImport(candidatesWithJob);
    
    // Reset state
    setImportData([]);
    setSelectedJob('');
    setImportStatus('idle');
    onClose();
  };

  const downloadTemplate = () => {
    const csvContent = 'Name,Email,Phone,Experience,Skills,Source,Notes\n' +
                      'John Doe,john@example.com,+1-555-0123,5 years,React;TypeScript;Node.js,LinkedIn,Strong technical background\n' +
                      'Jane Smith,jane@example.com,+1-555-0124,3 years,Python;Django;PostgreSQL,Indeed,Good problem-solving skills';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidate-import-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Bulk Import Candidates</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Template Download */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-blue-900">Download CSV Template</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Use our template to format your candidate data correctly
                </p>
              </div>
              <button
                onClick={downloadTemplate}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download size={16} />
                <span>Download</span>
              </button>
            </div>
          </div>

          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Drop your CSV file here
            </h3>
            <p className="text-gray-600 mb-4">
              or click to browse and select a file
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <FileText size={16} />
              <span>Choose File</span>
            </label>
          </div>

          {/* Import Status */}
          {importStatus === 'processing' && (
            <div className="flex items-center space-x-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600"></div>
              <span className="text-yellow-800">Processing file...</span>
            </div>
          )}

          {importStatus === 'error' && (
            <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="text-red-600" size={20} />
              <span className="text-red-800">Error processing file. Please check the format and try again.</span>
            </div>
          )}

          {importStatus === 'success' && (importData?.length || 0) > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="text-green-600" size={20} />
                <span className="text-green-800">
                  Successfully parsed {importData?.length || 0} candidates
                </span>
              </div>

              {/* Job Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Job Position *
                </label>
                <select
                  value={selectedJob}
                  onChange={(e) => setSelectedJob(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose a job position</option>
                  {jobs.filter(job => job.status === 'Active').map(job => (
                    <option key={job.id} value={job.id}>
                      {job.title} - {job.department}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Preview (first 3 candidates)</h4>
                <div className="space-y-2">
                  {importData.slice(0, 3).map((candidate, index) => (
                    <div key={index} className="bg-white p-3 rounded border text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span><strong>Name:</strong> {candidate.name}</span>
                        <span><strong>Email:</strong> {candidate.email}</span>
                        <span><strong>Phone:</strong> {candidate.phone}</span>
                        <span><strong>Experience:</strong> {candidate.experience}</span>
                      </div>
                    </div>
                  ))}
                  {importData.length > 3 && (
                    <p className="text-gray-600 text-center">
                      ... and {importData.length - 3} more candidates
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!selectedJob || importData.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Upload size={16} />
              <span>Import {importData.length} Candidates</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}