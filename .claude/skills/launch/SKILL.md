---
name: launch
description: >-
  Publica a branch atual do octopage em produção (GitHub Pages). Roda os quality
  gates, commita o que falta, mergeia na main, faz push (dispara o CD) e acompanha
  o deploy do GitHub Actions até ficar verde. Use quando o usuário disser "launch",
  "sobe isso", "deploya", "manda pra prod" ou quiser finalizar/publicar a branch
  atual. Opcional: o usuário pode passar uma mensagem de commit como argumento.
---

# /launch — publicar o octopage em produção

Fluxo de finalização: branch de feature → `main` → GitHub Pages. **Push na `main`
dispara o CD** (`.github/workflows/deploy.yml` → build do Astro → `actions/deploy-pages`).
O usuário invocou `/launch`, então a intenção de deployar é explícita — mas **reporte
cada passo** e **pare se algum gate falhar**.

## 0. Descobrir o contexto

```bash
git branch --show-current    # branch atual (NÃO pode ser main)
git status --short           # o que está pendente
gh repo view --json nameWithOwner,homepageUrl --jq '.'
```

Se já estiver na `main` ou não houver branch de feature, **pare** e diga que não há
nada para publicar.

## 1. Quality gates

```bash
pnpm -r typecheck
OCTOPAGE_OFFLINE=1 pnpm --filter octopage-template build
pnpm exec playwright test --project=chromium
```

Se qualquer um **falhar**, **pare** e reporte a saída bruta — não commite.

`OCTOPAGE_OFFLINE=1` no gate local é proposital: o build normal vai à API do GitHub
(sync de discussions no modo 1, criação de discussion no modo 2) e um gate não deve
depender de rede nem escrever no repo público. O CD roda **sem** essa flag.

## 2. Commit do que falta

Se `git status --short` mostrar mudanças não commitadas:

- Stage só os arquivos da feature (nunca `node_modules/`, `dist/`, `.octopage/`,
  `test-results/`, `playwright-report/`, `.env`).
- Mensagem curta em **pt-BR**, conventional commit (`feat(...)`, `fix(...)`).
- Se o usuário passou argumento ao `/launch`, use-o como base da mensagem.
- Trailer: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

O repo tem o commit-lint do autoducks rodando em PR — mensagem fora do conventional
commit reprova o check.

## 3. Merge na main + push (dispara o CD)

```bash
git fetch origin --quiet
git checkout main
git pull --ff-only
git merge --ff-only "$FEAT"
git push origin main
```

- **`--ff-only`** sempre: se não for fast-forward, **pare** e reporte (a main divergiu,
  a decisão é do usuário).
- Se o fluxo do repo for por PR (autoducks está instalado e há rulesets), prefira
  `gh pr create` + `gh pr merge --merge` em vez do merge local, e **espere os checks**.

## 4. Limpar a branch

```bash
git branch -d "$FEAT"
git push origin --delete "$FEAT" 2>/dev/null || true
rm -rf test-results playwright-report 2>/dev/null
```

## 5. Acompanhar o deploy

```bash
gh run list --branch main --limit 1
gh run watch <run-id> --exit-status
```

- **Passou**: reporte ✅ + commit + a URL publicada (`gh repo view --json homepageUrl`).
  Opcionalmente `curl -sI <url>` para confirmar 200.
- **Falhou**: reporte o step quebrado (`gh run view <id> --log-failed`) e **não**
  re-deploye sozinho — o código já está na main; avise o usuário.

Falhas de deploy que aparecem aqui e não nos gates locais são quase sempre uma destas:

- **Token**: o build real chama a API do GitHub. O job precisa de `GITHUB_TOKEN` e,
  no modo `code`, de `discussions: write` para criar as discussions pareadas.
- **Base path**: `site.base` errado publica o site com todos os assets 404. Os testes
  de `e2e/site.spec.ts` cobrem isso — se passaram, o base está certo para o repo atual.
- **Discussions desabilitado** no repo de comentários: o build para com erro explícito.

## Guardrails

- Nunca force push; nunca commite secrets.
- Só publica a branch da sessão atual.
- Nunca commite `.octopage/` — é conteúdo gerado pelo sync, e no modo `discussions`
  as Discussions do repo são a fonte da verdade.
- Qualquer passo que falhe → pare e reporte; não mascare erro para "seguir o fluxo".
