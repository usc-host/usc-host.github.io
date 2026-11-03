using System.Text.RegularExpressions;

namespace BellaMassa.Domain;

public sealed record SearchInput(string? Query = null, string? CategoryId = null, int? MaxPriceCents = null, string? Kind = null);

public static class MenuSearch
{
    private static readonly Regex Sweet = new("doce|churros|nutella|chocolate|doce de leite", RegexOptions.Compiled);

    private static string Haystack(CatalogIndex index, Product product)
    {
        var parts = new List<string> { product.Name, CatalogIndex.Description(product) };
        foreach (var v in product.Variants)
        {
            parts.Add(v.Label);
            parts.Add(v.Description ?? string.Empty);
            parts.AddRange(v.Ingredients ?? []);
            foreach (var id in v.Flavors?.Options ?? []) parts.Add(index.Flavor(id)?.Name ?? string.Empty);
        }
        foreach (var id in product.CategoryIds)
            parts.Add(index.Catalog.Categories.FirstOrDefault(c => c.Id == id)?.Name ?? string.Empty);
        return TextTools.Normalize(string.Join(' ', parts));
    }

    /* Every query word must appear somewhere in the product text. */
    public static List<Product> Search(CatalogIndex index, SearchInput input)
    {
        var words = TextTools.Normalize(input.Query ?? string.Empty)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length > 1)
            .ToList();
        return index.Catalog.Products.Where(product =>
        {
            if (input.CategoryId is not null && !product.CategoryIds.Contains(input.CategoryId)) return false;
            if (input.MaxPriceCents is not null)
            {
                var price = index.FromPriceCents(product);
                if (price is null || price > input.MaxPriceCents) return false;
            }
            var text = Haystack(index, product);
            if (input.Kind == "doce" && !Sweet.IsMatch(text)) return false;
            if (input.Kind == "salgada" && (product.CategoryIds.Contains("doces") || product.CategoryIds.Contains("bebidas"))) return false;
            return words.All(text.Contains);
        }).ToList();
    }
}
