# Bella Massa - escopo do projeto

Versão 1 · 03/11/2026 · Projeto acadêmico de cardápio digital com inteligência artificial.

## 1. Objetivo e definição de sucesso

Criar uma experiência de pizzaria com identidade própria, muito bem acabada, responsiva e agradável: encontrar produtos, montar pizzas e esfihas, revisar um carrinho e receber ajuda de um chatbot IA que consulta o mesmo catálogo do site. A integração com IA é o centro acadêmico do projeto; o frontend deve demonstrar esse valor com qualidade visual, sem parecer um painel administrativo ou um template genérico de delivery.

Entregas desta etapa: escopo, levantamento das referências e prompt de implementação. O site e o backend serão construídos a partir desses documentos. Não há publicação ou integração operacional realizada nesta etapa.

## 2. Requisitos fixados pelo usuário

- React, Ant Design (`antd`) e `react-hot-toast`.
- Marca Bella Massa; identidade com vermelho, verde e amarelo, com texto predominantemente preto no tema claro.
- Tema claro e escuro, ambos desenhados com cuidado.
- Reveal da logo com seu fundo preservado, em todo carregamento de página.
- Toda troca real de página deve apresentar o loading de marca.
- Texto cíclico: `Carregando.` → `Carregando..` → `Carregando...`.
- A animação definitiva da troca de tema será fornecida posteriormente em `<theme_change_animation></theme_change_animation>`.
- Usar LojaBetero como referência de acabamento, componentes e movimento.
- Aproveitar os dados públicos dos dois cardápios indicados, registrando conflitos e procedência.

## 3. Limites e fases

### P0 - entrega acadêmica essencial

1. Design system e layout responsivo nos dois temas.
2. Início/cardápio, busca, categorias, produtos e personalização.
3. Carrinho persistente e revisão de pedido de demonstração.
4. Chatbot com modelo de linguagem real no backend, consulta ao catálogo e ferramentas tipadas.
5. Sugestões da IA que abrem produtos ou propõem inclusão no carrinho mediante ação do cliente.
6. Loading de marca, animações, estados de erro e acessibilidade.
7. Catálogo versionado com fonte e situação de validação.
8. Testes dos cálculos e dos fluxos essenciais, avaliação do chatbot, documentação e roteiro de apresentação.

### P1 - operação assistida, após validação comercial

- Gestão restrita de produtos, disponibilidade, horários, taxas, FAQs e promoções.
- Encaminhamento de resumo por WhatsApp mediante clique do cliente e número validado.
- Cadastro e histórico de pedidos, somente se houver armazenamento e identidade implementados.
- Publicação operacional após revisão dos dados pela pizzaria.

### P2 - integrações dependentes de terceiros

- Pedidos sincronizados com InstaDelivery por API oficialmente disponível e autorizada.
- Pagamentos, cupons validados, fidelidade, acompanhamento em tempo real e notificações.
- Integração de estoque, cozinha e motoboys.

Não simular pagamento aprovado, pedido recebido pela pizzaria, rastreamento real ou saldo de fidelidade no MVP. Uma tela de conclusão deve dizer “Pedido de demonstração” e explicar que não foi enviado. Abrir o cardápio externo não transfere automaticamente o carrinho.

## 4. Direção visual

Conceito: **pizzaria artesanal contemporânea**, acolhedora e com apetite visual. Fundo creme, títulos fortes, fotos grandes e recortes bem cuidados, pequenos acentos italianos e bastante espaço para respirar. No escuro, carvão quente e superfícies elevadas; manter as fotos em cor.

| Token proposto | Claro | Escuro | Uso |
|---|---|---|---|
| Fundo | `#FFF9F0` | `#141311` | Base quente |
| Superfície | `#FFFFFF` | `#211E1A` | Cards, drawer e chat |
| Texto principal | `#191714` | `#F7F0E7` | Leitura |
| Texto secundário | `#62594F` | `#C2B8AA` | Descrições |
| Vermelho | `#B92C28` | `#EF756B` | Marca e ação principal |
| Verde | `#236544` | `#7BC49A` | Disponibilidade e apoio |
| Amarelo | `#F2BF4B` | `#F2BF4B` | Destaques com texto escuro |

Paleta inicial de projeto, sujeita a teste de contraste em cada combinação. Botão vermelho no escuro pode usar fundo vermelho mais profundo com texto claro, sem exigir que o token de texto de marca seja também o fundo do botão. Cor não deve ser o único sinal de estado.

Tipografia proposta: títulos com uma serifada expressiva como Fraunces; interface com uma sans legível como Manrope, usando arquivos licenciados e fallback local. Corpo 16 px, preços com hierarquia forte, títulos com escala fluida. No máximo duas famílias. Fotografias reais da pizzaria, quando disponíveis e aprovadas; nunca atribuir foto de outro prato como se fosse daquele produto.

Grid desktop de até 1240 px, margens fluidas, espaços em escala de 4/8 px. Cards de 18-24 px de raio, sombra suave e borda discreta. Ant Design deve receber tokens de marca e ajustes por componente; sua aparência padrão não define a direção visual.

### Composição da primeira dobra

- Cabeçalho com logo, Cardápio, Combos, Sobre, tema e carrinho.
- Hero compacto: título editorial, foto real em destaque, “Ver cardápio” e “Me ajude a escolher”. Não ocupar a tela inteira com publicidade antes do cardápio.
- Faixa curta de informações verificadas: região atendida, horário e entrega; dados pendentes não viram promessas.
- Categorias acessíveis logo abaixo, seguidas de produtos e combos.
- Chat visível por um botão discreto “Ajuda para escolher”, sem popup automático.

## 5. Páginas e comportamento

| Rota | Conteúdo | Estados essenciais |
|---|---|---|
| `/` | Hero, destaques editoriais, categorias, acesso à IA | carregando, erro, sem destaques |
| `/cardapio` | Busca, categorias, filtros, produtos | skeleton, sem resultado, catálogo indisponível |
| `/produto/:slug` | Foto, descrição, tamanho, sabores, borda, extras | inválido, esgotado, configuração incompleta |
| `/combos` | Combos disponíveis e montagem | incompleto, oferta encerrada |
| `/carrinho` | Itens, editar, quantidade, totais e revisão | vazio, preço atualizado, item indisponível |
| `/revisao` | Resumo final, indicação de demonstração | inconsistência, cotação expirada |
| `/sobre` | Informações confirmadas, contato e origem acadêmica | informação ainda não validada |
| `*` | 404 com retorno ao cardápio | navegação recuperável |

O chat é persistente entre rotas; abrir/fechar não cria nova conversa. Desktop: painel lateral de cerca de 400 px. Mobile: drawer de tela cheia com teclado, safe area, rolagem e fechamento acessíveis.

Mobile: cabeçalho compacto, categorias com rolagem horizontal sem esconder o foco, cards fáceis de tocar e barra inferior para Cardápio, Combos e Carrinho. O chat não pode cobrir o botão de finalizar. Configurador com botão de adicionar fixo na base e conteúdo rolável acima.

Busca por nome e ingredientes cadastrados, sem diferenciar maiúsculas ou acentos. Filtros por preço, categoria e características somente quando houver dados confirmados. Categorias, busca, ordenação, modal e chat não contam como troca de página se permanecem na mesma rota; não disparar splash para cada interação.

## 6. Montagem e regras de negócio

- Produtos simples, pizzas configuráveis, esfihas por unidade e combos usam modelos próprios.
- Tamanho e número de sabores dependem do produto. Há exemplos reais de grande com 1-4 sabores, broto com até 2 e Pizza Trem com 4; não aplicar o mesmo limite a todos.
- Seleção exibe `2 de 2 sabores`, opções indisponíveis e mensagem contextual para falta/excesso.
- Borda, extras, observações e quantidades aparecem no resumo antes de adicionar.
- Combos devem verificar a soma das quantidades e os grupos de escolhas permitidos, incluindo bebida quando prevista.
- Todo dinheiro é inteiro em centavos, com apresentação `pt-BR`/BRL.
- Não presumir “valor do sabor mais caro”, média ou soma sem regra validada. O modal do InstaDelivery exibe valores que parecem por fração, mas o total não foi confirmado por pedido.
- Cada variante terá `pricingPolicy` explícita: preço fixo, soma de parcelas cadastradas, preço máximo ou outra política aprovada. Regras desconhecidas bloqueiam cotação operacional.
- No modo acadêmico, uma política ilustrativa pode ser usada, desde que identificada como demonstração e isolada dos dados observados.
- Backend recalcula valores, disponibilidade e elegibilidade; não confia nos totais enviados pelo navegador ou pelo modelo IA.
- Preço “a partir de” nunca é apresentado como total fechado de uma personalização.
- Bebidas não são gratuitas porque um agrupador exibe R$ 0,00.
- Promoções exigem vigência e condições. Não reativar campanhas de setembro/outubro ou cupons apenas porque continuam publicados.
- Pedido mínimo, frete, área atendida e horário dependem de validação. Não substituir desconhecido por zero.
- Carrinho local versionado, sem dados sensíveis, com migração simples e recuperação de JSON inválido. Ao reabrir, revalidar produtos e preços.
- Sem login obrigatório para navegar ou conversar no MVP.

## 7. Sistema de movimento

### Loading de marca

Componente compartilhado `BrandLoader`, integrado a `RouteTransitionProvider`, às fronteiras de carregamento e ao bootstrap inicial. A logo inteira entra por máscara/reveal horizontal ou vertical, preservando proporção, texto e fundo. Não separar letras, deformar, recortar partes permanentes ou aplicar o salto da marca Betero.

Coreografia proposta: fundo do tema aparece em 120-180 ms; reveal em 450-600 ms com easing suave; logo permanece legível; saída em 180-250 ms com opacidade. Carregamento longo pode repetir suavemente o reveal após uma pausa. Usar marca estática se a imagem falhar.

Pontos mudam a cada 450 ms, com largura reservada para evitar deslocamento. Leitor de tela recebe apenas “Carregando página”, sem anúncio repetido dos pontos. Bootstrap deve mostrar o loader antes do bundle React e encerrar somente quando o conteúdo crítico estiver pronto. Não aguardar todas as imagens fora da tela.

Toda navegação real entre rotas, inclusive voltar/avançar, executa o ciclo; navegações instantâneas usam versão breve de aproximadamente 300-450 ms. Não forçar o visitante a esperar um ciclo completo de pontos. Requisições lentas mantêm o loader até resolver ou apresentar erro. Requisições concorrentes e navegações rápidas precisam de identificador/cancelamento para que uma resposta antiga não reabra uma tela anterior. Timeout de 10-15 s oferece tentar novamente e voltar; nunca loop infinito.

Loadings locais usam versão compacta da marca quando apropriado, preservando a tela e o contexto. Botões podem mostrar indicador curto integrado; respostas do chat usam estado local “Consultando o cardápio”. Nunca cobrir o site todo enquanto a pessoa conversa.

### Outros movimentos

| Interação | Especificação proposta |
|---|---|
| Entrada de seção | opacidade e deslocamento de 12-20 px, 350-500 ms, uma vez |
| Card hover | elevação de 2-4 px e foto até 1.03, 180-240 ms |
| Botão pressionado | escala 0.98, 100-140 ms |
| Categoria ativa | indicador deslizante, 220-300 ms |
| Drawer e chat | opacidade e pequeno deslocamento, 220-320 ms |
| Adicionar ao carrinho | badge discreto + toast único, sem interromper navegação |

`prefers-reduced-motion` reduz movimentos a mudança imediata ou fade curto, com logo estática. Não usar parallax obrigatório, flashes ou animações contínuas nos cards.

### Tema

`ThemeProvider` mantém `light`, `dark` e preferência do sistema quando não houver escolha salva. Aplicar preferência antes da primeira pintura para evitar flash. Integrar algoritmo e tokens no `ConfigProvider`; garantir coerência também em portais, modais e toasts. Trocar tema preserva carrinho, conversa, scroll e foco.

A especificação em `<theme_change_animation>` no prompt prevalece. Enquanto não for fornecida, implementar a infraestrutura e fallback discreto; não considerar uma animação inventada como entrega definitiva. A referência Betero tem reveal circular com View Transitions, mas o usuário ainda enviará sua escolha.

## 8. Chatbot IA - funcionalidade central

Nome de interface provisório: **Assistente Bella Massa**, identificado claramente como IA. Tom próximo, objetivo e brasileiro, com poucas mensagens longas. Abertura sugerida: “Quer uma ajuda para escolher? Me conte o que você gosta.” Sugestões: “Quero dividir com amigos”, “Buscar por ingrediente”, “Ver opções doces”, “Montar uma pizza”.

### Capacidades P0

- Encontrar produtos e explicar ingredientes efetivamente cadastrados.
- Recomendar por preferências e orçamento; perguntar apenas o que estiver faltando.
- Distinguir preço base, adicionais e entrega. Se orçamento não inclui frete conhecido, explicitar essa limitação.
- Comparar até três opções em cards com nome, imagem, preço cotado e ação.
- Conduzir tamanho, sabores, borda e quantidade, validando cada combinação.
- Responder informações da loja e FAQ apenas com dados aprovados.
- Propor inclusão ou alteração no carrinho, mostrando resumo para confirmação do cliente.
- Se não souber, dizer o que falta e oferecer atendimento humano por link; não enviar mensagens automaticamente.

### Arquitetura da IA

Navegador → endpoint próprio → orquestrador do modelo → ferramentas de catálogo/cotação → resposta textual e cards estruturados. Chave do provedor fica apenas no servidor. Provedor/modelo configuráveis; a escolha final depende do orçamento e das credenciais, sem travar o frontend.

Ferramentas propostas:

| Ferramenta | Entrada | Saída/limite |
|---|---|---|
| `search_menu` | texto, categoria, preferências, teto de valor | IDs e dados aprovados; sem inventar disponibilidade |
| `get_product` | ID | variantes, ingredientes e grupos de opções |
| `quote_cart` | IDs, configurações e quantidades | totais determinísticos, validações e validade |
| `get_store_info` | assunto | informação aprovada ou situação pendente |
| `propose_cart_change` | ação e configuração | proposta exibida ao cliente; não conclui pedido |

Catálogo estruturado e FAQ versionados são suficientes para o MVP; busca semântica/RAG pode entrar se o volume de textos justificar. Vetores não são fonte de preço ou disponibilidade. O modelo usa IDs retornados pelas ferramentas; o backend valida schema, limites e existência de cada ID. Conteúdo de produtos e mensagens do usuário são dados, não instruções privilegiadas.

Para efetivar proposta, o cliente confirma; a aplicação revalida a cotação. IA não cria descontos, não calcula preços por texto livre e não declara pedido aceito. Ingrediente ausente da descrição não prova ausência de alérgeno: responder que não há confirmação e encaminhar à loja, sem alegar segurança alimentar.

Chat deve ter resposta em fluxo quando suportada, botão de parar, tentar novamente, erro contextual e histórico da sessão. Não persistir conversas indefinidamente por padrão. Oferecer limpar conversa e indicar eventual armazenamento. Não solicitar endereço/telefone para uma recomendação; não enviar esses dados ao modelo sem necessidade.

Limites iniciais configuráveis: tamanho de mensagem, contexto máximo, quantidade de chamadas de ferramenta por rodada, timeout e taxa de chamadas por sessão/IP. Exibir indisponibilidade da IA honestamente; um modo mock separado serve para desenvolvimento, mas não substitui a demonstração da integração real.

## 9. Arquitetura de aplicação proposta

- Frontend: React + TypeScript, Vite e roteamento React; Ant Design e `@ant-design/icons`; CSS com tokens e componentes próprios; `react-hot-toast` como canal único de toast.
- Estado: providers/reducer para carrinho, tema e conversa no MVP; catálogo e cotação com camada de consulta e cache. Evitar estado global para campos efêmeros.
- Backend: serviço TypeScript com API HTTP, adaptador do provedor IA, validação de entrada, catálogo e cotação. Pode ser Node ou runtime equivalente do ambiente de hospedagem; essa escolha deve ser documentada na implementação.
- Persistência P0: catálogo/FAQ versionados e carrinho local. P1 adiciona banco relacional e autenticação para gestão; não inventar necessidade de conta de cliente no P0.
- Assets locais com procedência, alt text e dimensões conhecidas; comprimir fotos e priorizar apenas a imagem principal.
- Configuração por ambiente, `.env.example` sem segredos e lockfile. Fixar versões compatíveis ao iniciar a implementação.

Estrutura sugerida:

```text
apps/web/src/
  app/               # providers, router, boundaries
  components/brand/  # Logo, BrandLoader, transição
  components/ui/     # componentes de marca sobre antd
  features/catalog/
  features/product-builder/
  features/cart/
  features/chat/
  features/theme/
  pages/
  styles/
apps/api/src/
  catalog/
  pricing/
  assistant/
  routes/
packages/domain/     # tipos e regras compartilhados
data/                # seed, FAQ, fontes, validação
docs/                # setup, decisões e apresentação
```

### Dados e contratos

Entidades: `Store`, `Category`, `Product`, `Variant`, `Flavor`, `OptionGroup`, `Option`, `ComboRule`, `Promotion`, `SourceRecord`, `CartLine`, `Quote`, `ChatSession`, `ChatMessage` e `CartProposal`.

`SourceRecord`: URL, data de consulta, campo original, valor observado, canal, situação (`observed`, `conflicting`, `approved`, `demo`) e data de aprovação. Produtos repetidos em categorias diferentes exigem resolução de identidade; não deduplicar só pelo nome. Ingredientes desconhecidos permanecem desconhecidos.

`GET /api/menu`: catálogo aprovado ou seed explicitamente de demonstração, com versão. `GET /api/products/:id`: detalhes. `GET /api/store`: informações verificadas. `POST /api/quotes`: configuração → cotação em centavos e erros por campo. `POST /api/chat`: mensagem e contexto mínimo → resposta e propostas estruturadas. Nenhum endpoint público de escrita administrativa no P0.

`Quote`: ID, versão do catálogo, linhas, subtotal, adicionais, desconto validado, frete conhecido ou `null`, total conhecido ou parcial, moeda, expiração e avisos. `CartProposal`: ID, operação, configuração, cotação associada e validade. Reenvio da mesma confirmação não duplica itens; proposta já aplicada deve ser identificada.

## 10. Qualidade e aceite

- Validar visualmente em 360, 390, 768, 1280 e 1440 px, nos dois temas, sem rolagem horizontal acidental.
- Conferir por teclado foco, menus, drawer, modal, configurador e chat; restaurar foco ao fechar. Nome acessível em todos os botões de ícone.
- Contraste de texto normal de pelo menos 4,5:1; texto grande e elementos relevantes de 3:1. Alvos de toque preferencialmente 44 px.
- Rotas diretas e recarregamento funcionam; título de página e foco principal mudam após navegação.
- Skeleton não provoca salto grosseiro; imagem reserva proporção; lazy loading não se aplica à imagem crítica do hero.
- Loja fechada continua permitindo consulta; pedido real depende da política aprovada.
- Nenhum botão decorativo aparentando funcionar; nenhuma avaliação, promoção ou disponibilidade fabricada.
- Testar cálculo monetário, frações, extras, limites de sabores, combos, carrinho restaurado, cotação vencida e alteração de catálogo.
- Testar navegação rápida, voltar/avançar, falha de rede, timeout, falta de logo e modo de movimento reduzido.
- Testar chatbot com produto inexistente, pedido fora do orçamento, informação conflitante, tentativa de instrução maliciosa, alergia, falha do provedor e confirmação duplicada.
- Avaliação acadêmica com pelo menos 20 casos registrados: intenção, dados de referência, ferramentas chamadas, resposta esperada, resultado e observação. Exigir zero preços/ingredientes inventados na amostra; registrar limitações sem esconder falhas.
- Executar build, checagem de tipos e testes essenciais; documentar exatamente o que foi validado.

Metas de desempenho propostas: LCP até 2,5 s, CLS até 0,1 e INP até 200 ms em avaliação representativa; medir e reportar, sem alegar resultado antes de testar. O loading visual não pode mascarar atraso desnecessário.

## 11. Sequência de implementação

1. Validar seed, logo e dados comerciais; manter pendências explícitas.
2. Criar shell, tokens, temas, loader e primeira dobra; revisar desktop/mobile.
3. Implementar catálogo, configurador e cotação determinística.
4. Conectar carrinho, revisão e persistência.
5. Implementar ferramentas IA e conectar modelo real; a partir daí, iterar na conversa e cards.
6. Completar erros, acessibilidade, animação definitiva de tema e testes.
7. Preparar apresentação, README, variáveis de ambiente e evidências.

Roteiro de apresentação: abrir site → mostrar loading/reveal → trocar tema → buscar sabor → pedir recomendação à IA → conferir fonte/valor → configurar pizza → confirmar proposta no carrinho → revisar pedido de demonstração → mostrar resposta honesta para dado desconhecido.

Pendências externas: arquivo final da logo; animação da tag; fonte comercial preferida; horários, entrega, preços por fração e vigência; provedor IA e credenciais; eventual API InstaDelivery. Essas pendências não impedem construir o protótipo identificado como demonstração.

## 12. Referências

- [InstaDelivery Bella Massa](https://instadelivery.com.br/bellamassapizzaseesfihas) - consulta real no navegador em 03/11/2026.
- [Moohappy Bella Massa](https://bellamassa.moohappy.com.br/) - consulta real no navegador em 03/11/2026.
- LojaBetero local: `C:\Users\User\Desktop\passatempo\LojaBetero` - código inspecionado, sem alterações.
- [Temas e tokens Ant Design](https://ant.design/docs/react/customize-theme/).
- [react-hot-toast](https://react-hot-toast.com/docs).
- [Criação de aplicações React](https://react.dev/learn/creating-a-react-app).

Consulte `LEVANTAMENTO_REFERENCIAS.md` para dados observados e conflitos; `PROMPT_IMPLEMENTACAO.md` para a instrução executável à IA.
