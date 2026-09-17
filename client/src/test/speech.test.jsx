import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpeechProvider } from '../context/SpeechContext';
import { SpeakButton, VoiceUnavailableNote } from '../components/SpeakButton';
import { AudioSettings } from '../components/AudioSettings';

/** A stand-in for the browser engine, with only the voices we choose to install. */
function installSpeech(langs = ['en-US', 'ja-JP']) {
  const spoken = [];
  const voices = langs.map((lang, i) => ({
    name: `Test Voice ${lang}`,
    lang,
    localService: true,
    default: i === 0,
  }));

  class FakeUtterance {
    constructor(text) {
      this.text = text;
    }
  }

  const synth = {
    getVoices: () => voices,
    speak: (u) => {
      spoken.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice?.name });
      u.onstart?.();
      u.onend?.();
    },
    cancel: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  window.speechSynthesis = synth;
  window.SpeechSynthesisUtterance = FakeUtterance;
  return spoken;
}

const withSpeech = (ui) => render(<SpeechProvider>{ui}</SpeechProvider>);

/** Pretend the server can (or cannot) supply audio for languages the device lacks. */
function stubServerTts(enabled) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      if (String(url).includes('/tts/status')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ enabled, provider: enabled ? 'google-translate' : null }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    })
  );
}

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* storage may be unavailable */
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.speechSynthesis;
  delete window.SpeechSynthesisUtterance;
});

describe('SpeakButton', () => {
  it('speaks the word in the right language when a voice exists', async () => {
    const spoken = installSpeech(['ja-JP']);
    const user = userEvent.setup();
    withSpeech(<SpeakButton text="こんにちは" lang="ja" />);

    const button = await screen.findByRole('button', { name: /Hear this in Japanese/ });
    await user.click(button);

    await waitFor(() => expect(spoken).toHaveLength(1));
    expect(spoken[0].text).toBe('こんにちは');
    expect(spoken[0].lang).toBe('ja-JP');
  });

  it('is disabled when neither the device nor the server can speak', async () => {
    installSpeech(['en-US']); // English only, as on a stock Windows machine
    stubServerTts(false);
    withSpeech(<SpeakButton text="สวัสดี" lang="th" />);

    const button = await screen.findByRole('button', { name: /No Thai voice on this device/ });
    expect(button).toBeDisabled();
  });

  it('falls back to server audio when the device has no voice', async () => {
    installSpeech(['en-US']);
    stubServerTts(true);
    const user = userEvent.setup();

    const played = [];
    vi.stubGlobal(
      'Audio',
      class {
        constructor(src) {
          played.push(src);
        }
        play() {
          return Promise.resolve();
        }
        pause() {}
      }
    );

    withSpeech(<SpeakButton text="สวัสดี" lang="th" />);

    const button = await screen.findByRole('button', { name: /Hear this in Thai \(from the server\)/ });
    expect(button).toBeEnabled();

    await user.click(button);
    await waitFor(() => expect(played).toHaveLength(1));
    expect(played[0]).toContain('/api/tts?');
    expect(played[0]).toContain('lang=th');
  });

  it('prefers a device voice over the server when both exist', async () => {
    const spoken = installSpeech(['ja-JP']);
    stubServerTts(true);
    const user = userEvent.setup();

    const played = [];
    vi.stubGlobal(
      'Audio',
      class {
        constructor(src) {
          played.push(src);
        }
        play() {
          return Promise.resolve();
        }
        pause() {}
      }
    );

    withSpeech(<SpeakButton text="こんにちは" lang="ja" />);
    await user.click(await screen.findByRole('button', { name: /Hear this in Japanese/ }));

    await waitFor(() => expect(spoken).toHaveLength(1));
    expect(played).toHaveLength(0); // no server round trip needed
  });

  it('does not speak when clicked with no voice available', async () => {
    const spoken = installSpeech(['en-US']);
    const user = userEvent.setup();
    withSpeech(<SpeakButton text="สวัสดี" lang="th" />);

    await user.click(await screen.findByRole('button'));
    expect(spoken).toHaveLength(0);
  });

  it('matches a voice by its base language, ignoring the region', async () => {
    const spoken = installSpeech(['ar-EG']);
    const user = userEvent.setup();
    withSpeech(<SpeakButton text="مرحبا" lang="ar" />);

    await user.click(await screen.findByRole('button', { name: /Hear this in Arabic/ }));
    await waitFor(() => expect(spoken).toHaveLength(1));
    expect(spoken[0].lang).toBe('ar-EG');
  });

  it('renders nothing without text', () => {
    installSpeech();
    const { container } = withSpeech(<SpeakButton text="" lang="en" />);
    expect(container.querySelector('button')).toBeNull();
  });

  it('survives a browser with no speech support and no server audio', async () => {
    stubServerTts(false); // speechSynthesis is absent too
    withSpeech(<SpeakButton text="hello" lang="en" />);

    const button = await screen.findByRole('button', { name: /server audio is off/ });
    expect(button).toBeDisabled();
  });
});

describe('VoiceUnavailableNote', () => {
  it('explains when a language has no audio from either source', async () => {
    installSpeech(['en-US']);
    stubServerTts(false);
    withSpeech(<VoiceUnavailableNote lang="ko" />);
    expect(await screen.findByText(/No Korean audio available/)).toBeInTheDocument();
  });

  it('stays quiet when the server can cover the language', async () => {
    installSpeech(['en-US']);
    stubServerTts(true);
    const { container } = withSpeech(<VoiceUnavailableNote lang="ko" />);
    await waitFor(() => expect(container.textContent).not.toMatch(/No Korean audio/));
  });

  it('stays out of the way when the language can be spoken', async () => {
    installSpeech(['ko-KR']);
    const { container } = withSpeech(<VoiceUnavailableNote lang="ko" />);
    await waitFor(() => expect(container.textContent).not.toMatch(/No Korean voice/));
  });
});

describe('AudioSettings', () => {
  it('reports which languages can actually be spoken', async () => {
    installSpeech(['en-US', 'ja-JP', 'th-TH']);
    withSpeech(<AudioSettings activeLang="ja" />);

    expect(await screen.findByText(/Voices on this device: 3 of 10 languages/)).toBeInTheDocument();
  });

  it('warns when the language being studied is silent everywhere', async () => {
    installSpeech(['en-US']);
    stubServerTts(false);
    withSpeech(<AudioSettings activeLang="my" />);

    expect(
      await screen.findByText(/The language you are studying has no audio/)
    ).toBeInTheDocument();
  });

  it('says where the audio is coming from when it is the server', async () => {
    installSpeech(['en-US']);
    stubServerTts(true);
    withSpeech(<AudioSettings activeLang="my" />);

    expect(await screen.findByText(/Burmese audio comes from the server/)).toBeInTheDocument();
    expect(screen.getByText(/the rest stream from the server/)).toBeInTheDocument();
  });

  it('does not warn when the studied language has a voice', async () => {
    installSpeech(['en-US', 'my-MM']);
    withSpeech(<AudioSettings activeLang="my" />);

    await waitFor(() =>
      expect(screen.queryByText(/has no voice installed/)).not.toBeInTheDocument()
    );
  });

  it('remembers the autoplay preference', async () => {
    installSpeech(['en-US']);
    const user = userEvent.setup();
    withSpeech(<AudioSettings activeLang="en" />);

    const toggle = await screen.findByLabelText(/Play words automatically/);
    expect(toggle).toBeChecked(); // on by default

    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(JSON.parse(localStorage.getItem('recursion.autoplay'))).toBe(false);
  });

  it('speaks slower than conversational speed by default', async () => {
    const spoken = installSpeech(['en-US']);
    const user = userEvent.setup();
    withSpeech(
      <>
        <AudioSettings activeLang="en" />
        <SpeakButton text="hello" lang="en" />
      </>
    );

    const buttons = await screen.findAllByRole('button', { name: /Hear this in English/ });
    await user.click(buttons.at(-1));

    await waitFor(() => expect(spoken.length).toBeGreaterThan(0));
    expect(spoken.at(-1).rate).toBeLessThan(1);
  });

  it('says so when the browser cannot speak at all', async () => {
    render(
      <SpeechProvider>
        <AudioSettings activeLang="en" />
      </SpeechProvider>
    );
    expect(await screen.findByText(/no speech support/)).toBeInTheDocument();
  });
});
