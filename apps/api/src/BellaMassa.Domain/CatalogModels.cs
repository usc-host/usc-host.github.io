namespace BellaMassa.Domain;

/* Shapes of data/catalog.json, the same file the web app reads. Money is
   always an integer amount of cents. Status values: observed, conflicting,
   approved, demo or pending. */

public sealed record Image(string Url, int Width, int Height, string Alt);

public sealed record StoreInfo(
    string Topic,
    string Label,
    string? Value,
    string? Href,
    string Status,
    List<string> Sources,
    string? Note,
    List<string>? Observations);

public sealed record Store(string Name, string DisplayName, string Tagline, Image Logo, List<StoreInfo> Info);

public sealed record Category(string Id, string Name, string Description);

public sealed record Flavor(
    string Id,
    string Name,
    string Kind,
    List<string>? Ingredients,
    Dictionary<string, int> Prices,
    Dictionary<string, string> Status,
    List<string> Sources,
    string? ProductId,
    string? Note);

public sealed record Option(string Id, string Name, int PriceCents);

public sealed record OptionGroup(string Id, string Name, int Min, int Max, string Status, List<string> Sources, List<Option> Options);

/* type: fixed (PriceCents), fraction_sum (Table) or unknown. */
public sealed record PricingPolicy(string Type, int? PriceCents, string? Table, string? Status);

public sealed record FlavorRule(int Min, int Max, string Table, List<string> Options);

/* pick: flavor and product take each choice once, quantity accepts repeats. */
public sealed record ComboGroup(
    string Id,
    string Label,
    string Hint,
    string Pick,
    int Min,
    int Max,
    string? Table,
    List<string> Options,
    string Status);

public sealed record Variant(
    string Id,
    string Label,
    int? Slices,
    PricingPolicy Pricing,
    string? Description,
    List<string>? Ingredients,
    Image? Image,
    FlavorRule? Flavors,
    List<string>? OptionGroupIds,
    List<ComboGroup>? ComboGroups,
    string Status,
    List<string> Sources,
    List<string>? AlternateSources,
    string? Note);

public sealed record Product(
    string Id,
    string Slug,
    string Name,
    string Kind,
    string? Unit,
    List<string> CategoryIds,
    string? Summary,
    bool Featured,
    string Status,
    List<Variant> Variants);

public sealed record SourceRecord(string Id, string Channel, string Url, string ObservedOn, string Field, string? ObservedValue, string? Note);

public sealed record MenuCatalog(
    string Version,
    string Currency,
    Store Store,
    List<Category> Categories,
    List<Flavor> Flavors,
    List<OptionGroup> OptionGroups,
    List<Product> Products,
    List<SourceRecord> Sources);
