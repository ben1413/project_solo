import { Persona, PERSONAS, LLMEngine } from '@/data/personas';

export interface IntentUpdate {
  persona?: Persona;
  engine?: LLMEngine;
}

export const parseMessageIntent = (text: string): IntentUpdate => {
  const lowerText = text.toLowerCase();
  const update: IntentUpdate = {};

  // 1. PERSONA TRIGGERS
  if (lowerText.includes('toni')) update.persona = PERSONAS.find(p => p.id === 'toni');
  if (lowerText.includes('izzi')) update.persona = PERSONAS.find(p => p.id === 'izzi');
  if (lowerText.includes('cindi')) update.persona = PERSONAS.find(p => p.id === 'cindi');

  // 2. ENGINE TRIGGERS
  if (lowerText.includes('gpt') || lowerText.includes('5.2')) update.engine = 'gpt-5.2';
  if (lowerText.includes('claude') || lowerText.includes('3.5')) update.engine = 'claude-3.5';
  if (lowerText.includes('gemini') || lowerText.includes('1.5')) update.engine = 'gemini-1.5';

  return update;
};
