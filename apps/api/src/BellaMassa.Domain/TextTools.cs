using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace BellaMassa.Domain;

public static partial class TextTools
{
    /* Lowercase without accents, for search that ignores case and diacritics. */
    public static string Normalize(string value)
    {
        var decomposed = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        foreach (var c in decomposed)
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) builder.Append(c);
        return builder.ToString().ToLowerInvariant().Trim();
    }

    private static readonly string Dashes = new([(char)0x2012, (char)0x2013, (char)0x2014, (char)0x2015, (char)0x2212]);
    private static readonly Regex SpacedDash = new($@"\s+[{Dashes}]\s+", RegexOptions.Compiled);
    private static readonly Regex AnyDash = new($"[{Dashes}]", RegexOptions.Compiled);

    /* The brand voice never uses long dashes. Model output goes through this
       before reaching the customer. */
    public static string CleanDashes(string value) => AnyDash.Replace(SpacedDash.Replace(value, ", "), "-");

    /* "R$ 1.234,90" without depending on ICU culture data in the container. */
    public static string Brl(int cents)
    {
        var reais = Math.Abs(cents) / 100;
        var rest = Math.Abs(cents) % 100;
        var grouped = reais.ToString("#,0", CultureInfo.InvariantCulture).Replace(',', '.');
        return $"{(cents < 0 ? "-" : "")}R$ {grouped},{rest:00}";
    }

    public static string Plural(int n, string one, string many) => $"{n} {(n == 1 ? one : many)}";
}
