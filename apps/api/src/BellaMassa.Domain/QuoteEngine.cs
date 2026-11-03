using System.Text.Json;
using System.Text.RegularExpressions;

namespace BellaMassa.Domain;

/* What the customer chose for one cart line. Combo selections map a group id
   to the chosen option ids and how many units of each. */
public sealed record LineConfig(
    string ProductId,
    string VariantId,
    int Quantity,
    List<string>? FlavorIds = null,
    List<string>? OptionIds = null,
    Dictionary<string, Dictionary<string, int>>? Combo = null,
    string? Note = null,
    List<string>? RemovedIngredients = null);

public sealed record LineIssue(string Field, string Code, string Message, string? GroupId = null);

public sealed record PricePart(string Label, int Cents);

public sealed record LineQuote(
    bool Ok,
    string ProductId,
    string VariantId,
    string Name,
    string VariantLabel,
    int Quantity,
    int? UnitCents,
    int? TotalCents,
    List<PricePart> Parts,
    List<string> Summary,
    List<LineIssue> Issues);

public sealed record Quote(
    string Id,
    string CatalogVersion,
    string Currency,
    List<LineQuote> Lines,
    int SubtotalCents,
    int? DeliveryCents,
    int TotalCents,
    bool Complete,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    List<string> Warnings);

/* Deterministic price of each cart line. This is the authority: the browser
   runs a TypeScript twin only for instant feedback, and both are checked
   against data/quote-cases.json. */
public static partial class QuoteEngine
{
    public const int MaxQuantity = 99;
    public const int MaxNote = 140;
    public static readonly TimeSpan QuoteTtl = TimeSpan.FromMinutes(30);

    [GeneratedRegex("^[a-z0-9-]{1,64}$")]
    private static partial Regex IdPattern();

    /* Shape checks for anything arriving from the network, browser or model.
       Business rules come later in QuoteLine. */
    public static List<string> ValidateShape(LineConfig line)
    {
        var errors = new List<string>();
        bool Id(string? value) => value is not null && IdPattern().IsMatch(value);
        if (!Id(line.ProductId)) errors.Add("productId inválido");
        if (!Id(line.VariantId)) errors.Add("variantId inválido");
        if (line.Quantity is < 1 or > MaxQuantity) errors.Add($"quantity deve estar entre 1 e {MaxQuantity}");
        if (line.FlavorIds is { } f && (f.Count > 8 || !f.All(Id))) errors.Add("flavorIds inválido");
        if (line.OptionIds is { } o && (o.Count > 8 || !o.All(Id))) errors.Add("optionIds inválido");
        if (line.Combo is { } c && (c.Count > 6 || !c.All(g => Id(g.Key) && g.Value.Count <= 20 && g.Value.All(e => Id(e.Key) && e.Value is >= 0 and <= MaxQuantity))))
            errors.Add("combo inválido");
        if (line.Note is { Length: > MaxNote }) errors.Add($"note aceita até {MaxNote} caracteres");
        if (line.RemovedIngredients is { } r && (r.Count > 12 || r.Any(i => i is null || i.Length is 0 or > 60))) errors.Add("removedIngredients inválido");
        return errors;
    }

    public static LineQuote QuoteLine(CatalogIndex index, LineConfig config)
    {
        var issues = new List<LineIssue>();
        var parts = new List<PricePart>();
        var summary = new List<string>();
        var product = index.Product(config.ProductId);
        var variant = product?.Variants.FirstOrDefault(v => v.Id == config.VariantId);

        LineQuote Result(bool ok = false, int? unit = null) => new(
            ok, config.ProductId, config.VariantId, product?.Name ?? "Produto indisponível", variant?.Label ?? string.Empty,
            config.Quantity, unit, unit * config.Quantity, parts, summary, issues);

        if (product is null)
        {
            issues.Add(new("product", "PRODUCT_NOT_FOUND", "Este produto não está mais no cardápio."));
            return Result();
        }
        if (variant is null)
        {
            issues.Add(new("variant", "VARIANT_NOT_FOUND", "Este tamanho não está mais disponível."));
            return Result();
        }
        if (config.Quantity is < 1 or > MaxQuantity)
            issues.Add(new("quantity", "QUANTITY_INVALID", $"A quantidade precisa estar entre 1 e {MaxQuantity}."));
        if ((config.Note ?? string.Empty).Length > MaxNote)
            issues.Add(new("note", "NOTE_TOO_LONG", $"A observação aceita até {MaxNote} caracteres."));

        var flavorIds = config.FlavorIds ?? [];
        FlavorIssues(index, variant, flavorIds, issues);

        var pricing = variant.Pricing;
        if (pricing is { Type: "fixed", PriceCents: { } fixedPrice })
        {
            parts.Add(new(CatalogIndex.VariantDisplayName(product, variant), fixedPrice));
        }
        else if (pricing is { Type: "fraction_sum", Table: { } table })
        {
            var n = flavorIds.Count;
            // Invalid flavors already explain the problem; pricing them would only add noise.
            if (n > 0 && !issues.Any(i => i.Field == "flavors"))
            {
                foreach (var id in flavorIds)
                {
                    var flavor = index.Flavor(id);
                    if (flavor is null || !flavor.Prices.TryGetValue(table, out var price))
                    {
                        issues.Add(new("price", "PRICE_UNAVAILABLE", "Não há preço cadastrado para um dos sabores neste tamanho."));
                        continue;
                    }
                    parts.Add(new(n == 1 ? flavor.Name : $"1/{n} {flavor.Name}", Fraction(price, n)));
                }
            }
        }
        else
        {
            issues.Add(new("price", "PRICING_POLICY_MISSING", "O preço deste item precisa ser confirmado com a loja."));
        }
        if (flavorIds.Count > 0 && variant.Flavors is not null)
            summary.Add($"{(flavorIds.Count == 1 ? "Sabor" : "Sabores")}: {string.Join(", ", flavorIds.Select(id => index.Flavor(id)?.Name ?? id))}");

        IngredientIssues(variant, config.RemovedIngredients ?? [], issues, summary);
        OptionParts(index, variant, config.OptionIds ?? [], issues, parts, summary);
        ComboIssues(index, variant, config.Combo, issues, summary);
        if (!string.IsNullOrWhiteSpace(config.Note)) summary.Add($"Observação: {config.Note.Trim()}");

        if (issues.Count > 0) return Result();
        return Result(true, parts.Sum(p => p.Cents));
    }

    /* One fraction of a whole price, rounded half up to the cent. */
    public static int Fraction(int cents, int parts) => (int)Math.Round(cents / (decimal)parts, MidpointRounding.AwayFromZero);

    public static Quote QuoteCart(CatalogIndex index, IReadOnlyList<LineConfig> lines, DateTimeOffset? now = null)
    {
        var at = now ?? DateTimeOffset.UtcNow;
        var quoted = lines.Select(l => QuoteLine(index, l)).ToList();
        var subtotal = quoted.Sum(l => l.TotalCents ?? 0);
        return new Quote(
            $"q_{Hash(index.Catalog.Version + JsonSerializer.Serialize(lines, CatalogIndex.Json))}",
            index.Catalog.Version,
            "BRL",
            quoted,
            subtotal,
            null,
            subtotal,
            quoted.Count > 0 && quoted.All(l => l.Ok),
            at,
            at + QuoteTtl,
            ["A taxa de entrega é informada pela loja na confirmação."]);
    }

    private static void FlavorIssues(CatalogIndex index, Variant variant, List<string> ids, List<LineIssue> issues)
    {
        var rule = variant.Flavors;
        if (rule is null)
        {
            if (ids.Count > 0) issues.Add(new("flavors", "FLAVORS_NOT_ALLOWED", "Este produto não tem escolha de sabores."));
            return;
        }
        if (ids.Distinct().Count() != ids.Count) issues.Add(new("flavors", "FLAVOR_REPEATED", "Cada sabor pode ser escolhido uma vez."));
        foreach (var id in ids)
            if (!rule.Options.Contains(id) || index.Flavor(id) is null)
                issues.Add(new("flavors", "FLAVOR_UNAVAILABLE", "Um dos sabores escolhidos não está disponível neste tamanho."));
        if (ids.Count < rule.Min)
            issues.Add(new("flavors", "FLAVORS_MISSING", rule.Min == 1 ? "Escolha pelo menos 1 sabor." : $"Escolha pelo menos {rule.Min} sabores."));
        if (ids.Count > rule.Max)
            issues.Add(new("flavors", "FLAVORS_EXCEEDED", $"Este tamanho aceita até {TextTools.Plural(rule.Max, "sabor", "sabores")}."));
    }

    private static void IngredientIssues(Variant variant, List<string> removed, List<LineIssue> issues, List<string> summary)
    {
        if (removed.Count == 0) return;
        var listed = variant.Ingredients ?? [];
        if (removed.Distinct().Count() != removed.Count || removed.Any(r => !listed.Contains(r) || CatalogIndex.IsBaseIngredient(r)))
        {
            issues.Add(new("ingredients", "INGREDIENT_UNAVAILABLE", "Só dá para retirar ingredientes listados neste produto."));
            return;
        }
        // Recipe order, so the kitchen always reads it the same way.
        summary.Add($"Sem: {string.Join(", ", listed.Where(removed.Contains).Select(i => i.ToLowerInvariant()))}");
    }

    private static void OptionParts(CatalogIndex index, Variant variant, List<string> ids, List<LineIssue> issues, List<PricePart> parts, List<string> summary)
    {
        var seen = new HashSet<string>();
        foreach (var groupId in variant.OptionGroupIds ?? [])
        {
            var group = index.OptionGroup(groupId);
            if (group is null) continue;
            var chosen = group.Options.Where(o => ids.Contains(o.Id)).ToList();
            foreach (var o in chosen) seen.Add(o.Id);
            if (chosen.Count < group.Min) issues.Add(new("options", "OPTION_MISSING", $"Escolha {group.Name.ToLowerInvariant()}.", groupId));
            if (chosen.Count > group.Max) issues.Add(new("options", "OPTION_EXCEEDED", $"Escolha no máximo {group.Max} em {group.Name.ToLowerInvariant()}.", groupId));
            foreach (var o in chosen) parts.Add(new($"{group.Name}: {o.Name}", o.PriceCents));
            if (chosen.Count > 0) summary.Add($"{group.Name}: {string.Join(", ", chosen.Select(o => o.Name))}");
        }
        if (ids.Any(id => !seen.Contains(id)))
            issues.Add(new("options", "OPTION_UNAVAILABLE", "Um dos adicionais escolhidos não está disponível para este produto."));
    }

    private static void ComboIssues(CatalogIndex index, Variant variant, Dictionary<string, Dictionary<string, int>>? combo, List<LineIssue> issues, List<string> summary)
    {
        var groups = variant.ComboGroups ?? [];
        var selections = combo ?? [];
        foreach (var key in selections.Keys)
            if (groups.All(g => g.Id != key))
                issues.Add(new("combo", "COMBO_GROUP_UNKNOWN", "A escolha enviada não pertence a este combo."));
        foreach (var group in groups)
        {
            var chosen = selections.GetValueOrDefault(group.Id)?.Where(e => e.Value != 0).ToList() ?? [];
            var total = 0;
            var names = new List<string>();
            foreach (var (id, qty) in chosen)
            {
                if (qty < 0)
                {
                    issues.Add(new("combo", "COMBO_QUANTITY_INVALID", "Quantidade inválida no combo.", group.Id));
                    continue;
                }
                if (!group.Repeat && qty > 1)
                    issues.Add(new("combo", "COMBO_REPEATED", $"Em {group.Label.ToLowerInvariant()}, cada opção pode ser escolhida uma vez.", group.Id));
                var name = index.ComboOptionName(group, id);
                var priced = group.Source != "flavor" || group.Table is null || index.Flavor(id)?.Prices.ContainsKey(group.Table) == true;
                if (!group.Options.Contains(id) || name is null || !priced)
                {
                    issues.Add(new("combo", "COMBO_OPTION_UNAVAILABLE", $"Uma escolha em {group.Label.ToLowerInvariant()} não está disponível.", group.Id));
                    continue;
                }
                total += qty;
                names.Add(group.Repeat ? $"{qty}x {name}" : name);
            }
            if (total < group.Min)
                issues.Add(new("combo", "COMBO_INCOMPLETE", $"{group.Label}: {TextTools.Plural(group.Min - total, "escolha restante", "escolhas restantes")}.", group.Id));
            else if (total > group.Max)
                issues.Add(new("combo", "COMBO_EXCEEDED", $"{group.Label}: o limite é {group.Max}, remova {total - group.Max}.", group.Id));
            if (names.Count > 0) summary.Add($"{group.Label}: {string.Join(", ", names)}");
        }
    }

    private static string Hash(string text)
    {
        unchecked
        {
            var h = 2166136261u;
            foreach (var c in text) h = (h ^ c) * 16777619u;
            return h.ToString("x8");
        }
    }
}
