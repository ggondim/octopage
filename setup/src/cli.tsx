#!/usr/bin/env node
import { useEffect, useState } from 'react';
import { Box, render, Text, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { Spinner } from '@inkjs/ui';
import {
  categorySettingsUrl,
  detectRepo,
  enableDiscussions,
  fetchRepoState,
  ghToken,
  type RepoRef,
  type RepoState,
} from './lib/github.js';
import { applyAnswers, type Answers } from './lib/scaffold.js';
import { selfDestruct } from './lib/cleanup.js';

type Step =
  | 'loading'
  | 'enable-discussions'
  | 'title'
  | 'description'
  | 'url'
  | 'base'
  | 'comments'
  | 'writing'
  | 'done'
  | 'error';

const cwd = process.cwd();

function Header() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="magenta">octopage</Text>
      <Text dimColor>A static site whose content and comments both live in GitHub.</Text>
    </Box>
  );
}

function Field({ label, hint, value, onChange, onSubmit }: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Box flexDirection="column">
      <Text><Text color="cyan">? </Text>{label}</Text>
      {hint && <Text dimColor>  {hint}</Text>}
      <Box>
        <Text color="cyan">{'> '}</Text>
        <TextInput value={value} onChange={onChange} onSubmit={onSubmit} />
      </Box>
    </Box>
  );
}

function App() {
  const { exit } = useApp();

  const [step, setStep] = useState<Step>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const [repo, setRepo] = useState<RepoRef | null>(null);
  const [state, setState] = useState<RepoState | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [base, setBase] = useState('');
  const [touched, setTouched] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  /*
   * Nothing here asks which repository this is, or where content comes from.
   * The repository is read from the git remote, and both content sources are
   * always active — so the only questions left are the ones no file already
   * answers.
   */
  useEffect(() => {
    void (async () => {
      try {
        const t = (await ghToken()) ?? process.env.GITHUB_TOKEN ?? null;
        setToken(t);

        const detected = await detectRepo(cwd);
        if (!detected) {
          setError(
            'No GitHub remote found. octopage derives the repository from `origin`.\n' +
              'Add one with `git remote add origin git@github.com:you/your-repo.git`.',
          );
          return setStep('error');
        }

        setRepo(detected);
        setTitle(detected.name);
        setUrl(`https://${detected.owner}.github.io`);
        setBase(`/${detected.name}`);

        if (!t) {
          setError(
            'No GitHub token. The Discussions API is GraphQL-only and rejects anonymous\n' +
              'requests, even for public repos. Run `gh auth login`, or set GITHUB_TOKEN.',
          );
          return setStep('error');
        }

        const s = await fetchRepoState(detected, t);
        setState(s);
        setStep(s.hasDiscussionsEnabled ? 'title' : 'enable-discussions');
      } catch (e) {
        setError((e as Error).message);
        setStep('error');
      }
    })();
  }, []);

  async function turnOnDiscussions() {
    if (!repo || !token) return;
    setStep('loading');
    const ok = await enableDiscussions(repo, token);
    if (!ok) {
      setError(
        `Could not enable Discussions on ${repo.owner}/${repo.name}.\n` +
          'The token may lack admin rights. Turn it on under Settings → General → Features.',
      );
      return setStep('error');
    }
    setState(await fetchRepoState(repo, token));
    setNotice('Discussions enabled.');
    setStep('title');
  }

  async function finish(commentsCategory: string) {
    setStep('writing');
    try {
      const answers: Answers = { title, description, siteUrl: url, base, commentsCategory };
      setTouched(await applyAnswers(cwd, answers));
      const cleanup = await selfDestruct(cwd);
      setRemoved(cleanup.removed);
      setStep('done');
      setTimeout(() => exit(), 50);
    } catch (e) {
      setError((e as Error).message);
      setStep('error');
    }
  }

  if (step === 'loading') return <Box flexDirection="column"><Header /><Spinner label="Talking to GitHub…" /></Box>;
  if (step === 'error') return <Box flexDirection="column"><Header /><Text color="red">{error}</Text></Box>;

  return (
    <Box flexDirection="column">
      <Header />
      {repo && <Text dimColor>repository: {repo.owner}/{repo.name}</Text>}
      {notice && <Text color="green">✓ {notice}</Text>}

      {step === 'enable-discussions' && (
        <Box flexDirection="column">
          <Text><Text color="yellow">! </Text>Discussions are off. octopage needs them for both content and comments.</Text>
          <SelectInput
            items={[
              { label: 'Enable Discussions now', value: 'yes' },
              { label: "I'll do it myself — continue", value: 'no' },
            ]}
            onSelect={(item) => (item.value === 'yes' ? void turnOnDiscussions() : setStep('title'))}
          />
        </Box>
      )}

      {step === 'title' && (
        <Field label="Site name" hint="also becomes the package name" value={title} onChange={setTitle} onSubmit={() => title && setStep('description')} />
      )}

      {step === 'description' && (
        <Field label="One-line description" value={description} onChange={setDescription} onSubmit={() => setStep('url')} />
      )}

      {step === 'url' && (
        <Field label="Site origin" hint="https://<user>.github.io, or your custom domain" value={url} onChange={setUrl} onSubmit={() => url && setStep('base')} />
      )}

      {step === 'base' && (
        <Field
          label="Base path"
          hint="/<repo> for a project page; / for a user site, custom domain or Vercel"
          value={base}
          onChange={setBase}
          onSubmit={() => setStep('comments')}
        />
      )}

      {step === 'comments' && (
        <Box flexDirection="column">
          <Text><Text color="cyan">? </Text>Which category should hold comment threads?</Text>
          <Text dimColor>  Categories cannot be created through the API — add one at {categorySettingsUrl(repo!)}</Text>
          <SelectInput
            items={[
              { label: 'Let the build decide (Announcements, or the first usable one)', value: '' },
              ...(state?.categories ?? []).map((c) => ({ label: `${c.name}  (${c.slug})`, value: c.name })),
            ]}
            onSelect={(item) => void finish(String(item.value))}
          />
        </Box>
      )}

      {step === 'writing' && <Spinner label="Writing…" />}

      {step === 'done' && (
        <Box flexDirection="column">
          <Text color="green">✓ Setup complete.</Text>
          {touched.map((f) => <Text key={f} dimColor>  updated {f}</Text>)}
          {removed.map((f) => <Text key={f} dimColor>  removed {f}</Text>)}
          <Box marginTop={1} flexDirection="column">
            <Text>Next:</Text>
            <Text dimColor>  pnpm install && pnpm dev</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

render(<App />);
