# Decisões técnicas

## API em C#, regras espelhadas no site

O escopo pedia tipos e regras de cotação compartilhados com o backend. Com a API em C#, o compartilhamento passou a ser feito por dados:

- `data/catalog.json` é a única fonte do cardápio para os dois lados.
- `QuoteEngine` (C#) é a autoridade do preço: o carrinho e a revisão só liberam a conclusão com a cotação devolvida pela API.
- `packages/domain` (TypeScript) repete as mesmas regras para mostrar o valor na hora em que o cliente escolhe sabores.
- `data/quote-cases.json` roda nos testes dos dois lados. Se as regras divergirem, um dos testes falha.

## Roteamento no GitHub Pages

`BrowserRouter` com URLs limpas. O build copia `index.html` para `404.html`; o Pages devolve esse arquivo para qualquer caminho desconhecido e o React abre a rota certa. O site fica na raiz de `usc-host.github.io`, então `base` é `/`.

## Loading e transições

- O `index.html` mostra o loader antes do bundle e só sai quando a primeira página já foi renderizada (`window.__bellaBoot.done()`), respeitando o tempo mínimo do reveal.
- `RouteStage` mantém a página antiga na tela, carrega o chunk da nova sob o loader e só então troca. Rotas já carregadas usam a versão breve (cerca de 380 ms), rotas novas a completa (700 ms). Há identificador por navegação, então uma resposta antiga nunca reabre uma tela anterior, além de timeout de 12 s com "Tentar novamente" e "Voltar".
- Busca, filtros e ordenação ficam na query string e não disparam o loader.
- Voltar e avançar restauram a rolagem; navegação nova começa no topo e move o foco para o conteúdo principal.

## Tema

O script no `<head>` aplica o tema salvo, ou o do sistema, antes da primeira pintura. O `ThemeProvider` alimenta o `ConfigProvider` do antd e as variáveis CSS, que também valem para portais e toasts. A troca usa o Animated Theme Toggler fornecido na especificação (variante círculo, 400 ms), com ícones do antd e troca imediata quando o visitante pede movimento reduzido.

## Assistente

- Navegador, `POST /api/chat` (SSE), orquestrador em C#, Gemini via REST com `x-goog-api-key`, igual à integração do projeto UNI: timeout por chamada, novas tentativas só para falhas temporárias e modelo reserva opcional.
- Ferramentas: `search_menu`, `get_product`, `quote_cart`, `get_store_info`, `propose_cart_change` e `show_products` (cards clicáveis com ID real). Todo argumento é validado no servidor e IDs inexistentes voltam ao modelo como erro.
- As partes devolvidas pelo modelo (incluindo `thoughtSignature`) são reenviadas sem alteração entre rodadas de ferramenta.
- Mensagens do cliente, carrinho e textos do cardápio entram como dados. O carrinho enviado ao modelo tem só nome, quantidade e escolhas, sem dados pessoais.
- Propostas de carrinho aparecem como cartão; o cliente confirma, o site recota na API e marca a proposta como aplicada. Confirmar de novo não duplica o item.
- Toda saída de texto passa por um filtro que troca travessões por vírgula ou hífen.
- Conversa salva só no `sessionStorage` da aba, com botão para limpar. A API não guarda conversas.

## Dados

Cada registro tem `status`: `observed`, `conflicting`, `demo` ou `pending`. O site só mostra informações da loja com `observed` ou `approved`; o resto o assistente responde como "confirmar com a loja". Valores ilustrativos (frações de pizza, preços de broto, sabores de esfiha e grupos dos combos) estão marcados como `demo` no catálogo e listados em [pendencias.md](pendencias.md).

## Imagens

As fotos são carregadas direto do CDN público do InstaDelivery, sem cópia local. Itens sem foto usam ilustração desenhada em SVG, que representa a categoria e nunca um prato específico.
