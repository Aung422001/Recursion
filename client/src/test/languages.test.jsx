import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithSpeech as render } from './utils';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LANGUAGES, LANGUAGE_CODES } from 'shared/constants.js';
import { Text } from '../components/Text';
import { MultipleChoice } from '../components/exercises/MultipleChoice';
import { ExerciseCard } from '../components/exercises/ExerciseCard';
import { Layout } from '../components/Layout';
import { AuthContext } from '../context/AuthContext';

describe('Text', () => {
  it('tags the element with its language so the right font applies', () => {
    render(<Text lang="th">สวัสดี</Text>);
    const el = screen.getByText('สวัสดี');
    expect(el).toHaveAttribute('lang', 'th');
    expect(el.className).toContain('font-thai');
  });

  it('runs Arabic right-to-left and everything else left-to-right', () => {
    const { rerender } = render(<Text lang="ar">مرحبا</Text>);
    expect(screen.getByText('مرحبا')).toHaveAttribute('dir', 'rtl');

    rerender(<Text lang="ja">こんにちは</Text>);
    expect(screen.getByText('こんにちは')).toHaveAttribute('dir', 'ltr');
  });

  it('picks a font for every script the app supports', () => {
    for (const code of LANGUAGE_CODES) {
      const { unmount } = render(<Text lang={code}>word</Text>);
      const el = screen.getByText('word');
      // Latin languages ride the default sans stack; the rest need their own.
      if (!LANGUAGES[code].latin) expect(el.className).toMatch(/font-\w+/);
      expect(el).toHaveAttribute('lang', code);
      unmount();
    }
  });

  it('falls back gracefully on an unknown language', () => {
    render(<Text lang="zz">word</Text>);
    expect(screen.getByText('word')).toHaveAttribute('dir', 'ltr');
  });
});

describe('exercises in different languages', () => {
  const make = (answerLang, options) => ({
    type: 'multiple_choice',
    prompt: 'hello',
    promptLang: 'en',
    answerLang,
    options,
  });

  it('renders Japanese options in the Japanese font', () => {
    render(
      <MultipleChoice
        exercise={make('ja', ['こんにちは', 'ありがとう', 'はい', 'いいえ'])}
        selected={null}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('こんにちは')).toHaveAttribute('lang', 'ja');
  });

  it('renders Arabic options right-to-left', () => {
    render(
      <MultipleChoice
        exercise={make('ar', ['مرحبا', 'شكرا', 'نعم', 'لا'])}
        selected={null}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('مرحبا')).toHaveAttribute('dir', 'rtl');
  });

  it('names the target language in the instruction', () => {
    render(
      <ExerciseCard
        exercise={make('ko', ['안녕하세요', '감사합니다', '네', '아니요'])}
        answer={null}
        onAnswerChange={vi.fn()}
      />
    );
    expect(screen.getByText('Choose the Korean translation')).toBeInTheDocument();
  });

  it('shows a romanization under a prompt that has one', () => {
    render(
      <ExerciseCard
        exercise={{
          ...make('en', ['hello', 'yes', 'no', 'sorry']),
          prompt: 'こんにちは',
          promptLang: 'ja',
          promptRomanization: 'konnichiwa',
        }}
        answer={null}
        onAnswerChange={vi.fn()}
      />
    );
    expect(screen.getByText('konnichiwa')).toBeInTheDocument();
  });
});

describe('course switcher', () => {
  const renderLayout = (user) =>
    render(
      <AuthContext.Provider value={{ user, dueCount: 0, logout: vi.fn() }}>
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      </AuthContext.Provider>
    );

  it('shows the language currently being studied', () => {
    renderLayout({ displayName: 'A', sourceLang: 'en', targetLang: 'th', xp: 0, currentStreak: 0 });
    expect(screen.getByText('Thai')).toBeInTheDocument();
  });

  it('links to the course picker', async () => {
    const user = userEvent.setup();
    renderLayout({ displayName: 'A', sourceLang: 'en', targetLang: 'ja', xp: 0, currentStreak: 0 });

    const link = screen.getByRole('link', { name: /Studying Japanese from English/ });
    expect(link).toHaveAttribute('href', '/courses');
    await user.click(link);
  });

  it('renders nothing rather than crashing on an unknown pair', () => {
    renderLayout({ displayName: 'A', sourceLang: 'zz', targetLang: 'qq', xp: 0, currentStreak: 0 });
    expect(screen.queryByRole('link', { name: /Studying/ })).not.toBeInTheDocument();
  });
});
