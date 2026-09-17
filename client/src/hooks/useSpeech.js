import { useContext } from 'react';
import { SpeechContext } from '../context/SpeechContext';

export function useSpeech() {
  const ctx = useContext(SpeechContext);
  if (!ctx) throw new Error('useSpeech must be used inside a <SpeechProvider>');
  return ctx;
}
