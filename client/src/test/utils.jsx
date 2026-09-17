import { render } from '@testing-library/react';
import { SpeechProvider } from '../context/SpeechContext';

/**
 * Components that can speak need the speech provider above them. Wrapping here
 * keeps every test from repeating it — and keeps the hook strict, so a missing
 * provider in the real app still fails loudly.
 */
export function renderWithSpeech(ui, options) {
  return render(ui, { wrapper: ({ children }) => <SpeechProvider>{children}</SpeechProvider>, ...options });
}
