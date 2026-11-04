using System.Text.Json;
using System.Text.Json.Nodes;
using BellaMassa.Domain;

namespace BellaMassa.Api.Assistant;

public sealed class ToolContext(CatalogIndex index, IReadOnlyList<CartSnapshotLine> cart, Func<object, Task> emit)
{
    public CatalogIndex Index { get; } = index;
    public IReadOnlyList<CartSnapshotLine> Cart { get; } = cart;
    public Func<object, Task> Emit { get; } = emit;
    public int Proposals { get; set; }
    public HashSet<string> Shown { get; } = [];
    public DateTimeOffset Now { get; init; } = DateTimeOffset.UtcNow;
}

/* The model sends combo choices as a flat list; the domain expects a map. */
public sealed record ModelComboChoice(string GroupId, string OptionId, int Quantity);

public sealed record ModelLine(string ProductId, string VariantId, int Quantity, List<string>? FlavorIds, List<string>? OptionIds, List<ModelComboChoice>? Combo, string? Note, List<string>? RemovedIngredients = null)
{
    public LineConfig ToConfig()
    {
        Dictionary<string, Dictionary<string, int>>? combo = null;
        if (Combo is not null)
        {
            combo = [];
            foreach (var c in Combo)
            {
                if (!combo.TryGetValue(c.GroupId, out var group)) combo[c.GroupId] = group = [];
                group[c.OptionId] = c.Quantity;
            }
        }
        return new LineConfig(ProductId, VariantId, Quantity, FlavorIds, OptionIds, combo, Note, RemovedIngredients);
    }
}

public static class AssistantTools
{
    public static readonly string[] StoreTopics = ["endereco", "atendimento", "whatsapp", "prazo", "horario", "pedido_minimo", "taxa_entrega", "pagamento", "alergenos", "promocoes"];

    private const string LineSchema = """
        {
          "type": "OBJECT",
          "properties": {
            "productId": { "type": "STRING", "description": "ID do produto retornado por search_menu ou get_product" },
            "variantId": { "type": "STRING", "description": "ID da variante (tamanho) retornado por get_product" },
            "quantity": { "type": "INTEGER", "description": "Quantidade de 1 a 99" },
            "flavorIds": { "type": "ARRAY", "items": { "type": "STRING" }, "description": "IDs de sabores, só para pizzas montadas" },
            "optionIds": { "type": "ARRAY", "items": { "type": "STRING" }, "description": "IDs de opções como borda e adicionais" },
            "removedIngredients": { "type": "ARRAY", "items": { "type": "STRING" }, "description": "Ingredientes a retirar, escritos como em removable_ingredients" },
            "combo": {
              "type": "ARRAY",
              "description": "Escolhas de combo: cada item tem groupId, optionId e quantity",
              "items": {
                "type": "OBJECT",
                "properties": { "groupId": { "type": "STRING" }, "optionId": { "type": "STRING" }, "quantity": { "type": "INTEGER" } },
                "required": ["groupId", "optionId", "quantity"]
              }
            },
            "note": { "type": "STRING", "description": "Observação curta do cliente" }
          },
          "required": ["productId", "variantId", "quantity"]
        }
        """;

    /* Declarations in the OpenAPI subset accepted by Gemini function calling. */
    public static JsonArray Declarations() => JsonNode.Parse($$"""
        [
          {
            "name": "search_menu",
            "description": "Busca produtos no cardápio da Bella Massa por texto (nome ou ingrediente), categoria, tipo e teto de preço. Use antes de recomendar.",
            "parameters": {
              "type": "OBJECT",
              "properties": {
                "query": { "type": "STRING", "description": "Palavras de busca, por exemplo queijo coalho ou frango" },
                "category": { "type": "STRING", "enum": ["novidades", "premium", "monte", "gigantes", "doces", "esfihas", "combos", "bebidas"] },
                "kind": { "type": "STRING", "enum": ["salgada", "doce"] },
                "max_price_reais": { "type": "NUMBER", "description": "Valor máximo em reais para o preço inicial do produto" }
              }
            }
          },
          {
            "name": "get_product",
            "description": "Detalhes de um produto: variantes, preços, ingredientes cadastrados, sabores, bordas e grupos de combo.",
            "parameters": { "type": "OBJECT", "properties": { "product_id": { "type": "STRING" } }, "required": ["product_id"] }
          },
          {
            "name": "quote_cart",
            "description": "Calcula o valor exato de uma ou mais configurações. Use para qualquer total ou comparação de preço.",
            "parameters": { "type": "OBJECT", "properties": { "lines": { "type": "ARRAY", "items": {{LineSchema}} } }, "required": ["lines"] }
          },
          {
            "name": "get_store_info",
            "description": "Informações da loja: endereço, cidades atendidas, WhatsApp, prazo, horário, pedido mínimo, taxa de entrega, pagamento, alergias e promoções.",
            "parameters": { "type": "OBJECT", "properties": { "topic": { "type": "STRING", "enum": {{JsonSerializer.Serialize(StoreTopics)}} } }, "required": ["topic"] }
          },
          {
            "name": "get_delivery_fee",
            "description": "Taxa de entrega de um bairro de Barra Bonita ou Igaraçu do Tietê, pela lista da loja. Aceita o nome escrito de qualquer jeito.",
            "parameters": { "type": "OBJECT", "properties": { "district": { "type": "STRING", "description": "Nome do bairro, podendo incluir a cidade" } }, "required": ["district"] }
          },
          {
            "name": "propose_cart_change",
            "description": "Mostra ao cliente uma proposta de alteração do carrinho com botão de confirmação. Não altera nada sozinho.",
            "parameters": {
              "type": "OBJECT",
              "properties": {
                "action": { "type": "STRING", "enum": ["add", "remove", "set_quantity"] },
                "line": {{LineSchema}},
                "line_id": { "type": "STRING", "description": "lineId de um item do carrinho atual, para remove ou set_quantity" },
                "quantity": { "type": "INTEGER" }
              },
              "required": ["action"]
            }
          },
          {
            "name": "show_location",
            "description": "Mostra ao cliente um cartão com o endereço da Bella Massa, botão para copiar e link para o Google Maps. Use quando perguntarem onde fica, endereço, localização ou como chegar.",
            "parameters": { "type": "OBJECT", "properties": {} }
          },
          {
            "name": "show_products",
            "description": "Exibe até 3 produtos como cartões clicáveis na conversa. Use ao recomendar ou comparar.",
            "parameters": {
              "type": "OBJECT",
              "properties": {
                "product_ids": { "type": "ARRAY", "items": { "type": "STRING" } },
                "reasons": { "type": "ARRAY", "items": { "type": "STRING" }, "description": "Motivo curto de cada sugestão, na mesma ordem" }
              },
              "required": ["product_ids"]
            }
          }
        ]
        """)!.AsArray();

    private sealed record SearchArgs(string? Query, string? Category, string? Kind, double? Max_price_reais);
    private sealed record ProductArgs(string? Product_id);
    private sealed record QuoteArgs(List<ModelLine>? Lines);
    private sealed record StoreArgs(string? Topic);
    private sealed record DeliveryArgs(string? District);
    private sealed record ProposeArgs(string? Action, ModelLine? Line, string? Line_id, int? Quantity);
    private sealed record ShowArgs(List<string>? Product_ids, List<string>? Reasons);

    private static readonly JsonSerializerOptions ArgsJson = new(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true };

    private static JsonObject Obj(object value) => (JsonObject)JsonSerializer.SerializeToNode(value, CatalogIndex.Json)!;
    private static JsonObject Error(string message, IEnumerable<string>? details = null) =>
        details is null ? Obj(new { error = message }) : Obj(new { error = message, details });
    private static string? Money(int? cents) => cents is { } c ? TextTools.Brl(c) : null;

    /* Every argument is validated before touching the catalog; unknown tools
       and malformed calls go back to the model as errors, never exceptions. */
    public static async Task<JsonObject> RunAsync(string name, JsonNode? args, ToolContext ctx)
    {
        try
        {
            return name switch
            {
                "search_menu" => Search(Parse<SearchArgs>(args), ctx),
                "get_product" => GetProduct(Parse<ProductArgs>(args), ctx),
                "quote_cart" => QuoteCart(Parse<QuoteArgs>(args), ctx),
                "get_store_info" => StoreInfo(Parse<StoreArgs>(args), ctx),
                "get_delivery_fee" => DeliveryFee(Parse<DeliveryArgs>(args), ctx),
                "propose_cart_change" => await Propose(Parse<ProposeArgs>(args), ctx),
                "show_products" => await Show(Parse<ShowArgs>(args), ctx),
                "show_location" => await Location(ctx),
                _ => Error($"Ferramenta desconhecida: {name}")
            };
        }
        catch (JsonException)
        {
            return Error("Argumentos inválidos.");
        }
    }

    private static T Parse<T>(JsonNode? args) =>
        (args ?? new JsonObject()).Deserialize<T>(ArgsJson) ?? throw new JsonException();

    private static object Brief(CatalogIndex index, Product product) => new
    {
        id = product.Id,
        name = product.Name,
        categories = product.CategoryIds,
        type = product.Kind,
        choose = product.VariantLabel ?? "Tamanho",
        variants = product.Variants.Select(v => v.Label),
        from_price = Money(index.FromPriceCents(product)),
        description = CatalogIndex.Description(product) is { Length: > 0 } d ? d : null
    };

    private static JsonObject Search(SearchArgs args, ToolContext ctx)
    {
        if (args.Query is { Length: > 80 } || args.Category is { Length: > 20 } || args.Kind is not (null or "salgada" or "doce") || args.Max_price_reais is <= 0 or > 10000)
            return Error("Argumentos inválidos.");
        var results = MenuSearch.Search(ctx.Index, new SearchInput(
            args.Query, args.Category, args.Max_price_reais is { } max ? (int)Math.Round(max * 100) : null, args.Kind));
        return Obj(new { count = results.Count, results = results.Take(8).Select(p => Brief(ctx.Index, p)) });
    }

    private static JsonObject GetProduct(ProductArgs args, ToolContext ctx)
    {
        var id = args.Product_id ?? string.Empty;
        var product = id.Length <= 64 ? ctx.Index.Product(id) ?? ctx.Index.ProductBySlug(id) : null;
        if (product is null) return Error("Produto não encontrado. Use search_menu para obter um ID válido.");
        var index = ctx.Index;
        var brief = Obj(Brief(index, product));
        brief["variants"] = JsonSerializer.SerializeToNode(product.Variants.Select(v => new
        {
            id = v.Id,
            label = v.Label,
            slices = v.Slices,
            price = v.Pricing.Type == "fixed" ? Money(v.Pricing.PriceCents) : null,
            pricing = v.Pricing.Type switch
            {
                "fraction_sum" => "Cada sabor custa a fração correspondente do seu preço inteiro; use quote_cart para o total.",
                "fixed" => "preço fixo",
                _ => "preço a confirmar com a loja"
            },
            description = v.Description,
            ingredients = v.Ingredients is null ? (object)"não informados pela loja" : v.Ingredients,
            removable_ingredients = v.Ingredients?.Where(i => !CatalogIndex.IsBaseIngredient(i)),
            flavors = v.Flavors is null ? null : new
            {
                min = v.Flavors.Min,
                max = v.Flavors.Max,
                options = v.Flavors.Options.Select(fid =>
                {
                    var f = index.Flavor(fid);
                    int? price = f is not null && f.Prices.TryGetValue(v.Flavors.Table, out var p) ? p : null;
                    return new { id = fid, name = f?.Name, type = f?.Kind, whole_price = Money(price) };
                })
            },
            option_groups = (v.OptionGroupIds ?? []).Select(index.OptionGroup).OfType<OptionGroup>().Select(g => new
            {
                id = g.Id,
                name = g.Name,
                min = g.Min,
                max = g.Max,
                options = g.Options.Select(o => new { id = o.Id, name = o.Name, price = Money(o.PriceCents) })
            }),
            combo_groups = v.ComboGroups?.Select(g => new
            {
                groupId = g.Id,
                label = g.Label,
                rule = g.Hint,
                repeat_allowed = g.Repeat,
                min = g.Min,
                max = g.Max,
                options = g.Options.Select(oid => new { optionId = oid, name = index.ComboOptionName(g, oid) })
            })
        }), CatalogIndex.Json);
        return brief;
    }

    private static List<string> ShapeErrors(IEnumerable<ModelLine> lines) =>
        lines.SelectMany(l => QuoteEngine.ValidateShape(l.ToConfig())).Distinct().Take(5).ToList();

    private static object LineView(LineQuote q) => new
    {
        ok = q.Ok,
        product = q.Name,
        variant = q.VariantLabel,
        quantity = q.Quantity,
        unit_price = Money(q.UnitCents),
        total = Money(q.TotalCents),
        details = q.Summary,
        problems = q.Issues.Select(i => i.Message)
    };

    private static JsonObject QuoteCart(QuoteArgs args, ToolContext ctx)
    {
        if (args.Lines is not { Count: >= 1 and <= 10 }) return Error("Envie de 1 a 10 linhas.");
        if (ShapeErrors(args.Lines) is { Count: > 0 } errors) return Error("Argumentos inválidos.", errors);
        var quote = QuoteEngine.QuoteCart(ctx.Index, args.Lines.Select(l => l.ToConfig()).ToList());
        return Obj(new
        {
            complete = quote.Complete,
            lines = quote.Lines.Select(LineView),
            items_total = Money(quote.SubtotalCents),
            delivery_fee = "não incluída; depende do bairro, use get_delivery_fee"
        });
    }

    private static JsonObject StoreInfo(StoreArgs args, ToolContext ctx)
    {
        if (args.Topic is null || !StoreTopics.Contains(args.Topic)) return Error("Assunto desconhecido.");
        var info = ctx.Index.Catalog.Store.Info.FirstOrDefault(i => i.Topic == args.Topic);
        var whatsapp = ctx.Index.Catalog.Store.Info.FirstOrDefault(i => i.Topic == "whatsapp")?.Value;
        if (info?.Value is null || info.Status is not ("observed" or "approved"))
            return Obj(new
            {
                status = "confirmar_com_a_loja",
                label = info?.Label ?? args.Topic,
                contact = whatsapp,
                note = "Essa informação precisa ser confirmada com a loja. Não estime nem invente."
            });
        var store = ctx.Index.Catalog.Store;
        return args.Topic switch
        {
            "horario" when store.Hours is { Count: > 0 } hours => Hours(store, hours, ctx.Now),
            "pagamento" when store.Payments is { Count: > 0 } payments => Obj(new
            {
                status = "informado",
                label = info.Label,
                methods = payments.Select(p => p.Note is null ? p.Label : $"{p.Label} ({p.Note})"),
                note = "Pagamento na entrega ou na retirada. O site não cobra online; o cliente escolhe a forma na revisão do pedido."
            }),
            "prazo" when store.Times is { } times => Obj(new { status = "informado", label = info.Label, delivery = times.Delivery, pickup = times.Pickup, note = "Tempo médio, pode variar com o movimento." }),
            "taxa_entrega" => Obj(new { status = "informado", label = info.Label, value = info.Value, next_step = "Para saber a taxa exata, pergunte o bairro e chame get_delivery_fee." }),
            _ => Obj(new { status = "informado", label = info.Label, value = info.Value, note = info.Note })
        };
    }

    private static string Span(OpeningHours h) => $"{h.Label}, das {h.Open} às {h.Close}";

    private static JsonObject Hours(Store store, List<OpeningHours> hours, DateTimeOffset now)
    {
        var state = StoreRules.OpenState(store, now);
        return Obj(new
        {
            status = "informado",
            label = "Horário de funcionamento",
            open_now = state.Open,
            today = state.Today is { } t ? Span(t) : "fechado hoje",
            next_opening = state.Next is { } n ? $"{n.Label} às {n.Open}" : null,
            week = hours.OrderBy(h => h.Day).Select(Span),
            note = "Horário de Brasília."
        });
    }

    private static JsonObject DeliveryFee(DeliveryArgs args, ToolContext ctx)
    {
        if (args.District is not { Length: >= 2 and <= 80 }) return Error("Informe o nome do bairro.");
        var store = ctx.Index.Catalog.Store;
        var whatsapp = store.Info.FirstOrDefault(i => i.Topic == "whatsapp")?.Value;
        var result = StoreRules.FindDeliveryFee(store, args.District);
        return result.Status switch
        {
            DeliveryLookupStatus.Found => Obj(new
            {
                status = "encontrado",
                district = result.Zones[0].Name,
                fee = Money(result.FeeCents),
                note = "Taxa da lista da loja, somada ao total do pedido."
            }),
            DeliveryLookupStatus.Ambiguous => Obj(new
            {
                status = "varias_opcoes",
                options = result.Zones.Select(z => new { district = z.Name, city = z.City, fee = z.Status == "approved" ? Money(z.FeeCents) : "a confirmar" }),
                next_step = "Mostre as opções e pergunte qual é o bairro certo ou a cidade. Se a dúvida continuar, oriente confirmar com a loja."
            }),
            DeliveryLookupStatus.Confirm => Obj(new
            {
                status = "confirmar_com_a_loja",
                district = result.Zones[0].Name,
                contact = whatsapp,
                note = "A taxa desse local precisa ser confirmada com a loja. Não estime."
            }),
            _ => Obj(new
            {
                status = "nao_encontrado",
                contact = whatsapp,
                next_step = "Peça o nome do bairro como aparece no endereço. Se não estiver na lista, a entrega precisa ser confirmada com a loja."
            })
        };
    }

    private static async Task<JsonObject> Propose(ProposeArgs args, ToolContext ctx)
    {
        if (ctx.Proposals >= 3) return Error("Limite de propostas nesta resposta atingido.");
        var expires = DateTimeOffset.UtcNow.AddMinutes(15);
        CartProposal proposal;
        switch (args.Action)
        {
            case "add":
            {
                if (args.Line is null) return Error("Envie a configuração em line.");
                if (ShapeErrors([args.Line]) is { Count: > 0 } errors) return Error("Argumentos inválidos.", errors);
                var config = args.Line.ToConfig();
                var quote = QuoteEngine.QuoteLine(ctx.Index, config);
                if (!quote.Ok) return Obj(new { ok = false, problems = quote.Issues.Select(i => i.Message) });
                proposal = new(Guid.NewGuid().ToString(), "add", config, null, null, quote, $"Adicionar {quote.Quantity}x {quote.Name}", expires);
                break;
            }
            case "remove" or "set_quantity":
            {
                var item = ctx.Cart.FirstOrDefault(l => l.LineId == args.Line_id);
                if (item is null) return Error("Item não encontrado no carrinho atual.");
                if (args.Action == "remove")
                {
                    proposal = new(Guid.NewGuid().ToString(), "remove", null, item.LineId, null, null, $"Remover {item.Name}", expires);
                    break;
                }
                if (args.Quantity is not (>= 1 and <= QuoteEngine.MaxQuantity)) return Error("Informe a nova quantidade, de 1 a 99.");
                proposal = new(Guid.NewGuid().ToString(), "set_quantity", null, item.LineId, args.Quantity, null, $"Alterar {item.Name} para {args.Quantity}", expires);
                break;
            }
            default:
                return Error("Ação inválida.");
        }
        ctx.Proposals++;
        await ctx.Emit(ChatEvents.Proposal(proposal));
        return Obj(new
        {
            ok = true,
            proposal_id = proposal.Id,
            shown_to_customer = true,
            total = Money(proposal.Quote?.TotalCents),
            next_step = "O cliente decide no botão do cartão. Não diga que o item foi adicionado ou alterado."
        });
    }

    private static async Task<JsonObject> Location(ToolContext ctx)
    {
        var address = ctx.Index.Catalog.Store.Info.FirstOrDefault(i => i.Topic == "endereco" && i.Status is "observed" or "approved")?.Value;
        if (address is null) return Error("Endereço não confirmado. Oriente falar com a loja pelo WhatsApp.");
        var name = ctx.Index.Catalog.Store.DisplayName;
        var maps = $"https://www.google.com/maps/search/?api=1&query={Uri.EscapeDataString($"{name}, {address}")}";
        await ctx.Emit(ChatEvents.Location(name, address, maps));
        return Obj(new { shown = true, address, next_step = "O cartão com o endereço e o mapa já está na conversa. Não repita o link." });
    }

    public static ProductCard Card(CatalogIndex index, Product product, string? reason = null) => new(
        product.Id, product.Slug, product.Name, CatalogIndex.PrimaryImage(product)?.Url, index.FromPriceCents(product),
        CatalogIndex.Description(product), reason);

    private static async Task<JsonObject> Show(ShowArgs args, ToolContext ctx)
    {
        if (args.Product_ids is not { Count: >= 1 and <= 3 } || args.Reasons is { Count: > 3 } || args.Reasons?.Any(r => r.Length > 160) == true)
            return Error("Envie de 1 a 3 IDs de produto.");
        var cards = new List<ProductCard>();
        for (var i = 0; i < args.Product_ids.Count; i++)
        {
            var product = ctx.Index.Product(args.Product_ids[i]);
            if (product is not null && ctx.Shown.Add(product.Id))
                cards.Add(Card(ctx.Index, product, args.Reasons?.ElementAtOrDefault(i)));
        }
        if (cards.Count > 0) await ctx.Emit(ChatEvents.Products(cards));
        return Obj(new { shown = cards.Select(c => c.ProductId), invalid_ids = args.Product_ids.Where(id => ctx.Index.Product(id) is null) });
    }
}
