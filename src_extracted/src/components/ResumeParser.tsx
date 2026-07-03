import React, { useState } from 'react';
import { Upload, FileText, User, Mail, Phone, MapPin, Briefcase, GraduationCap, Award, X } from 'lucide-react';

interface ParsedResumeData {
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    location: string;
  };
  experience: {
    company: string;
    position: string;
    duration: string;
    description: string;
  }[];
  education: {
    institution: string;
    degree: string;
    year: string;
  }[];
  skills: string[];
  summary: string;
}

interface ResumeParserProps {
  isOpen: boolean;
  onClose: () => void;
  onParsed: (data: ParsedResumeData) => void;
}

export default function ResumeParser({ isOpen, onClose, onParsed }: ResumeParserProps) {
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedResumeData | null>(null);

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
    const resumeFile = files.find(file => 
      file.type === 'application/pdf' || 
      file.type === 'application/msword' || 
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    
    if (resumeFile) {
      parseResume(resumeFile);
    } else {
      alert('Please upload a PDF or Word document.');
    }
  };

  const parseResume = (file: File) => {
    setParsing(true);
    
    // Simulate resume parsing (in real app, this would call an AI service)
    setTimeout(() => {
      const mockParsedData: ParsedResumeData = {
        personalInfo: {
          name: 'John Smith',
          email: 'john.smith@email.com',
          phone: '+1-555-0123',
          location: 'San Francisco, CA'
        },
        experience: [
          {
            company: 'Tech Corp',
            position: ' Software Engineer',
            duration: '2020 - Present',
            description: 'Led development of microservices architecture, managed team of 5 developers, implemented CI/CD pipelines'
          },
          {
            company: 'StartupXYZ',
            position: 'Full Stack Developer',
            duration: '2018 - 2020',
            description: 'Built responsive web applications using React and Node.js, collaborated with design team'
          }
        ],
        education: [
          {
            institution: 'University of California, Berkeley',
            degree: 'Bachelor of Science in Computer Science',
            year: '2018'
          }
        ],
        skills: ['JavaScript', 'React', 'Node.js', 'Python', 'AWS', 'Docker', 'MongoDB', 'PostgreSQL'],
        summary: 'Experienced software engineer with 5+ years in full-stack development. Proven track record of leading teams and delivering scalable solutions.'
      };
      
      setParsedData(mockParsedData);
      setParsing(false);
    }, 3000);
  };

  const handleConfirmParsing = () => {
    if (parsedData) {
      onParsed(parsedData);
      onClose();
      setParsedData(null);
    }
  };

  const handleEditField = (section: string, field: string, value: string) => {
    if (!parsedData) return;
    
    setParsedData(prev => {
      if (!prev) return prev;
      
      if (section === 'personalInfo') {
        return {
          ...prev,
          personalInfo: {
            ...prev.personalInfo,
            [field]: value
          }
        };
      }
      
      if (section === 'summary') {
        return {
          ...prev,
          summary: value
        };
      }
      
      return prev;
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Resume Parser</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {!parsedData && !parsing && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Resume</h3>
                <p className="text-gray-600">Upload a PDF or Word document to automatically extract candidate information.</p>
              </div>

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
                  Drop your resume here
                </h3>
                <p className="text-gray-600 mb-4">
                  or click to browse and select a file
                </p>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileInput}
                  className="hidden"
                  id="resume-upload"
                />
                <label
                  htmlFor="resume-upload"
                  className="inline-flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  <FileText size={16} />
                  <span>Choose File</span>
                </label>
              </div>

              <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-900 mb-2">Supported Formats</h4>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• PDF documents (.pdf)</li>
                  <li>• Microsoft Word documents (.doc, .docx)</li>
                  <li>• Maximum file size: 10MB</li>
                </ul>
              </div>
            </div>
          )}

          {parsing && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Parsing Resume...</h3>
              <p className="text-gray-600">Extracting candidate information using AI technology.</p>
            </div>
          )}

          {parsedData && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Parsed Information</h3>
                <div className="text-sm text-gray-600">
                  Review and edit the extracted information before confirming
                </div>
              </div>

              {/* Personal Information */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <User className="text-blue-600" size={20} />
                  <h4 className="font-medium text-gray-900">Personal Information</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={parsedData.personalInfo.name}
                      onChange={(e) => handleEditField('personalInfo', 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={parsedData.personalInfo.email}
                      onChange={(e) => handleEditField('personalInfo', 'email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={parsedData.personalInfo.phone}
                      onChange={(e) => handleEditField('personalInfo', 'phone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input
                      type="text"
                      value={parsedData.personalInfo.location}
                      onChange={(e) => handleEditField('personalInfo', 'location', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <FileText className="text-green-600" size={20} />
                  <h4 className="font-medium text-gray-900">Professional Summary</h4>
                </div>
                <textarea
                  value={parsedData.summary}
                  onChange={(e) => handleEditField('summary', '', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Experience */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Briefcase className="text-purple-600" size={20} />
                  <h4 className="font-medium text-gray-900">Work Experience</h4>
                </div>
                <div className="space-y-4">
                  {parsedData.experience.map((exp, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Company</label>
                          <div className="font-medium text-gray-900">{exp.company}</div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Position</label>
                          <div className="font-medium text-gray-900">{exp.position}</div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
                          <div className="text-gray-700">{exp.duration}</div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                        <div className="text-gray-700 text-sm">{exp.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Education */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <GraduationCap className="text-indigo-600" size={20} />
                  <h4 className="font-medium text-gray-900">Education</h4>
                </div>
                <div className="space-y-3">
                  {parsedData.education.map((edu, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Institution</label>
                          <div className="font-medium text-gray-900">{edu.institution}</div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Degree</label>
                          <div className="text-gray-700">{edu.degree}</div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
                          <div className="text-gray-700">{edu.year}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Skills */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Award className="text-orange-600" size={20} />
                  <h4 className="font-medium text-gray-900">Skills</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {parsedData.skills.map((skill, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmParsing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Use This Information
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}