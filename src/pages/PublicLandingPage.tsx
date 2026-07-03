/**
 * Root page for apply.bylinelms.com — no HR login or dashboard shell.
 */
import React from 'react';
import { DOMAINS } from '../config/domains';

const PublicLandingPage: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center px-4">
    <div className="max-w-lg w-full text-center space-y-6">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-600 text-white text-2xl font-bold shadow-lg">
        B
      </div>
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
        Careers at Byline LMS
      </h1>
      <p className="text-slate-600 text-lg leading-relaxed">
        Apply for open roles using the application link shared with you by our recruiting team.
      </p>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-left space-y-3">
        <p className="text-sm font-medium text-slate-800">Have an application link?</p>
        <p className="text-sm text-slate-500">
          Open the link from your email or message. Short links look like{' '}
          <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
            {DOMAINS.PUBLIC_PORTAL}/a/…
          </code>
        </p>
        <p className="text-sm text-slate-500">
          If your link does not work, contact the recruiter who sent it.
        </p>
      </div>
      <p className="text-xs text-slate-400">
        HR team?{' '}
        <a
          href={`https://${DOMAINS.HR_PORTAL}/login`}
          className="text-red-600 hover:underline font-medium"
        >
          Sign in at {DOMAINS.HR_PORTAL}
        </a>
      </p>
    </div>
  </div>
);

export default PublicLandingPage;
