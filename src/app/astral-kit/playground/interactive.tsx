import {
  ArrowClockwise,
  BookOpen,
  Check,
  Play,
  Stop,
  X,
} from '@phosphor-icons/react/dist/ssr';
import { useRef, useState } from 'react';

import IconLabelButton from '@/ui/icon-label-button';
import TextArea from '@/ui/text-area';
import { chat } from './api';
import { evalFns } from './data';
import { PlaygroundProps as PP, Params, PromptMessage } from './types';
import s from './interactive.module.scss';

type Props = PP.Base &
  PP.Interactive & {
    toggleInteractive: () => void;
  };

const Interactive = (p: Props) => {
  /* states */
  const ref = useRef<{ abort: AbortController | null }>({ abort: null });

  const [system, setSystem] = useState(() => {
    const hide = p.exercise?.answers.includes('system');
    return hide ? '' : p.system ?? '';
  });
  const getInitialPrompt = (): PromptMessage[] => {
    const hide = p.exercise?.answers.includes('user');

    if (p.prompt) {
      return p.prompt.map((m) => {
        let content = m.content;
        if (m.role === 'user' && hide) {
          content = '';
        }
        // deep clone
        return { ...m, content };
      });
    }

    const content = hide ? '' : p.user ?? '';
    return [{ role: 'user', content }];
  };
  const [prompt, setPrompt] = useState<PromptMessage[]>(getInitialPrompt);
  const [assistant, setAssistant] = useState<string[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);

  /* computed properties */

  const input: Params[] = p.input
    ? Array.isArray(p.input)
      ? p.input
      : [p.input]
    : [];

  const hiddenFields: ('system' | 'input')[] = [];
  !p.system && hiddenFields.push('system');
  !input.length && hiddenFields.push('input');

  /* header's handlers */

  const empty = !system.trim() && !prompt.length;

  const handleRun = async () => {
    if (empty) return;

    setWaiting(true);
    !!p.exercise && setCorrect(null);

    setAssistant((prev) => prev.map(() => ''));

    const abort = new AbortController();
    ref.current.abort = abort;

    await chat({
      messages: prompt,
      system,
      handleStream,
      handleDone,
      abort,
    });

    if (!p.exercise) return;

    const evalFn = evalFns[p.exercise.eval];
    // workaround for getting the latest assistant value
    setAssistant((assistant) => {
      setCorrect(evalFn(assistant[0]));
      return assistant;
    });
  };
  const handleReset = () => {
    setSystem(p.system ?? '');
    setPrompt(getInitialPrompt);
    setAssistant([]);
    handleDone();
    setCorrect(null);
  };
  const handleReaderMode = () => p.toggleInteractive();

  /* handlers */

  const handleContentChange = (content: string, i: number) => {
    const m: PromptMessage = { ...prompt[i], content };
    const ms = [...prompt.slice(0, i), m, ...prompt.slice(i + 1)];
    setPrompt(ms);
  };
  const handleStream = (chunk: string) =>
    setAssistant((prev) => {
      const next = [...prev];
      next[0] = (next[0] ?? '') + chunk;
      return next;
    });
  const handleDone = () => {
    ref.current.abort?.abort();
    ref.current.abort = null;
    setWaiting(false);
  };

  return (
    <div
      className={[
        s.playground,
        hiddenFields.includes('system') ? '' : s['has-system'],
        hiddenFields.includes('input') ? '' : s['has-input'],
      ].join(' ')}
    >
      <Header
        empty={empty}
        waiting={waiting}
        handleStop={handleDone}
        handleRun={handleRun}
        handleReset={handleReset}
        handleReaderMode={handleReaderMode}
      />

      {!hiddenFields.includes('system') && (
        <TextArea
          className={s.system}
          label="System Prompt"
          onChange={setSystem}
          rows={5}
          placeholder=""
          value={system}
        />
      )}

      <div>
        {prompt.map((m, i) => (
          <TextArea
            key={i}
            className={s.user}
            label={m.role || '(unspecified role)'}
            onChange={(content) => handleContentChange(content, i)}
            rows={5}
            placeholder=""
            value={m.content}
          />
        ))}
      </div>

      <div
        className={s.io}
        style={{ '--size': p.input?.length } as React.CSSProperties}
      >
        <div className={s.assistant}>
          <div className={s.label}>
            {`Claude's Response`}
            {!!p.exercise &&
              (assistant[0] ? (
                correct ? (
                  <Check
                    aria-label="correct answer"
                    className={s.correct}
                    weight="bold"
                    size={16}
                  />
                ) : (
                  <X
                    aria-label="incorrect answer"
                    className={s.incorrect}
                    weight="bold"
                    size={16}
                  />
                )
              ) : null)}
          </div>
          <div className={s.content}>
            {assistant[0] ?? (
              <span className={s.placeholder}>(awaiting your input...)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default Interactive;

interface HeaderProps {
  empty: boolean;
  waiting: boolean;
  handleStop: () => void;
  handleRun: () => void;
  handleReset: () => void;
  handleReaderMode: () => void;
}
const Header = (p: HeaderProps) => {
  return (
    <div className={s.header}>
      {p.waiting ? (
        <IconLabelButton
          className={s.action}
          Icon={Stop}
          onPress={p.handleStop}
        >
          stop
        </IconLabelButton>
      ) : (
        <IconLabelButton
          className={s.action}
          isDisabled={p.empty}
          Icon={Play}
          onPress={p.handleRun}
        >
          run
        </IconLabelButton>
      )}

      <IconLabelButton
        className={s.action}
        Icon={ArrowClockwise}
        onPress={p.handleReset}
      >
        reset
      </IconLabelButton>

      <IconLabelButton
        className={s.action}
        Icon={BookOpen}
        onPress={p.handleReaderMode}
      >
        reader mode
      </IconLabelButton>
    </div>
  );
};
