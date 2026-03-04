"use client";

import React, { useState } from 'react';
import { Persona, PERSONAS, LLM_ENGINES, LLMEngine } from '@/data/personas';

interface AgentDirectiveProps {
  activePersona: Persona;
  activeEngine: LLMEngine;
  onPersonaChange: (p: Persona) => void;
  onEngineChange: (e: LLMEngine) => void;
}

export const AgentDirective = ({ 
  activePersona, 
  activeEngine, 
  onPersonaChange, 
  onEngineChange 
}: AgentDirectiveProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`
      w-[calc(100%-48px)] mx-auto
      bg-[var(--panel)] border border-white/10 
      rounded-[2rem] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-2xl overflow-hidden soft-elevate
      ${expanded ? 'h-[360px]' : 'h-[56px]'}
    `}>
      <div className="h-full flex flex-col">
        {/* SELECTOR BAR - REDUCED HEIGHT & COGNITIVE WEIGHT */}
        <div className="h-[56px] flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-2">
            <select 
              value={activePersona.id}
              onChange={(e) => onPersonaChange(PERSONAS.find(p => p.id === e.target.value)!)}
              className="bg-transparent text-[9px] font-bold tracking-[0.2em] text-[var(--text-blue)] uppercase py-1 outline-none cursor-pointer hover:text-[var(--text-blue)] transition-colors"
            >
              {PERSONAS.map(p => <option key={p.id} value={p.id} className="bg-[#111827]">{p.name} / {p.jobTitle}</option>)}
            </select>

            <span className="text-[var(--text-blue)]/40 text-[10px] mx-2">/</span>

            <select 
              value={activeEngine}
              onChange={(e) => onEngineChange(e.target.value as LLMEngine)}
              className="bg-transparent text-[9px] font-bold tracking-[0.2em] text-[var(--text-blue)] uppercase py-1 outline-none cursor-pointer hover:text-[var(--text-blue)] transition-colors"
            >
              {LLM_ENGINES.map(e => <option key={e} value={e} className="bg-[#111827]">{e.toUpperCase()}</option>)}
            </select>
          </div>

          <button 
            onClick={() => setExpanded(!expanded)}
            className="text-[8px] px-4 py-1.5 bg-white/5 rounded-full text-[var(--text-blue)] hover:text-[var(--text-blue)] transition-all uppercase font-bold tracking-widest border border-white/10 hover:border-white/30"
          >
            {expanded ? 'Collapse' : 'Principles'}
          </button>
        </div>

        {/* THE EXPANDED BRAIN */}
        {expanded && (
          <div className="px-10 pb-10 flex-1 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="pt-6 border-t border-white/10 space-y-6">
              <section>
                <h4 className="text-[8px] font-bold text-[var(--text-blue)] uppercase tracking-[0.4em] mb-2">Internal Identity</h4>
                <p className="text-[12px] text-[var(--text-blue)] font-medium leading-relaxed">{activePersona.principles.identity}</p>
              </section>
              <section>
                <h4 className="text-[8px] font-bold text-[var(--text-blue)] uppercase tracking-[0.4em] mb-2">Non-Negotiables</h4>
                <p className="text-[12px] text-[var(--text-blue)] font-medium leading-relaxed">{activePersona.principles.nonNegotiables}</p>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
