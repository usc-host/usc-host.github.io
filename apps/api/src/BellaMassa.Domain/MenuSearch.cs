using System.Text.RegularExpressions;

namespace BellaMassa.Domain;

public sealed record SearchInput(string? Query = null, string? CategoryId = null, int? MaxPriceCents = null, string? Kind = null, bool MeatFree = false);

/* Options of a product without meat. Confirmed ones have registered
   ingredients and none of them is meat; by name only, the store has not
   registered the ingredients and the name mentions no meat. */
public sealed record MeatFreeOptions(List<string> Confirmed, List<string> ByNameOnly)
{
    public bool Any => Confirmed.Count > 0 || ByNameOnly.Count > 0;
}

public static class MenuSearch
{
    private static readonly Regex Sweet = new("doce|churros|nutella|chocolate|doce de leite", RegexOptions.Compiled);

    private static readonly Regex Meat = new(
        @"carne|frango|cupim|costela|alcatra|picanha|mignon|file|bife|atum|sardinha|anchova|camarao|peixe|lagosta|calabresa|bacon|presunto|lombo|peru|pepperoni|salame|linguica|salsicha|hot dog|strogonoff|charque|toscana",
        RegexOptions.Compiled);

    /* Labels that say nothing about the filling. */
    private static readonly HashSet<string> GenericLabels = ["pizza", "inteira", "combo", "unica", "70 cm"];

    private static bool HasMeat(IEnumerable<string> words) => words.Any(w => Meat.IsMatch(TextTools.Normalize(w)));

    public static MeatFreeOptions MeatFree(CatalogIndex index, Product product)
    {
        var confirmed = new List<string>();
        var byName = new List<string>();
        void Check(string name, List<string>? ingredients)
        {
            if (ingredients is { Count: > 0 })
            {
                if (!HasMeat(ingredients) && !HasMeat([name])) confirmed.Add(name);
            }
            else if (!HasMeat([name]) && !GenericLabels.Contains(TextTools.Normalize(name)))
            {
                byName.Add(name);
            }
        }

        foreach (var v in product.Variants)
        {
            if (v.Flavors is { } flavors)
            {
                // Builder flavors share their id with the premium product, which
                // carries the ingredient list.
                foreach (var id in flavors.Options)
                {
                    if (index.Flavor(id) is not { } f) continue;
                    var ingredients = f.Ingredients ?? index.Product(id)?.Variants.FirstOrDefault()?.Ingredients;
                    Check(f.Name, ingredients);
                }
            }
            else if (v.ComboGroups is null)
            {
                Check(product.Variants.Count > 1 ? v.Label : product.Name, v.Ingredients);
            }
        }
        return new(confirmed.Distinct().ToList(), byName.Distinct().Except(confirmed).ToList());
    }

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
            if (input.MeatFree && (product.CategoryIds.Contains("bebidas") || !MeatFree(index, product).Any)) return false;
            return words.All(text.Contains);
        }).ToList();
    }
}
