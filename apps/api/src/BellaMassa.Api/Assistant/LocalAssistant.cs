using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using BellaMassa.Domain;

namespace BellaMassa.Api.Assistant;

/* Development responder, active only when no Gemini key is configured outside
   production. It drives the same tools with keyword rules so the interface
   can be exercised offline; the stream ends with mode "local" and the chat
   labels it. */
public static partial class LocalAssistant
{
    [GeneratedRegex(@"(?:ate|r\$)\s*(\d{2,3})")]
    private static partial Regex Budget();

    [GeneratedRegex("quero|gostaria|sugere|sugestao|pizza|opcoes|algo|algum|alguma|coisa|ingrediente|buscar|montar|ajuda|escolher|tenho|reais")]
    private static partial Regex Filler();

    private static readonly (Regex Pattern, string Topic)[] StoreTopics =
    [
        (new("horario|abre|fecha"), "horario"),
        (new("entrega|frete|taxa"), "taxa_entrega"),
        (new("pagamento|pagar|pix|cartao|dinheiro"), "pagamento"),
        (new("endereco|onde fica"), "endereco"),
        (new("alergi|lactose|gluten|intoler"), "alergenos"),
        (new("whats|telefone|contato"), "whatsapp")
    ];

    public static async Task RunAsync(CatalogIndex index, ChatRequest request, Func<object, Task> emit)
    {
        var ctx = new ToolContext(index, request.Cart ?? [], emit);
        var text = TextTools.Normalize(request.Messages![^1].Text);
        Task Say(string value) => emit(ChatEvents.Text(value));
        await emit(ChatEvents.Status("Consultando o cardápio"));

        if (Regex.IsMatch(text, "endereco|onde fica|localiza|como chego|como chegar|mapa"))
        {
            await AssistantTools.RunAsync("show_location", null, ctx);
            await Say("Estamos aqui. Você pode copiar o endereço ou abrir direto no Google Maps.");
            return;
        }

        if (Regex.IsMatch(text, "whats|telefone|contato|atendente"))
        {
            await AssistantTools.RunAsync("show_contact", null, ctx);
            await Say("Aqui está o nosso WhatsApp. É só chamar que os atendentes respondem.");
            return;
        }

        foreach (var (pattern, topic) in StoreTopics)
        {
            if (!pattern.IsMatch(text)) continue;
            var info = await AssistantTools.RunAsync("get_store_info", new JsonObject { ["topic"] = topic }, ctx);
            await Say(info["status"]?.GetValue<string>() != "informado"
                ? "Essa eu prefiro não chutar. Mas é sempre bom confirmar diretamente com os atendentes, tá? Se quiser, eu te mando o nosso contato!"
                : info["open_now"] is { } open
                    ? $"{(open.GetValue<bool>() ? "Estamos abertos agora" : "Agora estamos fechados")}. Hoje: {info["today"]}.{(info["next_opening"] is { } next ? $" Abrimos {next}." : "")}"
                    : info["methods"] is JsonArray methods
                        ? $"Aceitamos {string.Join(", ", methods.Select(m => m!.GetValue<string>()))}. {info["note"]}"
                        : $"{info["label"]}: {info["value"]?.GetValue<string>().TrimEnd('.')}.");
            return;
        }

        var args = new JsonObject();
        var budget = Budget().Match(text);
        if (budget.Success) args["max_price_reais"] = int.Parse(budget.Groups[1].Value);
        if (Regex.IsMatch(text, "doce|sobremesa|chocolate|churros")) args["kind"] = "doce";
        else if (text.Contains("esfiha")) args["category"] = "esfihas";
        else if (Regex.IsMatch(text, "combo|amigos|familia|galera|dividir")) args["category"] = "combos";
        else if (Regex.IsMatch(text, "bebida|refri")) args["category"] = "bebidas";

        var words = Regex.Replace(text, "[^a-z\\s]", " ")
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length > 3 && !Filler().IsMatch(w))
            .Take(2)
            .ToList();
        var withQuery = (JsonObject)args.DeepClone();
        if (words.Count > 0) withQuery["query"] = string.Join(' ', words);
        var found = await AssistantTools.RunAsync("search_menu", withQuery, ctx);
        if (found["count"]?.GetValue<int>() == 0) found = await AssistantTools.RunAsync("search_menu", args, ctx);
        var ids = found["results"]?.AsArray().Take(3).Select(r => r!["id"]!.GetValue<string>()).ToList() ?? [];
        if (ids.Count == 0)
        {
            await Say("Não encontrei nada com esses critérios no cardápio. Quer tentar outro ingrediente ou um valor diferente?");
            return;
        }
        await Say(budget.Success
            ? $"Separei algumas opções dentro de R$ {budget.Groups[1].Value}, sem contar a taxa de entrega:"
            : "Separei algumas opções do cardápio que combinam com o que você pediu:");
        await AssistantTools.RunAsync("show_products", new JsonObject { ["product_ids"] = new JsonArray(ids.Select(id => (JsonNode)id).ToArray()) }, ctx);
    }
}
