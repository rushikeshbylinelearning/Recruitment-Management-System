import React from 'react';

export default function InterviewerTest() {
  console.log('InterviewerTest component is rendering');
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Interviewer Test Page</h1>
      <p className="text-gray-600">This is a test page to verify the interviewer layout is working.</p>
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <p className="text-blue-800">If you can see this, the interviewer layout is working correctly!</p>
      </div>
    </div>
  );
}
