using System.Text.Json;
using System.Text.Json.Nodes;
using BellaMassa.Api.Assistant;
using BellaMassa.Domain;

namespace BellaMassa.Tests;

public sealed record DeliveryCase(string Name, string District, string Status, int? FeeCents, int? Options)
{
    public override string ToString() => Name;
}

public class StoreRulesTests
{
    private static readonly CatalogIndex Index = CatalogIndex.Load(Path.Combine(AppContext.BaseDirectory, "data", "catalog.json"));
    private static Store Store => Index.Catalog.Store;

    public static TheoryData<DeliveryCase> Cases()
    {
        var file = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "data", "delivery-cases.json")));
        var data = new TheoryData<DeliveryCase>();
        foreach (var c in file.RootElement.GetProperty("cases").EnumerateArray())
            data.Add(c.Deserialize<DeliveryCase>(CatalogIndex.Json)!);
        return data;
    }

    /* The same file runs in the TypeScript suite. */
    [Theory]
    [MemberData(nameof(Cases))]
    public void Taxa_por_bairro_compartilhada(DeliveryCase c)
    {
        var r = StoreRules.FindDeliveryFee(Store, c.District);
        var status = r.Status switch
        {
            DeliveryLookupStatus.Found => "found",
            DeliveryLookupStatus.Ambiguous => "ambiguous",
            DeliveryLookupStatus.Confirm => "confirm",
            _ => "not_found"
        };
        Assert.Equal(c.Status, status);
        if (c.FeeCents is not null) Assert.Equal(c.FeeCents, r.FeeCents);
        if (c.Options is not null) Assert.Equal(c.Options, r.Zones.Count);
    }

    [Theory]
    [InlineData("2026-11-03T23:00:00Z", true, null)]
    [InlineData("2026-11-04T05:00:00Z", false, "Quarta")]
    [InlineData("2026-11-08T02:45:00Z", false, "Domingo")]
    public void Horario_em_brasilia(string utc, bool open, string? next)
    {
        var s = StoreRules.OpenState(Store, DateTimeOffset.Parse(utc));
        Assert.Equal(open, s.Open);
        Assert.Equal(next, s.Next?.Label);
    }

    private static ToolContext Ctx(string utc = "2026-11-03T23:00:00Z") =>
        new(Index, [], _ => Task.CompletedTask) { Now = DateTimeOffset.Parse(utc) };

    [Fact]
    public async Task Ferramenta_de_taxa_responde_com_o_valor_da_lista()
    {
        var r = await AssistantTools.RunAsync("get_delivery_fee", new JsonObject { ["district"] = "jd panorama" }, Ctx());
        Assert.Equal("encontrado", r["status"]!.GetValue<string>());
        Assert.Equal("R$ 8,00", r["fee"]!.GetValue<string>());
    }

    [Fact]
    public async Task Taxa_com_valor_invalido_nao_vira_promessa()
    {
        var r = await AssistantTools.RunAsync("get_delivery_fee", new JsonObject { ["district"] = "Jardim Vitória" }, Ctx());
        Assert.Equal("varias_opcoes", r["status"]!.GetValue<string>());
        Assert.Contains(r["options"]!.AsArray(), o => o!["fee"]!.GetValue<string>() == "a confirmar");
        Assert.DoesNotContain("-R$", r.ToJsonString());
    }

    [Fact]
    public async Task Horario_diz_se_a_loja_esta_aberta()
    {
        var aberto = await AssistantTools.RunAsync("get_store_info", new JsonObject { ["topic"] = "horario" }, Ctx());
        Assert.True(aberto["open_now"]!.GetValue<bool>());
        Assert.Equal(7, aberto["week"]!.AsArray().Count);

        var fechado = await AssistantTools.RunAsync("get_store_info", new JsonObject { ["topic"] = "horario" }, Ctx("2026-11-04T05:00:00Z"));
        Assert.False(fechado["open_now"]!.GetValue<bool>());
        Assert.Equal("Quarta às 17:30", fechado["next_opening"]!.GetValue<string>());
    }

    [Fact]
    public async Task Pagamento_lista_as_formas_da_loja()
    {
        var r = await AssistantTools.RunAsync("get_store_info", new JsonObject { ["topic"] = "pagamento" }, Ctx());
        Assert.Contains("Pix", r["methods"]!.AsArray().Select(m => m!.GetValue<string>()));
    }
}
