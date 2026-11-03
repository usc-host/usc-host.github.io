using System.Text.Json;
using BellaMassa.Domain;

namespace BellaMassa.Tests;

public sealed record SharedCase(string Name, LineConfig Line, bool Ok, int? UnitCents, int? TotalCents, List<int>? Parts, List<string>? Issues)
{
    public override string ToString() => Name;
}

public class QuoteTests
{
    private static readonly CatalogIndex Index = CatalogIndex.Load(Path.Combine(AppContext.BaseDirectory, "data", "catalog.json"));

    public static TheoryData<SharedCase> Cases()
    {
        var file = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "data", "quote-cases.json")));
        var data = new TheoryData<SharedCase>();
        foreach (var c in file.RootElement.GetProperty("cases").EnumerateArray())
            data.Add(c.Deserialize<SharedCase>(CatalogIndex.Json)!);
        return data;
    }

    /* The same file runs in the TypeScript suite, so the browser preview and
       this API cannot drift apart. */
    [Theory]
    [MemberData(nameof(Cases))]
    public void Caso_compartilhado(SharedCase c)
    {
        var q = QuoteEngine.QuoteLine(Index, c.Line);
        Assert.Equal(c.Ok, q.Ok);
        if (c.UnitCents is not null) Assert.Equal(c.UnitCents, q.UnitCents);
        if (c.TotalCents is not null) Assert.Equal(c.TotalCents, q.TotalCents);
        if (c.Parts is not null) Assert.Equal(c.Parts, q.Parts.Select(p => p.Cents));
        if (c.Issues is not null) Assert.Equal(c.Issues, q.Issues.Select(i => i.Code));
    }

    [Fact]
    public void Revalida_quando_o_preco_do_catalogo_muda()
    {
        var line = new LineConfig("guarana-2l", "guarana-2l-un", 2);
        Assert.Equal(3380, QuoteEngine.QuoteCart(Index, [line]).TotalCents);

        var changed = Index.Catalog with
        {
            Version = "teste",
            Products = Index.Catalog.Products.Select(p => p.Id != "guarana-2l" ? p : p with
            {
                Variants = [p.Variants[0] with { Pricing = new PricingPolicy("fixed", 1790, null, null) }]
            }).ToList()
        };
        var quote = QuoteEngine.QuoteCart(new CatalogIndex(changed), [line]);
        Assert.Equal(3580, quote.TotalCents);
        Assert.Equal("teste", quote.CatalogVersion);
    }

    [Fact]
    public void Politica_de_preco_ausente_bloqueia_a_cotacao()
    {
        var changed = Index.Catalog with
        {
            Products = Index.Catalog.Products.Select(p => p.Id != "mega-trem" ? p : p with
            {
                Variants = [p.Variants[0] with { Pricing = new PricingPolicy("unknown", null, null, null) }]
            }).ToList()
        };
        var q = QuoteEngine.QuoteLine(new CatalogIndex(changed), new LineConfig("mega-trem", "mega-trem-unica", 1));
        Assert.Equal("PRICING_POLICY_MISSING", Assert.Single(q.Issues).Code);
        Assert.Null(q.TotalCents);
    }

    [Fact]
    public void Frete_desconhecido_continua_nulo()
    {
        var quote = QuoteEngine.QuoteCart(Index, [new LineConfig("coca-lata", "coca-lata-un", 1)]);
        Assert.Null(quote.DeliveryCents);
        Assert.True(quote.Complete);
    }

    [Theory]
    [InlineData(5690, "R$ 56,90")]
    [InlineData(26990, "R$ 269,90")]
    [InlineData(123456, "R$ 1.234,56")]
    [InlineData(5, "R$ 0,05")]
    public void Formata_em_reais(int cents, string expected) => Assert.Equal(expected, TextTools.Brl(cents));

    [Fact]
    public void Remove_travessoes()
    {
        var em = (char)0x2014;
        var en = (char)0x2013;
        Assert.Equal("Calabresa, a clássica", TextTools.CleanDashes($"Calabresa {em} a clássica"));
        Assert.Equal("40-65 min", TextTools.CleanDashes($"40{en}65 min"));
    }

    [Fact]
    public void Busca_ignora_acentos_e_encontra_ingrediente()
    {
        Assert.Contains(MenuSearch.Search(Index, new SearchInput("TARE")), p => p.Id == "bella-tare");
        var coalho = MenuSearch.Search(Index, new SearchInput("queijo coalho")).Select(p => p.Id).ToList();
        Assert.Contains("cupim-supremo", coalho);
        Assert.Contains("nordestina-especial", coalho);
    }
}
