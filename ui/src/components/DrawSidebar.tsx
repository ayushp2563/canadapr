import { useState } from 'react';
import type { Draw, CandidateProfile } from '../types';
import { DrawCard } from './DrawCard';
import { CandidateDashboard } from './CandidateDashboard';

interface Props {
  draws: Draw[];
  isLoading?: boolean;
  profile?: CandidateProfile | null;
  completeness?: number;
  onChatClick?: (drawId: number) => void;
}

export function DrawSidebar({ draws, isLoading, profile, completeness = 0, onChatClick }: Props) {
  const [activeTab, setActiveTab] = useState<'draws' | 'profile'>('profile');

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />
        <div className="h-24 bg-slate-200 animate-pulse rounded-xl" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-200 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200">
      
      {/* Tabs */}
      <div className="flex p-2 bg-slate-100 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'profile' 
              ? 'bg-white text-slate-800 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          My Profile
        </button>
        <button
          onClick={() => setActiveTab('draws')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'draws' 
              ? 'bg-white text-slate-800 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Draw Browser
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'profile' ? (
          <CandidateDashboard profile={profile || null} completeness={completeness} />
        ) : (
          <div className="p-4">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4">
              Recent Draws
            </h2>
            {draws.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-8">
                No draw data available.
              </div>
            ) : (
              <div className="space-y-4">
                {draws.map(draw => (
                  <DrawCard 
                    key={draw.id} 
                    draw={draw} 
                    candidateCrs={profile?.estimatedCRS}
                    onChatClick={onChatClick}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
