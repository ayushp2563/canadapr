import React, { useState } from 'react';
import type { Draw } from '../types';
import { Users, Hash, Calendar, BarChart3, ChevronDown, MessageCircle, MapPin } from 'lucide-react';

interface Props {
  draw: Draw;
  onChatClick?: (drawId: number) => void;
  candidateCrs?: number;
}

export const DrawCard: React.FC<Props> = ({ draw, onChatClick, candidateCrs }) => {
  const [expanded, setExpanded] = useState(false);

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'STEM': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Healthcare': return 'bg-green-100 text-green-700 border-green-200';
      case 'Trades': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'French': return 'bg-teal-100 text-teal-700 border-teal-200';
      case 'PNP': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-all duration-200 shadow-sm hover:shadow-md mb-4">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-600 font-bold text-sm">
              <Hash size={14} className="mr-0.5" />
              {draw.drawNumber}
            </span>
            <span className="text-sm text-slate-500 flex items-center">
              <Calendar size={14} className="mr-1" />
              {new Date(draw.drawDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          {draw.isPnpDraw && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
              <MapPin size={12} />
              {draw.province || 'PNP'}
            </span>
          )}
        </div>
        
        <h3 className="font-semibold text-slate-800 leading-snug mb-3">
          {draw.drawType}
        </h3>

        <div className="flex gap-4">
          <div>
            <div className="text-2xl font-bold text-slate-800 tracking-tight flex items-baseline gap-1">
              {draw.crsScore}
              {candidateCrs && (
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${candidateCrs >= draw.crsScore ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {candidateCrs >= draw.crsScore ? '✓ Qualify' : `-${draw.crsScore - candidateCrs} pts`}
                </span>
              )}
            </div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center mt-0.5">
              <BarChart3 size={12} className="mr-1" /> CRS Score
            </div>
          </div>
          <div className="w-px bg-slate-200"></div>
          <div>
            <div className="text-2xl font-bold text-slate-800 tracking-tight">
              {draw.invitationsIssued.toLocaleString()}
            </div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center mt-0.5">
              <Users size={12} className="mr-1" /> Invitations
            </div>
          </div>
        </div>
      </div>

      {/* Target Audience / NOCs */}
      {draw.drawCategory && (
        <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex flex-wrap gap-2">
          <span className={`text-xs font-medium px-2 py-1 rounded-full border ${getCategoryColor(draw.drawCategory)}`}>
            {draw.drawCategory} Targeted
          </span>
          {draw.isOccupationSpecific && draw.occupationTitles && (
            <span className="text-xs font-medium px-2 py-1 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
              {draw.occupationTitles.length} NOCs
            </span>
          )}
        </div>
      )}

      {/* Expandable Section */}
      <div className="border-t border-slate-100">
        <button 
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1 hover:bg-slate-50 transition-colors"
        >
          {expanded ? 'Hide Details' : 'View AI Analysis & Details'}
          <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>

        {expanded && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            {draw.historicalContext && (
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                <BarChart3 size={16} className={draw.historicalContext.trend === 'decreasing' ? 'text-green-500' : 'text-red-500'} />
                <span>
                  This CRS is <strong>{Math.abs(draw.historicalContext.thisDrawVsAvg)} points {draw.historicalContext.thisDrawVsAvg < 0 ? 'lower' : 'higher'}</strong> than the recent average ({draw.historicalContext.avgCrsForThisType}).
                </span>
              </div>
            )}

            {draw.drawAnalysis ? (
              <div className="text-sm text-slate-600 space-y-2 leading-relaxed">
                {draw.drawAnalysis.split('\n\n').map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500 italic">No analysis available.</div>
            )}

            {draw.occupationTitles && draw.occupationTitles.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase mb-2">Targeted Occupations</h4>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-2">
                  {draw.occupationTitles.map((occ, i) => (
                    <div key={i} className="group relative">
                      <span className="inline-block text-[11px] px-2 py-1 bg-white border border-slate-200 rounded text-slate-600 cursor-help truncate max-w-[200px]">
                        {occ.noc} - {occ.title}
                      </span>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 p-2 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                        {occ.exampleTitles.slice(0,3).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Button */}
      {onChatClick && (
        <div className="p-3 border-t border-slate-100 bg-white">
          <button 
            onClick={() => onChatClick(draw.drawNumber)}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            <MessageCircle size={16} />
            Chat about this draw
          </button>
        </div>
      )}
    </div>
  );
};
