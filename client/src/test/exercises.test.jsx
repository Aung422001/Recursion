import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithSpeech as render } from './utils';
import userEvent from '@testing-library/user-event';
import { MatchPairs } from '../components/exercises/MatchPairs';
import { MultipleChoice } from '../components/exercises/MultipleChoice';

const pairsExercise = {
  type: 'match_pairs',
  pairs: [
    { left: 'hello', right: 'မင်္ဂလာပါ' },
    { left: 'yes', right: 'ဟုတ်ကဲ့' },
  ],
};

const mcExercise = {
  type: 'multiple_choice',
  prompt: 'hello',
  promptLang: 'en',
  answerLang: 'my',
  options: ['မင်္ဂလာပါ', 'ဟုတ်ကဲ့', 'မဟုတ်ဘူး', 'ကျေးဇူးတင်ပါတယ်'],
};

describe('MultipleChoice', () => {
  it('reports the option that was clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<MultipleChoice exercise={mcExercise} selected={null} onSelect={onSelect} />);

    await user.click(screen.getByRole('radio', { name: /ဟုတ်ကဲ့/ }));
    expect(onSelect).toHaveBeenCalledWith('ဟုတ်ကဲ့');
  });

  it('lets a keyboard user pick an option by number', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<MultipleChoice exercise={mcExercise} selected={null} onSelect={onSelect} />);

    await user.keyboard('2');
    expect(onSelect).toHaveBeenCalledWith(mcExercise.options[1]);
  });

  it('marks the chosen option for assistive technology', () => {
    render(<MultipleChoice exercise={mcExercise} selected="မင်္ဂလာပါ" onSelect={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /မင်္ဂလာပါ/ })).toBeChecked();
  });

  it('stops accepting input once the answer is locked in', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<MultipleChoice exercise={mcExercise} selected={null} onSelect={onSelect} locked />);

    await user.click(screen.getByRole('radio', { name: /ဟုတ်ကဲ့/ }));
    await user.keyboard('1');
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('MatchPairs', () => {
  it('builds a pair from a left tap followed by a right tap', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MatchPairs exercise={pairsExercise} matches={[]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'hello' }));
    await user.click(screen.getByRole('button', { name: 'မင်္ဂလာပါ' }));

    expect(onChange).toHaveBeenCalledWith([{ left: 'hello', right: 'မင်္ဂလာပါ' }]);
  });

  it('ignores a right tap with no left word selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MatchPairs exercise={pairsExercise} matches={[]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'မင်္ဂလာပါ' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('undoes a pair when a matched word is tapped again', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const matches = [{ left: 'hello', right: 'မင်္ဂလာပါ' }];
    render(<MatchPairs exercise={pairsExercise} matches={matches} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'hello' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows every word from both columns', () => {
    render(<MatchPairs exercise={pairsExercise} matches={[]} onChange={vi.fn()} />);
    for (const pair of pairsExercise.pairs) {
      expect(screen.getByRole('button', { name: pair.left })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: pair.right })).toBeInTheDocument();
    }
  });
});
