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

public sealed record Store(
    string Name,
    string DisplayName,
    string Tagline,
    Image Logo,
    List<StoreInfo> Info,
    List<OpeningHours>? Hours = null,
    StoreTimes? Times = null,
    List<PaymentMethod>? Payments = null,
    List<DeliveryZone>? DeliveryZones = null);

/* Day 0 is Sunday. Times are in Brasília time. */
public sealed record OpeningHours(int Day, string Label, string Open, string Close);

public sealed record StoreTimes(string Delivery, string Pickup);

/* Accepted on delivery or at the counter. The site does not take payments. */
public sealed record PaymentMethod(string Id, string Label, string? Note);

public sealed record DeliveryZone(string Id, string Name, string? Sector, string City, int FeeCents, string Status, string? Note);

public sealed record Category(string Id, string Name, string Description, bool Collection = false);

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

/* Source: flavor ids or item (variant ids of another product, such as a drink
   or an esfiha). Repeat allows several units of the same option. */
public sealed record ComboGroup(
    string Id,
    string Label,
    string Hint,
    string Source,
    bool Repeat,
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
    List<Variant> Variants,
    string? VariantLabel = null,
    Image? Image = null,
    string? Badge = null);

public sealed record SourceRecord(string Id, string Channel, string Url, string ObservedOn, string Field, string? ObservedValue, string? Note);

public sealed record Promotion(string Id, string ProductId, string Title, Image Image, string Status, List<string> Sources, string? Note);

public sealed record MenuCatalog(
    string Version,
    string Currency,
    Store Store,
    List<Category> Categories,
    List<Flavor> Flavors,
    List<OptionGroup> OptionGroups,
    List<Product> Products,
    List<SourceRecord> Sources,
    List<Promotion>? Promotions = null);
