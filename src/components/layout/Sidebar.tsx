"use client";

import React from 'react';

interface SidebarProps {
  activeTopicId: string | null;
  onSelectTopic: (id: string) => void;
  topics: Array<{ id: string; title: string; isCore?: boolean }>;
}

export const Sidebar = ({ activeTopicId, onSelectTopic, topics }: SidebarProps) => {
  return (
    <aside className="flex h-full flex-col bg-transparent pt-6">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 space-y-1">
        {topics.map((topic) => {
          const isActive = activeTopicId === topic.id;
          return (
            <button
              key={topic.id}
              onClick={() => onSelectTopic(topic.id)}
              className={`w-full text-left px-6 py-3 rounded-full text-[14px] font-medium transition-all duration-200 min-h-[44px] ${
                isActive 
                  ? 'bg-white/10 text-[var(--text-blue)] shadow-lg shadow-white/5' 
                  : 'bg-transparent text-[var(--text-blue)] hover:text-[var(--text-blue)]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span>{topic.title}</span>
                {topic.isCore ? (
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-[var(--text-blue)]">
                    Core
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
