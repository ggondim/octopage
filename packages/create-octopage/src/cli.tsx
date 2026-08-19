#!/usr/bin/env node
import React, { useEffect, useState } from 'react';
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
  type Category,
  type RepoRef,
  type RepoState,
} from './lib/github.js';
import { writeConfig, writeStarterContent, type Answers } from './lib/scaffold.js';

type Step =
  | 'loading'
  | 'repo'
  | 'source'
  | 'enable-discussions'
  | 'content-category'
  | 'comments-category'
  | 'giscus-repo-id'
  | 'site-title'
  | 'site-url'
  | 'site-base'
  | 'writing'
  | 'done'
  | 'error';

const cwd = process.cwd();

function Header() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="magenta">
        octopage
      </Text>
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
      <Text>
        <Text color="cyan">? </Text>
        {label}
      </Text>
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
  const [repoInput, setRepoInput] = useState('');
  const [state, setState] = useState<RepoState | null>(null);

  const [source, setSource] = useState<'discussions' | 'code'>('discussions');
  const [contentCategory, setContentCategory] = useState('General');
  const [commentsCategory, setCommentsCategory] = useState<Category | null>(null);
  const [repoId, setRepoId] = useState('');

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [base, setBase] = useState('');
  const [written, setWritten] = useState<string[]>([]);

  // Bootstrap: token + repo detection, so the common case needs no typing.
  useEffect(() => {
    void (async () => {
      const t = (await ghToken()) ?? process.env.GITHUB_TOKEN ?? null;
      setToken(t);

      const detected = await detectRepo(cwd);
      if (detected) {
        setRepoInput(`${detected.owner}/${detected.name}`);
        setTitle(detected.name);
        setUrl(`https://${detected.owner}.github.io`);
        setBase(`/${detected.name}`);
      }
      setStep('repo');
    })();
  }, []);

  async function loadRepo(ref: RepoRef) {
    if (!token) {
      setError(
        'No GitHub token. The Discussions API is GraphQL-only and rejects anonymous requests,\n' +
          'even for public repos. Run `gh auth login`, or set GITHUB_TOKEN, then try again.',
      );
      setStep('error');
      return;
    }
    try {
      const s = await fetchRepoState(ref, token);
      setState(s);
      setRepoId(s.id);
      setStep(s.hasDiscussionsEnabled ? 'source' : 'enable-discussions');
    } catch (e) {
      setError((e as Error).message);
      setStep('error');
    }
  }

  async function turnOnDiscussions() {
    if (!repo || !token) return;
    setStep('loading');
    const ok = await enableDiscussions(repo, token);
    if (!ok) {
      setError(
        `Could not enable Discussions on ${repo.owner}/${repo.name}.\n` +
          'The token may lack admin rights. Turn it on under Settings → General → Features.',
      );
      setStep('error');
      return;
    }
    const s = await fetchRepoState(repo, token);
    setState(s);
    setNotice('Discussions enabled.');
    setStep('source');
  }

  async function finish(commentsChoice: Answers['comments']) {
    setStep('writing');
    try {
      const answers: Answers = {
        owner: repo!.owner,
        name: repo!.name,
        source,
        title,
        description: '',
        url,
        base: base || '/',
        contentCategory,
        comments: commentsChoice,
      };
      const files = [await writeConfig(cwd, answers)];
      if (source === 'code') files.push(...(await writeStarterContent(cwd)));
      setWritten(files);
      setStep('done');
      setTimeout(() => exit(), 50);
    } catch (e) {
      setError((e as Error).message);
      setStep('error');
    }
  }

  if (step === 'loading') {
    return (
      <Box flexDirection="column">
        <Header />
        <Spinner label="Talking to GitHub…" />
      </Box>
    );
  }

  if (step === 'error') {
    return (
      <Box flexDirection="column">
        <Header />
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Header />
      {notice && <Text color="green">✓ {notice}</Text>}

      {step === 'repo' && (
        <Field
          label="Which repository holds the content and comments?"
          hint="owner/name — must be public for readers to see the discussions"
          value={repoInput}
          onChange={setRepoInput}
          onSubmit={() => {
            const [owner, name] = repoInput.split('/');
            if (!owner || !name) return;
            const ref = { owner, name };
            setRepo(ref);
            setStep('loading');
            void loadRepo(ref);
          }}
        />
      )}

      {step === 'enable-discussions' && (
        <Box flexDirection="column">
          <Text>
            <Text color="yellow">! </Text>
            Discussions are turned off on {repo?.owner}/{repo?.name}. octopage needs them for both
            content and comments.
          </Text>
          <SelectInput
            items={[
              { label: 'Enable Discussions now', value: 'yes' },
              { label: "I'll enable it myself — continue anyway", value: 'no' },
            ]}
            onSelect={(item) => {
              if (item.value === 'yes') void turnOnDiscussions();
              else setStep('source');
            }}
          />
        </Box>
      )}

      {step === 'source' && (
        <Box flexDirection="column">
          <Text>
            <Text color="cyan">? </Text>Where will you write?
          </Text>
          <SelectInput
            items={[
              { label: 'GitHub Discussions only — publish straight from the GitHub editor', value: 'discussions' },
              { label: 'MDX in the repo + Discussions for comments — previewable locally', value: 'code' },
            ]}
            onSelect={(item) => {
              const value = item.value as 'discussions' | 'code';
              setSource(value);
              setStep(value === 'discussions' ? 'content-category' : 'comments-category');
            }}
          />
        </Box>
      )}

      {step === 'content-category' && (
        <Box flexDirection="column">
          <Text>
            <Text color="cyan">? </Text>Which category holds your pages?
          </Text>
          <Text dimColor>
            {'  '}Categories cannot be created through the API — add one at {categorySettingsUrl(repo!)}
          </Text>
          <SelectInput
            items={(state?.categories ?? []).map((c) => ({ label: `${c.name}  (${c.slug})`, value: c.name }))}
            onSelect={(item) => {
              setContentCategory(String(item.value));
              setStep('comments-category');
            }}
          />
        </Box>
      )}

      {step === 'comments-category' && (
        <Box flexDirection="column">
          <Text>
            <Text color="cyan">? </Text>Which category should hold comment threads?
          </Text>
          <Text dimColor>
            {'  '}An announcement-style category is the usual pick, so only you can open threads.
          </Text>
          <SelectInput
            items={[
              ...(state?.categories ?? [])
                .filter((c) => c.name !== contentCategory || source === 'code')
                .map((c) => ({ label: `${c.name}  (${c.slug})`, value: c.id })),
              { label: 'Skip — no comments for now', value: '' },
            ]}
            onSelect={(item) => {
              const id = String(item.value);
              setCommentsCategory(id ? (state?.categories.find((c) => c.id === id) ?? null) : null);
              setStep('site-title');
            }}
          />
        </Box>
      )}

      {step === 'site-title' && (
        <Field
          label="Site title"
          value={title}
          onChange={setTitle}
          onSubmit={() => title && setStep('site-url')}
        />
      )}

      {step === 'site-url' && (
        <Field
          label="Site origin"
          hint="https://<user>.github.io for a project site, or your custom domain"
          value={url}
          onChange={setUrl}
          onSubmit={() => url && setStep('site-base')}
        />
      )}

      {step === 'site-base' && (
        <Field
          label="Base path"
          hint="/<repo> for a project site; / for a user site or custom domain"
          value={base}
          onChange={setBase}
          onSubmit={() =>
            void finish(
              commentsCategory
                ? { repoId, category: commentsCategory.name, categoryId: commentsCategory.id }
                : false,
            )
          }
        />
      )}

      {step === 'writing' && <Spinner label="Writing config…" />}

      {step === 'done' && (
        <Box flexDirection="column">
          <Text color="green">✓ Setup complete.</Text>
          {written.map((f) => (
            <Text key={f} dimColor>
              {'  '}wrote {f.replace(`${cwd}/`, '')}
            </Text>
          ))}
          <Box marginTop={1} flexDirection="column">
            <Text>Next:</Text>
            <Text dimColor>{'  '}pnpm install && pnpm dev</Text>
            {commentsCategory === null && (
              <Text dimColor>
                {'  '}comments are off — add giscus values from https://giscus.app to enable them
              </Text>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

render(<App />);
