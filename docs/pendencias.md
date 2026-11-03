# Pendências externas

Itens que dependem da pizzaria ou de credenciais. Nenhum deles impede a apresentação, mas todos precisam de validação antes de uso real.

## Dados comerciais

| Item | Situação no projeto |
|---|---|
| Canal oficial de preços | Usados os valores do InstaDelivery de 03/11/2026. Combo da Semana marcado como `conflicting` (Moohappy mostrava R$ 89,90). |
| Pizza de 2 a 4 sabores | Política `fraction_sum`: cada sabor custa a fração do seu preço inteiro, arredondada ao centavo. Bate com o modal de 2 sabores, mas é ilustrativa (`demo`) para 3 e 4 sabores. |
| Preços de broto por sabor | Ilustrativos, partindo do "a partir de R$ 39,80" publicado. |
| Sabores de esfiha | Carne, Frango com Catupiry, Calabresa com Queijo, Queijo e Chocolate são ilustrativos. Só a Esfiha de Churros foi observada. |
| Escolhas dos combos | Grupos de sabores e refrigerantes ilustrativos. Preços dos combos observados. |
| Bordas | Observadas no modal da grande; aplicadas só à pizza grande montada. |
| Coberturas das pizzas de churros | Não levantadas. Cliente pode indicar na observação. |
| Horário, pedido mínimo, taxa de entrega, pagamento | Conflitantes ou não levantados. O site não exibe; o assistente pede para confirmar com a loja. |
| Promoções e cupons | Não exibidos por falta de vigência confirmada. |
| Alergênicos | Sem ficha. O assistente nunca afirma segurança alimentar. |
| Logo em alta resolução | Usado o arquivo de 355 x 214 do InstaDelivery. |

## Integração

| Item | Situação |
|---|---|
| Chave do Gemini | Pendente. Sem ela a API em produção responde que o assistente está indisponível; em desenvolvimento roda o modo local. A avaliação real do assistente depende dela. |
| Modelo | `gemini-3.8-flash`, o mesmo padrão do UNI. Confirmar disponibilidade para a chave usada. |
| URL da API no Render | Definir `VITE_API_URL` nas variáveis do repositório depois do primeiro deploy. |
| WhatsApp para receber pedidos | `VITE_ORDER_WHATSAPP` vazio por padrão, para nenhum resumo ser enviado à loja real sem combinação. |
| Plano gratuito do Render | A API dorme após inatividade e pode levar cerca de 1 minuto para acordar. O site faz uma chamada de aquecimento ao abrir e o cardápio funciona sem a API. |
| InstaDelivery, pagamentos, login, fidelidade, painel | Fases posteriores. |
