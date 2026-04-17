import React, { useState, useRef } from 'react';
import { Upload, FileText, X, AlertCircle, Loader2, Sheet } from 'lucide-react';
import { candidateImportAPI } from '../../services/api';

interface FileUploadComponentProps {
  onUploadSuccess: (uploadData: any) => void;
  onCancel: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const ALLOWED_EXTENSIONS = ['.csv', '.xls', '.xlsx'];

export default function FileUploadComponent({ onUploadSuccess, onCancel }: FileUploadComponentProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds 10MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`;
    }

    // Check file type
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return 'Invalid file type. Please upload a CSV or Excel file (.csv, .xls, .xlsx).';
    }

    return null;
  };

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
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileSelection = (file: File) => {
    setError(null);
    const validationError = validateFile(file);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    setSelectedFile(file);
    
    // Auto-upload for single-sheet files or CSV
    if (file.name.endsWith('.csv')) {
      uploadFile(file);
    }
  };

  const uploadFile = async (file: File, sheetIndex?: number) => {
    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await candidateImportAPI.uploadFile(file, sheetIndex);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.success && response.data) {
        // Check if Excel file has multiple sheets
        if (response.data.fileInfo.sheetNames && response.data.fileInfo.sheetNames.length > 1) {
          setSheetNames(response.data.fileInfo.sheetNames);
          setUploading(false);
          return;
        }

        // Single sheet or CSV - proceed to preview
        setTimeout(() => {
          onUploadSuccess(response.data);
        }, 300);
      } else {
        throw new Error(response.message || 'Upload failed');
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to upload file. Please try again.');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSheetSelection = () => {
    if (selectedFile) {
      setSheetNames([]);
      uploadFile(selectedFile, selectedSheet);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError(null);
    setUploadProgress(0);
    setSheetNames([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  return (
    <div className="space-y-6">
      {/* File Upload Area */}
      {!selectedFile && (
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-white'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Drop your file here
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Supports CSV and Excel files (.csv, .xls, .xlsx) up to 10MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileInput}
            className="hidden"
            id="file-upload-input"
          />
          <label
            htmlFor="file-upload-input"
            className="inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer font-medium"
          >
            <FileText size={18} />
            <span>Choose File</span>
          </label>
        </div>
      )}

      {/* Selected File Display */}
      {selectedFile && !sheetNames.length && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            {!uploading && (
              <button
                onClick={handleRemoveFile}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Uploading...</span>
                <span className="text-gray-900 font-medium">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sheet Selection for Excel */}
      {sheetNames.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Sheet className="text-blue-600" size={24} />
            <div>
              <h3 className="font-medium text-gray-900">Select Sheet to Import</h3>
              <p className="text-sm text-gray-500">
                Your Excel file contains {sheetNames.length} sheets
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {sheetNames.map((sheetName, index) => (
              <label
                key={index}
                className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name="sheet"
                  value={index}
                  checked={selectedSheet === index}
                  onChange={() => setSelectedSheet(index)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-gray-900">{sheetName}</span>
              </label>
            ))}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleSheetSelection}
              disabled={uploading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center space-x-2"
            >
              {uploading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Continue with Selected Sheet</span>
              )}
            </button>
            <button
              onClick={handleRemoveFile}
              disabled={uploading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-medium text-red-900">Upload Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!selectedFile && (
        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
