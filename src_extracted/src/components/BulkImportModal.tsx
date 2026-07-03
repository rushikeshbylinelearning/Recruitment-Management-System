import React, { useState } from 'react';
import { X, Upload, Download, FileText, AlertCircle, CheckCircle, Sheet } from 'lucide-react';
import { JobPosting } from '../types';
import * as XLSX from 'xlsx';
import { parseDDMMYYYY as parseDateUtil } from '../utils/dateFormatter';

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
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [sheetJobMappings, setSheetJobMappings] = useState<{[sheetName: string]: string}>({});
  const [workbookData, setWorkbookData] = useState<XLSX.WorkBook | null>(null);
  const [allSheetsData, setAllSheetsData] = useState<{[sheetName: string]: any[]}>({});

  // Reset state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setImportData([]);
      setSelectedJob('');
      setImportStatus('idle');
      setAvailableSheets([]);
      setSelectedSheet('');
      setSheetJobMappings({});
      setWorkbookData(null);
      setAllSheetsData({});
    }
  }, [isOpen]);

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
    const file = files.find(f => 
      f.type === 'text/csv' || 
      f.name.endsWith('.csv') ||
      f.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      f.name.endsWith('.xlsx') ||
      f.type === 'application/vnd.ms-excel' ||
      f.name.endsWith('.xls')
    );
    
    if (file) {
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        parseCSV(file);
      } else {
        parseExcel(file);
      }
    }
  };

  // Helper function to parse CSV line with proper comma handling
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add the last field
    result.push(current.trim());
    return result;
  };

  const parseCSV = (file: File) => {
    setImportStatus('processing');
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
        
        const candidates = lines.slice(1)
          .filter(line => line.trim())
          .map((line, index) => {
            const values = parseCSVLine(line);
            const candidate: any = { id: `import-${index}` };
            
            headers.forEach((header, i) => {
              const value = values[i] || '';
              switch (header) {
                case 'date':
                case 'applied date':
                  const parsedDate = parseDateUtil(value);
                  candidate.appliedDate = parsedDate ? parsedDate.toISOString() : new Date().toISOString();
                  break;
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
                case 'phone no':
                  candidate.phone = value;
                  break;
                case 'location':
                  candidate.location = value;
                  break;
                case 'experience':
                case 'years of experience':
                  candidate.experience = value;
                  break;
                case 'expertise':
                  candidate.expertise = value;
                  break;
                case 'notice period':
                  candidate.noticePeriod = value;
                  break;
                case 'willing to work on alternate saturday':
                  candidate.willingAlternateSaturday = value.toLowerCase() === 'yes' ? true : 
                                                      value.toLowerCase() === 'no' ? false : null;
                  break;
                case 'work preference':
                  candidate.workPreference = value;
                  break;
                case 'current ctc':
                  candidate.currentCtc = value;
                  break;
                case 'ctc frequency':
                  candidate.ctcFrequency = value;
                  break;
                case 'expected ctc':
                  candidate.expectedSalary = value;
                  break;
                case 'in house assignment':
                  candidate.inHouseAssignmentStatus = value;
                  break;
                case 'interview date':
                  // Parse interview date in DD/MM/YYYY format and store as YYYY-MM-DD for input fields
                  const parsedInterviewDate = parseDateUtil(value);
                  candidate.interviewDate = parsedInterviewDate 
                    ? parsedInterviewDate.toISOString().split('T')[0] 
                    : '';
                  break;
                case 'interviewer':
                case 'interviewer name':
                  candidate.interviewerName = value;
                  break;
                case 'in office assignment':
                  candidate.inOfficeAssignment = value;
                  break;
                case 'hr remarks':
                case 'notes':
                  candidate.notes = value;
                  break;
                case 'skills':
                  candidate.skills = value.split(';').map(s => s.trim()).filter(Boolean);
                  break;
                case 'source':
                  candidate.source = value || 'Bulk Import';
                  break;
                case 'status':
                  candidate.stage = value || 'Applied';
                  break;
                case 'resume location/link':
                  candidate.resumeLocation = value;
                  break;
                case 'assignment location/link':
                  candidate.assignmentLocation = value;
                  break;
                default:
                  candidate[header] = value;
              }
            });
            
            // Set defaults
            candidate.stage = candidate.stage || 'Applied';
            candidate.appliedDate = candidate.appliedDate || new Date().toISOString();
            candidate.score = 0;
            candidate.communications = [];
            candidate.salaryNegotiable = false;
            candidate.immediateJoiner = false;
            candidate.joiningTime = candidate.joiningTime || '';
            
            return candidate;
          })
          .filter(candidate => {
            // Only include candidates that have at least name or email
            return candidate.name || candidate.email;
          });
        
        setImportData(candidates);
        setImportStatus('success');
      } catch (error) {
        console.error('CSV parsing error:', error);
        setImportStatus('error');
      }
    };
    
    reader.readAsText(file);
  };

  const parseExcel = (file: File) => {
    setImportStatus('processing');
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get all sheet names
        const sheetNames = workbook.SheetNames;
        setAvailableSheets(sheetNames);
        setWorkbookData(workbook);
        
        if (sheetNames.length === 1) {
          // Single sheet - auto-select and parse
          setSelectedSheet(sheetNames[0]);
          parseSheet(workbook, sheetNames[0]);
        } else {
          // Multiple sheets - show sheet selection
          setImportStatus('success');
          setImportData([]);
        }
      } catch (error) {
        console.error('Excel parsing error:', error);
        setImportStatus('error');
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  const parseSheet = (workbook: XLSX.WorkBook, sheetName: string) => {
    try {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        setImportStatus('error');
        return;
      }
      
      const headers = (jsonData[0] as string[]).map(h => h?.toString().trim().toLowerCase() || '');
      const rows = jsonData.slice(1) as string[][];
      
      const candidates = rows
        .map((row, index) => {
          const candidate: any = { id: `import-${index}` };
          
          headers.forEach((header, i) => {
            const value = (row[i] || '').toString().trim();
            switch (header) {
              case 'date':
              case 'applied date':
                const parsedDate = parseDateUtil(value);
                candidate.appliedDate = parsedDate ? parsedDate.toISOString() : new Date().toISOString();
                break;
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
              case 'phone no':
                candidate.phone = value;
                break;
              case 'location':
                candidate.location = value;
                break;
              case 'experience':
              case 'years of experience':
                candidate.experience = value;
                break;
              case 'expertise':
                candidate.expertise = value;
                break;
              case 'notice period':
                candidate.noticePeriod = value;
                break;
              case 'willing to work on alternate saturday':
                candidate.willingAlternateSaturday = value.toLowerCase() === 'yes' ? true : 
                                                    value.toLowerCase() === 'no' ? false : null;
                break;
              case 'work preference':
                candidate.workPreference = value;
                break;
              case 'current ctc':
                candidate.currentCtc = value;
                break;
              case 'ctc frequency':
                candidate.ctcFrequency = value || 'Annual';
                break;
              case 'expected ctc':
                candidate.expectedSalary = value;
                break;
              case 'in house assignment':
                candidate.inHouseAssignmentStatus = value;
                break;
              case 'interview date':
                // Parse interview date in DD/MM/YYYY format and store as YYYY-MM-DD for input fields
                const parsedInterviewDate = parseDateUtil(value);
                candidate.interviewDate = parsedInterviewDate 
                  ? parsedInterviewDate.toISOString().split('T')[0] 
                  : '';
                break;
              case 'interviewer':
              case 'interviewer name':
                candidate.interviewerName = value;
                break;
              case 'in office assignment':
                candidate.inOfficeAssignment = value;
                break;
              case 'hr remarks':
              case 'notes':
                candidate.notes = value;
                break;
              case 'skills':
                candidate.skills = value ? value.split(';').map(s => s.trim()).filter(Boolean) : [];
                break;
              case 'source':
                candidate.source = value || 'Bulk Import';
                break;
              case 'status':
                candidate.stage = value || 'Applied';
                break;
              case 'resume location/link':
                candidate.resumeLocation = value;
                break;
              case 'assignment location/link':
                candidate.assignmentLocation = value;
                break;
              default:
                candidate[header] = value;
            }
          });
          
          // Set defaults
          candidate.stage = candidate.stage || 'Applied';
          candidate.appliedDate = candidate.appliedDate || new Date().toISOString();
          candidate.score = 0;
          candidate.communications = [];
          candidate.salaryNegotiable = false;
          candidate.immediateJoiner = false;
          candidate.joiningTime = candidate.joiningTime || '';
          
          return candidate;
        })
        .filter(candidate => {
          // Only include candidates that have at least name or email
          return candidate.name || candidate.email;
        });
      
      setImportData(candidates);
      setAllSheetsData(prev => ({
        ...prev,
        [sheetName]: candidates
      }));
      setImportStatus('success');
    } catch (error) {
      console.error('Sheet parsing error:', error);
      setImportStatus('error');
    }
  };

  const handleSheetSelect = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbookData) {
      parseSheet(workbookData, sheetName);
    }
  };

  const handleSheetJobMapping = (sheetName: string, jobId: string) => {
    setSheetJobMappings(prev => ({
      ...prev,
      [sheetName]: jobId
    }));
    
    // Automatically parse the sheet when job is mapped
    if (jobId && workbookData && !allSheetsData[sheetName]) {
      parseSheet(workbookData, sheetName);
    }
  };

  const handleImportAllSheets = () => {
    const allCandidates: any[] = [];
    
    // Collect all candidates from all mapped sheets
    Object.keys(sheetJobMappings).forEach(sheetName => {
      const jobId = sheetJobMappings[sheetName];
      const sheetCandidates = allSheetsData[sheetName] || [];
      
      if (jobId && sheetCandidates.length > 0) {
        const selectedJobData = jobs.find(job => job.id.toString() === jobId);
        const candidatesWithJob = sheetCandidates.map(candidate => ({
          ...candidate,
          jobId: parseInt(jobId),
          position: selectedJobData?.title || '',
          assignedTo: selectedJobData?.assignedTo?.[0] || 1,
          source: `${candidate.source || 'Bulk Import'} (${sheetName})`
        }));
        
        allCandidates.push(...candidatesWithJob);
      }
    });
    
    if (allCandidates.length > 0) {
      onImport(allCandidates);
      onClose();
    }
  };

  const handleImport = () => {
    if (!selectedJob || (importData?.length || 0) === 0) return;
    
    // For Excel files with sheet mapping, use the mapped job
    let jobId = selectedJob;
    if (selectedSheet && sheetJobMappings[selectedSheet]) {
      jobId = sheetJobMappings[selectedSheet];
    }
    
    const selectedJobData = jobs.find(job => job.id.toString() === jobId);
    const candidatesWithJob = importData.map(candidate => ({
      ...candidate,
      jobId: parseInt(jobId),
      position: selectedJobData?.title || '',
      assignedTo: selectedJobData?.assignedTo?.[0] || 1 // Default to admin user ID 1
    }));
    
    onImport(candidatesWithJob);
    
    // Reset state
    setImportData([]);
    setSelectedJob('');
    setImportStatus('idle');
    onClose();
  };

  const downloadTemplate = () => {
    // Helper function to escape CSV field
    const escapeCSVField = (field: string): string => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        // Escape quotes by doubling them and wrap in quotes
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const headers = [
      'Date',
      'Name',
      'Email',
      'Phone No',
      'Location',
      'Experience',
      'Expertise',
      'Notice Period',
      'Willing to work on Alternate Saturday',
      'Work Preference',
      'Current CTC',
      'CTC Frequency',
      'Expected CTC',
      'In House Assignment',
      'Interview Date',
      'Interviewer Name',
      'In Office Assignment',
      'HR Remarks',
      'Skills',
      'Source',
      'Status',
      'Resume Location/Link',
      'Assignment Location/Link'
    ];

    // Sample data with proper comma escaping
    const sampleData = [
      [
        '2025-01-24',
        'John Doe',
        'john@example.com',
        '8888888888',
        'New York',
        '5 years',
        'Frontend Development',
        '2 weeks',
        'Yes',
        'Hybrid',
        '8LPA',
        'Annual',
        '10LPA',
        'Pending',
        '2025-02-01',
        'John Smith',
        'Complete a React component with state management, API integration, and responsive design. Include error handling and loading states.',
        'Strong technical background with excellent communication skills. Previous experience with React and TypeScript.',
        'React;TypeScript;Node.js;JavaScript',
        'LinkedIn',
        'Applied',
        'https://example.com/resumes/john_doe_resume.pdf',
        'https://example.com/assignments/frontend_assignment.pdf'
      ],
      [
        '2025-01-24',
        'Jane Smith',
        'jane@example.com',
        '8888888888',
        'San Francisco',
        '3 years',
        'Backend Development',
        '1 month',
        'No',
        'Onsite',
        '7LPA',
        'Annual',
        '9LPA',
        'Shortlisted',
        '2025-02-05',
        'Jane Doe',
        'Design and implement a REST API with authentication, database integration, and unit tests.',
        'Good problem-solving skills, works well in team environments. Has experience with Python and Django.',
        'Python;Django;PostgreSQL;REST APIs',
        'Indeed',
        'Screening',
        'https://example.com/resumes/jane_smith_resume.pdf',
        'https://example.com/assignments/backend_assignment.pdf'
      ]
    ];

    // Create CSV content
    let csvContent = headers.join(',') + '\n';
    
    sampleData.forEach(row => {
      const escapedRow = row.map(field => escapeCSVField(field));
      csvContent += escapedRow.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidate-import-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
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
              Drop your CSV or Excel file here
            </h3>
            <p className="text-gray-600 mb-4">
              Supports CSV files or Excel files (.xlsx, .xls) with multiple sheets
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
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

          {/* Sheet Selection for Excel files */}
          {importStatus === 'success' && availableSheets.length > 1 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Sheet className="text-blue-600" size={20} />
                <span className="text-blue-800">
                  Found {availableSheets.length} sheets in your Excel file. Please select which sheet to import and map it to a job.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableSheets.map(sheetName => (
                  <div key={sheetName} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sheet size={16} />
                        {sheetName}
                      </div>
                      {allSheetsData[sheetName] && (
                        <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          {allSheetsData[sheetName].length} candidates
                        </span>
                      )}
                    </h4>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Map to Job Position
                      </label>
                      <select
                        value={sheetJobMappings[sheetName] || ''}
                        onChange={(e) => handleSheetJobMapping(sheetName, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="">Select job position</option>
                        {jobs.filter(job => job.status === 'Active').map(job => (
                          <option key={job.id} value={job.id}>
                            {job.title} - {job.department}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => handleSheetSelect(sheetName)}
                      disabled={!sheetJobMappings[sheetName]}
                      className="mt-3 w-full bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      Import This Sheet
                    </button>
                  </div>
                ))}
              </div>
              
              {/* Import All Sheets Button */}
              {Object.keys(sheetJobMappings).filter(sheetName => sheetJobMappings[sheetName]).length > 0 && (
                <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-green-900">Import All Mapped Sheets</h4>
                      <p className="text-sm text-green-700 mt-1">
                        Import candidates from all sheets that have job mappings assigned
                      </p>
                    </div>
                    <button
                      onClick={handleImportAllSheets}
                      className="flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      <Upload size={16} />
                      <span>
                        Import All Sheets (
                        {Object.keys(sheetJobMappings).reduce((total, sheetName) => {
                          return total + (allSheetsData[sheetName]?.length || 0);
                        }, 0)} candidates)
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {importStatus === 'success' && (importData?.length || 0) > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="text-green-600" size={20} />
                <span className="text-green-800">
                  Successfully parsed {importData?.length || 0} candidates from {selectedSheet || 'file'}
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
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="text-blue-600" size={24} />
                    Preview (first 2 candidates)
                  </h4>
                  <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                    {importData.length} total candidates
                  </div>
                </div>
                
                <div className="space-y-6">
                  {importData.slice(0, 2).map((candidate, index) => (
                    <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      {/* Header */}
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-lg">
                                {candidate.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?'}
                              </span>
                            </div>
                            <div>
                              <h5 className="text-white font-semibold text-lg">{candidate.name}</h5>
                              <p className="text-blue-100 text-sm">{candidate.position || 'Position not specified'}</p>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium mt-1 inline-block ${
                                candidate.stage === 'Applied' ? 'bg-blue-100 text-blue-800' :
                                candidate.stage === 'Screening' ? 'bg-yellow-100 text-yellow-800' :
                                candidate.stage === 'Interview' ? 'bg-orange-100 text-orange-800' :
                                candidate.stage === 'Offer' ? 'bg-purple-100 text-purple-800' :
                                candidate.stage === 'Hired' ? 'bg-green-100 text-green-800' :
                                candidate.stage === 'Rejected' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {candidate.stage || 'Applied'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-white text-sm opacity-90">Candidate #{index + 1}</div>
                            <div className="text-blue-100 text-xs">{candidate.source}</div>
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Personal Information */}
                          <div className="space-y-4">
                            <h6 className="font-semibold text-gray-900 text-sm uppercase tracking-wide border-b border-gray-200 pb-2">
                              Personal Information
                            </h6>
                            <div className="space-y-3">
                              <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div>
                                  <span className="text-gray-600 text-sm block">Email</span>
                                  <span className="text-gray-900 font-medium">{candidate.email}</span>
                                </div>
                              </div>
                              <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div>
                                  <span className="text-gray-600 text-sm block">Phone</span>
                                  <span className="text-gray-900 font-medium">{candidate.phone}</span>
                                </div>
                              </div>
                              <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div>
                                  <span className="text-gray-600 text-sm block">Location</span>
                                  <span className="text-gray-900 font-medium">{candidate.location || 'Not specified'}</span>
                                </div>
                              </div>
                              <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div>
                                  <span className="text-gray-600 text-sm block">Experience</span>
                                  <span className="text-gray-900 font-medium">{candidate.experience}</span>
                                </div>
                              </div>
                              <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div>
                                  <span className="text-gray-600 text-sm block">Expertise</span>
                                  <span className="text-gray-900 font-medium">{candidate.expertise || 'Not specified'}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Work & Compensation */}
                          <div className="space-y-4">
                            <h6 className="font-semibold text-gray-900 text-sm uppercase tracking-wide border-b border-gray-200 pb-2">
                              Work & Compensation
                            </h6>
                            <div className="space-y-3">
                              <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div>
                                  <span className="text-gray-600 text-sm block">Work Preference</span>
                                  <span className="text-gray-900 font-medium">{candidate.workPreference || 'Not specified'}</span>
                                </div>
                              </div>
                              <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div>
                                  <span className="text-gray-600 text-sm block">Current CTC</span>
                                  <span className="text-gray-900 font-medium">{candidate.currentCtc || 'Not specified'}</span>
                                </div>
                              </div>
                              <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div>
                                  <span className="text-gray-600 text-sm block">Expected CTC</span>
                                  <span className="text-gray-900 font-medium">{candidate.expectedSalary || 'Not specified'}</span>
                                </div>
                              </div>
                              <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div>
                                  <span className="text-gray-600 text-sm block">Notice Period</span>
                                  <span className="text-gray-900 font-medium">{candidate.noticePeriod || 'Not specified'}</span>
                                </div>
                              </div>
                              <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div>
                                  <span className="text-gray-600 text-sm block">Alternate Saturday</span>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    candidate.willingAlternateSaturday === true ? 'bg-green-100 text-green-800' :
                                    candidate.willingAlternateSaturday === false ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {candidate.willingAlternateSaturday === true ? 'Yes' : 
                                     candidate.willingAlternateSaturday === false ? 'No' : 'Not specified'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Assignment Details */}
                          <div className="space-y-4">
                            <h6 className="font-semibold text-gray-900 text-sm uppercase tracking-wide border-b border-gray-200 pb-2">
                              Assignment Details
                            </h6>
                            <div className="space-y-3">
                              <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div>
                                  <span className="text-gray-600 text-sm block">In House Assignment</span>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    candidate.inHouseAssignmentStatus === 'Shortlisted' ? 'bg-green-100 text-green-800' :
                                    candidate.inHouseAssignmentStatus === 'Rejected' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {candidate.inHouseAssignmentStatus || 'Pending'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div>
                                  <span className="text-gray-600 text-sm block">Interview Date</span>
                                  <span className="text-gray-900 font-medium">
                                    {candidate.interviewDate ? new Date(candidate.interviewDate).toLocaleDateString() : 'Not scheduled'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div>
                                  <span className="text-gray-600 text-sm block">Interviewer Name</span>
                                  <span className="text-gray-900 font-medium">{candidate.interviewerName || 'Not assigned'}</span>
                                </div>
                              </div>
                              <div className="flex items-start gap-3">
                                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div>
                                  <span className="text-gray-600 text-sm block">Applied Date</span>
                                  <span className="text-gray-900 font-medium">
                                    {candidate.appliedDate ? new Date(candidate.appliedDate).toLocaleDateString() : 'Not specified'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Additional Information */}
                        {(candidate.notes || candidate.inOfficeAssignment || candidate.resumeLocation || candidate.assignmentLocation) && (
                          <div className="mt-6 pt-6 border-t border-gray-200">
                            <h6 className="font-semibold text-gray-900 text-sm uppercase tracking-wide border-b border-gray-200 pb-2 mb-4">
                              Additional Information
                            </h6>
                            <div className="space-y-4">
                              {candidate.notes && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                  <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <div className="flex-1">
                                      <span className="text-gray-600 text-sm font-medium block mb-2">HR Remarks</span>
                                      <p className="text-gray-800 leading-relaxed">{candidate.notes}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {candidate.inOfficeAssignment && (
                                <div className="bg-blue-50 rounded-lg p-4">
                                  <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <div className="flex-1">
                                      <span className="text-gray-600 text-sm font-medium block mb-2">In Office Assignment</span>
                                      <p className="text-gray-800 leading-relaxed">{candidate.inOfficeAssignment}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {candidate.resumeLocation && (
                                <div className="bg-green-50 rounded-lg p-4">
                                  <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <div className="flex-1">
                                      <span className="text-gray-600 text-sm font-medium block mb-2">Resume Location</span>
                                      <a href={candidate.resumeLocation} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-sm break-all">
                                        {candidate.resumeLocation}
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {candidate.assignmentLocation && (
                                <div className="bg-purple-50 rounded-lg p-4">
                                  <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <div className="flex-1">
                                      <span className="text-gray-600 text-sm font-medium block mb-2">Assignment Location</span>
                                      <a href={candidate.assignmentLocation} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-sm break-all">
                                        {candidate.assignmentLocation}
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Skills */}
                        {candidate.skills && candidate.skills.length > 0 && (
                          <div className="mt-6 pt-6 border-t border-gray-200">
                            <h6 className="font-semibold text-gray-900 text-sm uppercase tracking-wide border-b border-gray-200 pb-2 mb-4">
                              Skills
                            </h6>
                            <div className="flex flex-wrap gap-2">
                              {candidate.skills.map((skill: string, skillIndex: number) => (
                                <span key={skillIndex} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {importData.length > 2 && (
                    <div className="text-center py-6">
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <span className="text-gray-600 font-bold">+</span>
                          </div>
                          <div>
                            <p className="text-gray-900 font-medium">
                              And {importData.length - 2} more candidates
                            </p>
                            <p className="text-gray-600 text-sm">
                              All will be imported with the same job assignment
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
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