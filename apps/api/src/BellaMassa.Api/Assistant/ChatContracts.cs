using BellaMassa.Domain;

namespace BellaMassa.Api.Assistant;

public sealed record ChatMessage(string Role, string Text);

/* Cart context sent with each message. No personal data, only what the
   assistant needs to propose changes to existing lines. */
public sealed record CartSnapshotLine(string LineId, string Name, int Quantity, List<string>? Summary);

public sealed record ChatRequest(List<ChatMessage>? Messages, List<CartSnapshotLine>? Cart, string? Page)
{
    public string? Validate(int maxMessageChars)
    {
        if (Messages is not { Count: >= 1 and <= 40 }) return "Mensagem inválida.";
        if (Messages.Any(m => m.Role is not ("user" or "assistant") || m.Text is null || m.Text.Length > 4000)) return "Mensagem inválida.";
        if (Cart is { Count: > 30 } || Cart?.Any(l => l.LineId is not { Length: <= 80 } || l.Name is not { Length: <= 120 } || l.Quantity is < 1 or > 99 || l.Summary is { Count: > 10 }) == true)
            return "Carrinho inválido.";
        if (Page is { Length: > 120 }) return "Mensagem inválida.";
        var last = Messages[^1];
        if (last.Role != "user") return "A última mensagem precisa ser do cliente.";
        if (string.IsNullOrWhiteSpace(last.Text) || last.Text.Length > maxMessageChars) return $"Escreva uma mensagem de até {maxMessageChars} caracteres.";
        return null;
    }
}

public sealed record ProductCard(string ProductId, string Slug, string Name, string? ImageUrl, int? FromPriceCents, string Description, string? Reason);

public sealed record CartProposal(
    string Id,
    string Action,
    LineConfig? Line,
    string? LineId,
    int? Quantity,
    LineQuote? Quote,
    string Label,
    DateTimeOffset ExpiresAt);

/* Events streamed to the browser, one JSON object per server sent event. */
public static class ChatEvents
{
    public static object Text(string delta) => new { type = "text", delta };
    public static object Status(string label) => new { type = "status", label };
    public static object Products(IEnumerable<ProductCard> items) => new { type = "products", items };
    public static object Proposal(CartProposal proposal) => new { type = "proposal", proposal };
    public static object Location(string name, string address, string mapsUrl) => new { type = "location", location = new { name, address, mapsUrl } };
    public static object Done(string mode, string? model = null) => new { type = "done", mode, model };
    public static object Error(string message, bool retryable) => new { type = "error", message, retryable };
}
