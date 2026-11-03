using System.Text.Json;

namespace BellaMassa.Domain;

public sealed class CatalogIndex
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly Dictionary<string, Product> _products;
    private readonly Dictionary<string, Product> _slugs;
    private readonly Dictionary<string, Flavor> _flavors;
    private readonly Dictionary<string, OptionGroup> _groups;
    private readonly Dictionary<string, (Product Product, Variant Variant)> _items;

    public CatalogIndex(MenuCatalog catalog)
    {
        Catalog = catalog;
        _products = catalog.Products.ToDictionary(p => p.Id);
        _slugs = catalog.Products.ToDictionary(p => p.Slug);
        _flavors = catalog.Flavors.ToDictionary(f => f.Id);
        _groups = catalog.OptionGroups.ToDictionary(g => g.Id);
        _items = catalog.Products.SelectMany(p => p.Variants.Select(v => (p, v))).ToDictionary(x => x.v.Id, x => (x.p, x.v));
    }

    public MenuCatalog Catalog { get; }

    public static CatalogIndex Load(string path) =>
        new(JsonSerializer.Deserialize<MenuCatalog>(File.ReadAllText(path), Json)
            ?? throw new InvalidDataException($"Catálogo vazio em {path}"));

    public Product? Product(string id) => _products.GetValueOrDefault(id);
    public Product? ProductBySlug(string slug) => _slugs.GetValueOrDefault(slug);
    public Flavor? Flavor(string id) => _flavors.GetValueOrDefault(id);
    public OptionGroup? OptionGroup(string id) => _groups.GetValueOrDefault(id);

    /* Any variant by its id, with the product it belongs to. */
    public (Product Product, Variant Variant)? Item(string variantId) =>
        _items.TryGetValue(variantId, out var item) ? item : null;

    public string? ComboOptionName(ComboGroup group, string id) =>
        group.Source == "flavor" ? Flavor(id)?.Name : Item(id)?.Variant.Label;

    /* Lowest price a customer can pay, used for "a partir de". A fraction_sum
       pizza costs at least its cheapest flavor taken whole. */
    public int? FromPriceCents(Product product)
    {
        int? lowest = null;
        foreach (var variant in product.Variants)
        {
            var price = VariantFromPrice(variant);
            if (price is not null && (lowest is null || price < lowest)) lowest = price;
        }
        return lowest;
    }

    public int? VariantFromPrice(Variant variant)
    {
        var pricing = variant.Pricing;
        if (pricing.Type == "fixed") return pricing.PriceCents;
        if (pricing.Type == "fraction_sum" && variant.Flavors is not null && pricing.Table is not null)
        {
            var prices = variant.Flavors.Options
                .Select(id => Flavor(id)?.Prices.GetValueOrDefault(pricing.Table, -1) ?? -1)
                .Where(p => p >= 0)
                .ToList();
            return prices.Count > 0 ? prices.Min() : null;
        }
        return null;
    }

    public static Image? PrimaryImage(Product product) => product.Image ?? product.Variants.FirstOrDefault(v => v.Image is not null)?.Image;

    /* Dough and sauce make the pizza; they are listed but cannot be removed. */
    public static bool IsBaseIngredient(string name) =>
        name.StartsWith("massa", StringComparison.OrdinalIgnoreCase) || name.StartsWith("molho de tomate", StringComparison.OrdinalIgnoreCase);

    /* A size joins the product name; a flavor or a drink stands on its own. */
    public static string VariantDisplayName(Product product, Variant variant) =>
        product.Variants.Count == 1 ? product.Name
        : (product.VariantLabel ?? "Tamanho") == "Tamanho" ? $"{product.Name} {variant.Label.ToLowerInvariant()}"
        : variant.Label;

    public static string Description(Product product) =>
        product.Summary ?? product.Variants.FirstOrDefault(v => v.Description is not null)?.Description ?? string.Empty;
}
