using System.Text.RegularExpressions;

namespace BellaMassa.Domain;

public enum DeliveryLookupStatus { Found, Ambiguous, Confirm, NotFound }

public sealed record DeliveryLookup(DeliveryLookupStatus Status, IReadOnlyList<DeliveryZone> Zones)
{
    public int? FeeCents => Status == DeliveryLookupStatus.Found ? Zones[0].FeeCents : null;
}

public sealed record OpenState(bool Open, OpeningHours? Today, OpeningHours? Next);

/* Mirrors packages/domain/src/delivery.ts; data/delivery-cases.json keeps both
   sides in step. */
public static partial class StoreRules
{
    /* The store's list spells the same place in many ways ("Jd.", "Jardim",
       "B.Bonita"), so names are compared as sets of words. */
    private static readonly Dictionary<string, string> Abbreviations = new()
    {
        ["jd"] = "jardim",
        ["res"] = "residencial",
        ["cond"] = "condominio",
        ["b"] = "barra",
        ["ig"] = "igaracu"
    };
    private static readonly HashSet<string> Ignored = ["da", "das", "de", "do", "dos", "bairro", "no", "na", "em", "o", "a", "pra", "para"];
    private const int MaxOptions = 8;

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonWord();

    public static List<string> ZoneWords(string value) =>
        NonWord().Replace(TextTools.Normalize(value), " ")
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Select(w => Abbreviations.GetValueOrDefault(w, w))
            .Where(w => !Ignored.Contains(w))
            .ToList();

    private static bool Covers(List<string> zone, List<string> query) =>
        query.All(q => zone.Any(z => z == q || (q.Length >= 4 && z.StartsWith(q, StringComparison.Ordinal))));

    /* Exact names win over partial ones, so "Camil" is not mistaken for
       "Conjunto Camilo Saade". When every match costs the same the answer is
       that fee; otherwise the customer picks one of the options. */
    public static DeliveryLookup FindDeliveryFee(Store store, string district)
    {
        var query = ZoneWords(district);
        if (query.Count == 0) return new(DeliveryLookupStatus.NotFound, []);
        var zones = store.DeliveryZones ?? [];
        var key = string.Join(' ', query);
        var exact = zones.Where(z => string.Join(' ', ZoneWords(z.Name)) == key).ToList();
        var matches = exact.Count > 0 ? exact : zones.Where(z => Covers(ZoneWords(z.Name), query)).ToList();
        if (matches.Count == 0) return new(DeliveryLookupStatus.NotFound, []);

        var sameFee = matches.Select(z => z.FeeCents).Distinct().Count() == 1;
        if (sameFee && matches.All(z => z.Status == "approved")) return new(DeliveryLookupStatus.Found, [matches[0]]);
        if (matches.Count == 1) return new(DeliveryLookupStatus.Confirm, matches);
        return new(DeliveryLookupStatus.Ambiguous, matches.Take(MaxOptions).ToList());
    }

    /* Brasília has had no daylight saving since 2019. */
    private static readonly TimeSpan Brt = TimeSpan.FromHours(-3);

    private static int Minutes(string hhmm)
    {
        var parts = hhmm.Split(':');
        return int.Parse(parts[0]) * 60 + int.Parse(parts[1]);
    }

    public static OpenState OpenState(Store store, DateTimeOffset now)
    {
        var local = now.ToOffset(Brt);
        var day = (int)local.DayOfWeek;
        var minute = local.Hour * 60 + local.Minute;
        var hours = store.Hours ?? [];
        var today = hours.FirstOrDefault(h => h.Day == day);
        if (today is not null && minute >= Minutes(today.Open) && minute < Minutes(today.Close)) return new(true, today, null);
        if (today is not null && minute < Minutes(today.Open)) return new(false, today, today);
        var next = Enumerable.Range(1, 7).Select(i => hours.FirstOrDefault(h => h.Day == (day + i) % 7)).FirstOrDefault(h => h is not null);
        return new(false, today, next);
    }
}
