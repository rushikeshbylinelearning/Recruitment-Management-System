import React, { useState } from 'react';
import { FileText, Upload, CheckCircle, XCircle } from 'lucide-react';
import { parseResume, ParsedCandidateData } from '../utils/resumeParser';

export default function ResumeParserDemo() {
  const [parsedData, setParsedData] = useState<ParsedCandidateData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setParsedData(null);

    try {
      const result = await parseResume(file);
      setParsedData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse resume');
    } finally {
      setLoading(false);
    }
  };

  const renderField = (label: string, value: any) => {
    if (!value) return null;

    return (
      <div className="flex items-start space-x-3">
        <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
        <div>
          <span className="font-medium text-gray-700">{label}:</span>
          <span className="ml-2 text-gray-600">
            {Array.isArray(value) ? value.join(', ') : String(value)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-8">
        <FileText size={48} className="mx-auto text-blue-600 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Resume Parser Demo</h1>
        <p className="text-gray-600">
          Upload a PDF, Word document, or text file to automatically extract candidate information
        </p>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
        <Upload size={32} className="mx-auto text-gray-400 mb-4" />
        <label className="cursor-pointer">
          <span className="text-lg font-medium text-blue-600 hover:text-blue-700">
            {loading ? 'Parsing Resume...' : 'Choose Resume File'}
          </span>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileUpload}
            className="hidden"
            disabled={loading}
          />
        </label>
        <p className="text-sm text-gray-500 mt-2">
          Supports PDF, Word (.doc, .docx), and text files
        </p>
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Parsing resume...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <XCircle size={20} className="text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {parsedData && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <CheckCircle size={24} className="text-green-600 mr-2" />
            <h2 className="text-xl font-semibold text-green-800">Parsed Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              {renderField('Name', parsedData.name)}
              {renderField('Email', parsedData.email)}
              {renderField('Phone', parsedData.phone)}
              {renderField('Location', parsedData.location)}
              {renderField('Experience', parsedData.experience)}
              {renderField('Expertise', parsedData.expertise)}
            </div>
            <div className="space-y-3">
              {renderField('Expected Salary', parsedData.expectedSalary)}
              {renderField('Current CTC', parsedData.currentCtc)}
              {renderField('Notice Period', parsedData.noticePeriod)}
              {renderField('Work Preference', parsedData.workPreference)}
              {renderField('Immediate Joiner', parsedData.immediateJoiner ? 'Yes' : parsedData.immediateJoiner === false ? 'No' : 'Not specified')}
              {renderField('Willing Alternate Saturday', parsedData.willingAlternateSaturday ? 'Yes' : parsedData.willingAlternateSaturday === false ? 'No' : 'Not specified')}
            </div>
          </div>

          {parsedData.skills && parsedData.skills.length > 0 && (
            <div className="mt-4">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <span className="font-medium text-gray-700">Skills:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {parsedData.skills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {parsedData.notes && (
            <div className="mt-4">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <span className="font-medium text-gray-700">Additional Notes:</span>
                  <p className="mt-1 text-gray-600 text-sm">{parsedData.notes}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-800 mb-2">Supported File Types:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• PDF files (.pdf)</li>
          <li>• Microsoft Word documents (.doc, .docx)</li>
          <li>• Text files (.txt)</li>
        </ul>
        
        <h3 className="font-semibold text-gray-800 mt-4 mb-2">Extracted Information:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Personal details (name, email, phone, location)</li>
          <li>• Professional information (experience, skills, expertise)</li>
          <li>• Salary expectations and current CTC</li>
          <li>• Work preferences and availability</li>
          <li>• Additional notes and achievements</li>
        </ul>
      </div>
    </div>
  );
}
