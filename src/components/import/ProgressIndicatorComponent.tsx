import React, { useState, useEffect } from 'react';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

interface ProgressIndicatorComponentProps {
  jobId: string;
  onComplete: (result: any) => void;
}

export default function ProgressIndicatorComponent({
  jobId,
  onComplete,
}: ProgressIndicatorComponentProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'processing' | 'completed' | 'failed'>('processing');
  const [message, setMessage] = useState('Processing candidates...');
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    // Poll status endpoint every 2 seconds
    const pollInterval = setInterval(async () => {
      try {
        // Note: This endpoint would need to be implemented in the backend
        // For now, we'll simulate progress
        // const response = await fetch(`/api/candidates/import/status/${jobId}`);
        // const data = await response.json();
        
        // Simulated progress for demonstration
        setProgress(prev => {
          const newProgress = Math.min(prev + 10, 100);
          if (newProgress === 100) {
            setStatus('completed');
            setMessage('Import completed successfully!');
            clearInterval(pollInterval);
            setTimeout(() => {
              onComplete({
                success: true,
                summary: {
                  totalRows: 100,
                  successCount: 95,
                  failureCount: 5,
                },
              });
            }, 1000);
          }
          return newProgress;
        });

        setProcessedCount(prev => Math.min(prev + 10, totalCount || 100));
      } catch (error) {
        console.error('Failed to poll status:', error);
        setStatus('failed');
        setMessage('Failed to process import');
        clearInterval(pollInterval);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [jobId, onComplete, totalCount]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-8">
      <div className="max-w-md mx-auto">
        {/* Status Icon */}
        <div className="flex justify-center mb-6">
          {status === 'processing' && (
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="text-blue-600 animate-spin" size={32} />
            </div>
          )}
          {status === 'completed' && (
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="text-green-600" size={32} />
            </div>
          )}
          {status === 'failed' && (
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="text-red-600" size={32} />
            </div>
          )}
        </div>

        {/* Status Message */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{message}</h3>
          {status === 'processing' && totalCount > 0 && (
            <p className="text-sm text-gray-600">
              Processing {processedCount} of {totalCount} candidates...
            </p>
          )}
        </div>

        {/* Progress Bar */}
        {status === 'processing' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Progress</span>
              <span className="text-gray-900 font-medium">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Completion Message */}
        {status === 'completed' && (
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Your candidates have been imported successfully
            </p>
          </div>
        )}

        {/* Error Message */}
        {status === 'failed' && (
          <div className="text-center">
            <p className="text-sm text-red-600">
              An error occurred during import. Please try again.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
