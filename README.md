# Bella Massa

Cardápio digital da Bella Massa Pizzas e Esfihas, com configurador de pizzas, carrinho e um assistente de IA (Gemini) que consulta o mesmo catálogo do site.

- Site: React 19, TypeScript, Vite, Ant Design 6, react-hot-toast, React Router. Publicado no GitHub Pages.
- API: ASP.NET Core (.NET 10) em C#, com o assistente, as ferramentas do cardápio e a cotação oficial. Publicada no Render via Docker.
- Dados: `data/catalog.json`, compartilhado pelo site e pela API, com fonte e situação de cada registro.

## Estrutura

```text
apps/web/            site (Vite)
  src/app/           providers, rotas e coordenador de transições
  src/components/    marca (logo, loader), layout e componentes de interface
  src/features/      tema, carrinho, configurador e chat
  src/pages/         páginas
  src/styles/        tokens e estilos
apps/api/            solução .NET
  src/BellaMassa.Domain/  catálogo, busca e cotação (autoridade do preço)
  src/BellaMassa.Api/     endpoints, limites e assistente Gemini
  tests/BellaMassa.Tests/ testes xUnit
packages/domain/     tipos e regras em TypeScript para a prévia instantânea no site
data/                catálogo e casos de cotação compartilhados
docs/                decisões, pendências, avaliação e roteiro da apresentação
```

## Como rodar

Requisitos: Node 22.18 ou superior e .NET SDK 10.

```bash
npm install
npm run dev:api     # API em http://localhost:8787
npm run dev         # site em http://localhost:5173
```

Sem chave do Gemini a API sobe em **modo local**: respostas por regras simples, identificadas no chat como "modo local". Serve para desenvolver a interface, não substitui a integração real. Para usar o Gemini em desenvolvimento:

```bash
dotnet user-secrets set GEMINI_API_KEY "sua-chave" --project apps/api/src/BellaMassa.Api
```

## Variáveis de ambiente

API (Render ou user-secrets), lista completa em `apps/api/.env.example`:

| Variável | Uso |
|---|---|
| `GEMINI_API_KEY` | Chave do Google AI Studio. Sem ela, produção fica com o assistente indisponível. |
| `GEMINI_MODEL` | Modelo principal, padrão `gemini-3.5-flash-lite`. |
| `GEMINI_FALLBACK_MODEL` | Modelo tentado após falhas temporárias ou quando o principal trava, como `gemini-3.1-flash-lite`. Opcional. |
| `GEMINI_THINKING_LEVEL` | `minimal`, `low`, `medium` ou `high`, para modelos que aceitam. |
| `ALLOWED_ORIGINS` | Origens do site autorizadas no CORS. |
| `CHAT_*`, `QUOTES_*` | Limites de mensagem, histórico, ferramentas, tempo e taxa por IP. |
| `DATABASE_URL` | Postgres do programa de fidelidade (no Render, a Internal Database URL). Sem ela, em produção o programa fica indisponível; em desenvolvimento usa um banco em memória. |
| `RESEND_API_KEY` | Chave do Resend para enviar o código de 6 dígitos por e-mail. Sem ela, fora de produção o código aparece na tela. |
| `EMAIL_FROM` | Remetente, padrão `Bella Massa <onboarding@resend.dev>`. Com o remetente padrão o Resend só entrega para o e-mail dono da conta. |

Site (variáveis do repositório no GitHub ou `apps/web/.env.local`):

| Variável | Uso |
|---|---|
| `VITE_API_URL` | Endereço público da API no Render. |
| `VITE_ORDER_WHATSAPP` | Número que recebe o resumo do pedido. Vazio mostra só "Copiar resumo". |

## Testes e verificação

```bash
npm run check       # travessões, tipos, testes TS, testes C# e build
npm test            # Vitest: regras de cotação e casos compartilhados
npm run test:api    # xUnit: cotação, endpoints e assistente com Gemini simulado
```

`data/quote-cases.json` é executado pelos dois motores de cotação, C# e TypeScript, para garantir que o valor exibido no navegador é o mesmo que a API confirma.

## Publicação

- **Site:** o workflow `.github/workflows/pages.yml` testa, gera `apps/web/dist` e publica no GitHub Pages. O build copia `index.html` para `404.html`, então rotas como `/cardapio` funcionam ao abrir o link direto ou recarregar.
- **API:** `render.yaml` cria o serviço Docker usando o `Dockerfile` da raiz. Cadastre `GEMINI_API_KEY` no painel do Render.

Mais detalhes em [docs/arquitetura.md](docs/arquitetura.md), [docs/pendencias.md](docs/pendencias.md), [docs/avaliacao-assistente.md](docs/avaliacao-assistente.md) e [docs/apresentacao.md](docs/apresentacao.md).
