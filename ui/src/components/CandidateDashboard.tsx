import React from 'react';
import type { CandidateProfile, PathwayResult } from '../types';
import { Target, CheckCircle2, XCircle, Trophy, User } from 'lucide-react';

interface Props {
  profile: CandidateProfile | null;
  completeness: number;
}

export const CandidateDashboard: React.FC<Props> = ({ profile, completeness }) => {
  if (!profile || Object.keys(profile).length <= 2) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-full text-slate-500">
        <User size={48} className="mb-4 text-slate-300" />
        <h3 className="text-lg font-medium text-slate-700 mb-2">No Profile Yet</h3>
        <p className="text-sm">
          Chat with the assistant to build your immigration profile. Tell it about your education, work experience, and language scores!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white animate-in fade-in slide-in-from-right-4 duration-500">
      
      {/* Header / CRS Score */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Trophy size={18} className="text-amber-500" />
              Your Profile
            </h2>
            <p className="text-sm text-slate-500">Estimated CRS & Eligibility</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-slate-800 tracking-tight">
              {profile.estimatedCRS ? profile.estimatedCRS : '--'}
            </div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">CRS Score</div>
          </div>
        </div>

        {/* Completeness Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-slate-500">Profile Completeness</span>
            <span className={completeness === 100 ? 'text-green-600' : 'text-blue-600'}>{completeness}%</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ease-out rounded-full ${completeness === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${completeness}%` }}
            />
          </div>
        </div>
      </div>

      {/* Profile Details Snapshot */}
      <div className="px-6 py-4 grid grid-cols-2 gap-4 text-sm border-b border-slate-100">
        <div>
          <span className="text-slate-400 block text-xs uppercase tracking-wider mb-0.5">Education</span>
          <span className="font-medium text-slate-700">{profile.educationLevel ? profile.educationLevel.replace(/([A-Z])/g, ' $1').trim() : <span className="text-slate-300">Missing</span>}</span>
        </div>
        <div>
          <span className="text-slate-400 block text-xs uppercase tracking-wider mb-0.5">CLB Level</span>
          <span className="font-medium text-slate-700">{profile.clbLevel || <span className="text-slate-300">Missing</span>}</span>
        </div>
        <div>
          <span className="text-slate-400 block text-xs uppercase tracking-wider mb-0.5">Canadian Work</span>
          <span className="font-medium text-slate-700">{profile.canadianWorkYears !== undefined ? `${profile.canadianWorkYears} yrs` : <span className="text-slate-300">Missing</span>}</span>
        </div>
        <div>
          <span className="text-slate-400 block text-xs uppercase tracking-wider mb-0.5">Foreign Work</span>
          <span className="font-medium text-slate-700">{profile.foreignWorkYears !== undefined ? `${profile.foreignWorkYears} yrs` : <span className="text-slate-300">Missing</span>}</span>
        </div>
      </div>

      {/* Top Pathways */}
      <div className="p-6 flex-1 overflow-y-auto">
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Target size={16} className="text-slate-400" />
          Top Recommended Pathways
        </h3>
        
        {!profile.eligiblePathways || profile.eligiblePathways.length === 0 ? (
          <div className="text-sm text-slate-500 p-4 bg-slate-50 rounded-lg text-center border border-slate-100">
            Keep answering questions to see your eligible pathways.
          </div>
        ) : (
          <div className="space-y-3">
            {profile.eligiblePathways.slice(0, 3).map((pathway: PathwayResult, i: number) => (
              <div key={i} className={`p-4 rounded-xl border ${pathway.eligible ? 'border-green-200 bg-green-50/50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="font-medium text-slate-800 leading-tight">
                    <span className="block text-xs text-slate-500 mb-0.5">{pathway.pathway}</span>
                    {pathway.program}
                  </div>
                  {pathway.eligible ? (
                    <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
                  ) : (
                    <div className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                      {pathway.eligibilityScore}% Match
                    </div>
                  )}
                </div>
                
                {pathway.missingRequirements && pathway.missingRequirements.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Missing:</div>
                    {pathway.missingRequirements.slice(0, 2).map((req, j) => (
                      <div key={j} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <XCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                        <span className="leading-snug">{req}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
