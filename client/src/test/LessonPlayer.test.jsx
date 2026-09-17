import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Lesson from '../pages/Lesson';
import { AuthContext } from '../context/AuthContext';
import { SpeechProvider } from '../context/SpeechContext';
import * as lessonsApi from '../api/lessons';

vi.mock('../api/lessons');

const lessonFixture = {
  lesson: {
    id: 'lesson-1',
    slug: 'greetings-1',
    title: 'Saying Hello',
    exercises: [
      {
        index: 0,
        type: 'multiple_choice',
        prompt: 'hello',
        promptLang: 'en',
        answerLang: 'my',
        options: ['မင်္ဂလာပါ', 'ဟုတ်ကဲ့', 'မဟုတ်ဘူး', 'ကျေးဇူးတင်ပါတယ်'],
      },
      {
        index: 1,
        type: 'fill_blank',
        prompt: 'ကျေးဇူးတင်ပါတယ်',
        promptLang: 'my',
        answerLang: 'en',
        sentence: 'ကျေးဇူးတင်ပါတယ်  =  ___',
      },
    ],
  },
  unit: { id: 'unit-1', slug: 'greetings', title: 'Greetings', icon: '👋' },
};

let auth;

function renderLesson() {
  auth = { user: { displayName: 'Test' }, refreshUser: vi.fn(), applyXp: vi.fn(), dueCount: 0 };
  return render(
    <SpeechProvider>
      <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/lesson/greetings-1']}>
        <Routes>
          <Route path="/lesson/:slug" element={<Lesson />} />
          <Route path="/" element={<div>Unit map</div>} />
        </Routes>
      </MemoryRouter>
      </AuthContext.Provider>
    </SpeechProvider>
  );
}

beforeEach(() => {
  vi.mocked(lessonsApi.fetchLesson).mockResolvedValue(lessonFixture);
  vi.mocked(lessonsApi.submitAttempt).mockReset();
  vi.mocked(lessonsApi.completeLesson).mockReset();
});

describe('lesson player', () => {
  it('shows the first exercise and its options', async () => {
    renderLesson();

    expect(await screen.findByText('hello')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /မင်္ဂလာပါ/ })).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('keeps Check disabled until an option is chosen', async () => {
    const user = userEvent.setup();
    renderLesson();

    const check = await screen.findByRole('button', { name: 'Check' });
    expect(check).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /မင်္ဂလာပါ/ }));
    expect(check).toBeEnabled();
  });

  it('sends the chosen answer to the server and shows the verdict', async () => {
    const user = userEvent.setup();
    vi.mocked(lessonsApi.submitAttempt).mockResolvedValue({
      correct: true,
      correctAnswer: 'မင်္ဂလာပါ',
      xpAwarded: 10,
    });
    renderLesson();

    await user.click(await screen.findByRole('radio', { name: /မင်္ဂလာပါ/ }));
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByText('Correct!')).toBeInTheDocument();
    expect(screen.getByText('+10 XP')).toBeInTheDocument();
    expect(lessonsApi.submitAttempt).toHaveBeenCalledWith('greetings-1', {
      exerciseIndex: 0,
      answer: 'မင်္ဂလာပါ',
      attempts: 1,
    });
  });

  it('updates the running XP total so the header does not go stale mid-lesson', async () => {
    const user = userEvent.setup();
    vi.mocked(lessonsApi.submitAttempt).mockResolvedValue({
      correct: true,
      correctAnswer: 'မင်္ဂလာပါ',
      xpAwarded: 10,
      totalXp: 130,
    });
    renderLesson();

    await user.click(await screen.findByRole('radio', { name: /မင်္ဂလာပါ/ }));
    await user.click(screen.getByRole('button', { name: 'Check' }));

    await screen.findByText('Correct!');
    expect(auth.applyXp).toHaveBeenCalledWith(130);
  });

  it('reveals the right answer after a wrong one and offers a retry', async () => {
    const user = userEvent.setup();
    vi.mocked(lessonsApi.submitAttempt).mockResolvedValue({
      correct: false,
      correctAnswer: 'မင်္ဂလာပါ',
      xpAwarded: 0,
    });
    renderLesson();

    await user.click(await screen.findByRole('radio', { name: /ဟုတ်ကဲ့/ }));
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByText('Not quite')).toBeInTheDocument();
    expect(screen.getByText(/Answer:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('counts the second try as a retry when reporting the attempt', async () => {
    const user = userEvent.setup();
    vi.mocked(lessonsApi.submitAttempt)
      .mockResolvedValueOnce({ correct: false, correctAnswer: 'မင်္ဂလာပါ', xpAwarded: 0 })
      .mockResolvedValueOnce({ correct: true, correctAnswer: 'မင်္ဂလာပါ', xpAwarded: 4 });
    renderLesson();

    await user.click(await screen.findByRole('radio', { name: /ဟုတ်ကဲ့/ }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    await user.click(screen.getByRole('radio', { name: /မင်္ဂလာပါ/ }));
    await user.click(screen.getByRole('button', { name: 'Check' }));

    await screen.findByText('Correct!');
    expect(lessonsApi.submitAttempt).toHaveBeenLastCalledWith(
      'greetings-1',
      expect.objectContaining({ attempts: 2 })
    );
  });

  it('advances to the next exercise on Continue', async () => {
    const user = userEvent.setup();
    vi.mocked(lessonsApi.submitAttempt).mockResolvedValue({
      correct: true,
      correctAnswer: 'မင်္ဂလာပါ',
      xpAwarded: 10,
    });
    renderLesson();

    await user.click(await screen.findByRole('radio', { name: /မင်္ဂလာပါ/ }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));

    // The second exercise is a typed one, so an input replaces the options.
    expect(await screen.findByLabelText(/Type the translation/)).toBeInTheDocument();
    expect(screen.getByText('2/2')).toBeInTheDocument();
  });

  it('finishes the lesson and shows the score summary', async () => {
    const user = userEvent.setup();
    vi.mocked(lessonsApi.submitAttempt).mockResolvedValue({
      correct: true,
      correctAnswer: 'x',
      xpAwarded: 10,
    });
    vi.mocked(lessonsApi.completeLesson).mockResolvedValue({
      completion: { score: 1, correctCount: 2, totalCount: 2, perfect: true, xpAwarded: 35 },
      user: { xp: 55, currentStreak: 1 },
    });
    renderLesson();

    await user.click(await screen.findByRole('radio', { name: /မင်္ဂလာပါ/ }));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(await screen.findByRole('button', { name: 'Continue' }));

    await user.type(await screen.findByLabelText(/Type the translation/), 'thank you');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(await screen.findByRole('button', { name: 'Finish' }));

    expect(await screen.findByText('Perfect lesson!')).toBeInTheDocument();
    expect(screen.getByText('+35')).toBeInTheDocument();
    await waitFor(() =>
      expect(lessonsApi.completeLesson).toHaveBeenCalledWith(
        'greetings-1',
        expect.objectContaining({ correctCount: 2, totalCount: 2 })
      )
    );
  });

  it('surfaces a network failure without losing the learner place', async () => {
    const user = userEvent.setup();
    vi.mocked(lessonsApi.submitAttempt).mockRejectedValue(new Error('Failed to fetch'));
    renderLesson();

    await user.click(await screen.findByRole('radio', { name: /မင်္ဂလာပါ/ }));
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch');
    expect(screen.getByText('1/2')).toBeInTheDocument(); // still on exercise one
  });

  it('shows a retryable error if the lesson itself cannot load', async () => {
    vi.mocked(lessonsApi.fetchLesson).mockRejectedValue(new Error('Lesson not found'));
    renderLesson();

    expect(await screen.findByRole('alert')).toHaveTextContent('Lesson not found');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
