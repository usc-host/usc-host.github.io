using System.Text.Json;

namespace BellaMassa.Domain;

public sealed class CatalogIndex
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly Dictionary<string, Product> _products;
    private readonly Dictionary<string, Product> _slugs;
    private readonly Dictionary<string, Flavor> _flavors;
    private readonly Dictionary<string, OptionGroup> _groups;

    public CatalogIndex(MenuCatalog catalog)
    {
        Catalog = catalog;
        _products = catalog.Products.ToDictionary(p => p.Id);
        _slugs = catalog.Products.ToDictionary(p => p.Slug);
        _flavors = catalog.Flavors.ToDictionary(f => f.Id);
        _groups = catalog.OptionGroups.ToDictionary(g => g.Id);
    }

    public MenuCatalog Catalog { get; }

    public static CatalogIndex Load(string path) =>
        new(JsonSerializer.Deserialize<MenuCatalog>(File.ReadAllText(path), Json)
            ?? throw new InvalidDataException($"Catálogo vazio em {path}"));

    public Product? Product(string id) => _products.GetValueOrDefault(id);
    public Product? ProductBySlug(string slug) => _slugs.GetValueOrDefault(slug);
    public Flavor? Flavor(string id) => _flavors.GetValueOrDefault(id);
    public OptionGroup? OptionGroup(string id) => _groups.GetValueOrDefault(id);

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

    public static Image? PrimaryImage(Product product) => product.Variants.FirstOrDefault(v => v.Image is not null)?.Image;

    public static string Description(Product product) =>
        product.Summary ?? product.Variants.FirstOrDefault(v => v.Description is not null)?.Description ?? string.Empty;
}
