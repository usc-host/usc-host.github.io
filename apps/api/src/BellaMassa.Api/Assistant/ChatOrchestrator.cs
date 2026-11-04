using System.Text.Json;
using System.Text;
using System.Text.Json.Nodes;
using BellaMassa.Domain;

namespace BellaMassa.Api.Assistant;

/* Dashes may be split across chunks, so text is released one word boundary
   at a time and cleaned before it reaches the customer. */
internal sealed class DashFilter
{
    private readonly StringBuilder _pending = new();

    public string Push(string delta)
    {
        _pending.Append(delta);
        var text = _pending.ToString();
        var cut = text.TrimEnd().Length == text.Length ? text.LastIndexOfAny([' ', '\n', '\t']) : text.Length - 1;
        if (cut < 0) return string.Empty;
        _pending.Clear().Append(text[cut..]);
        return TextTools.CleanDashes(text[..cut]);
    }

    public string Flush()
    {
        var text = TextTools.CleanDashes(_pending.ToString());
        _pending.Clear();
        return text;
    }
}

/* Models sometimes write a tool call as text, such as {"product_ids": [...]}.
   Anything that starts a line with "{" or a code fence is held back until the
   round ends, so it never reaches the customer as raw JSON. */
internal sealed class JsonGuard
{
    private readonly StringBuilder _held = new();
    private bool _lineStart = true;
    private bool _holding;

    public string Push(string text)
    {
        var output = new StringBuilder();
        foreach (var c in text)
        {
            if (_holding)
            {
                _held.Append(c);
                continue;
            }
            if (_lineStart && (c == '{' || c == '`'))
            {
                _holding = true;
                _held.Append(c);
                continue;
            }
            output.Append(c);
            if (c == '\n') _lineStart = true;
            else if (!char.IsWhiteSpace(c)) _lineStart = false;
        }
        return output.ToString();
    }

    public string TakeHeld()
    {
        var held = _held.ToString();
        _held.Clear();
        _holding = false;
        _lineStart = true;
        return held;
    }

    /* The held block as JSON, without code fences, or null when it is prose. */
    public static JsonObject? AsJson(string held)
    {
        var text = held.Trim();
        if (text.StartsWith("```", StringComparison.Ordinal))
        {
            text = text.Trim('`').Trim();
            if (text.StartsWith("json", StringComparison.OrdinalIgnoreCase)) text = text[4..];
        }
        try
        {
            return JsonNode.Parse(text) as JsonObject;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}

public sealed class ChatOrchestrator(GeminiClient gemini, AssistantSettings settings, CatalogIndex index)
{
    /* Keeps the newest messages within the configured count and size. The
       first kept message is always from the customer, as Gemini expects. */
    public static List<ChatMessage> TrimHistory(IReadOnlyList<ChatMessage> messages, int maxMessages, int maxChars)
    {
        var kept = new List<ChatMessage>();
        var size = 0;
        for (var i = messages.Count - 1; i >= 0 && kept.Count < maxMessages; i--)
        {
            if (size + messages[i].Text.Length > maxChars && kept.Count > 0) break;
            size += messages[i].Text.Length;
            kept.Insert(0, messages[i]);
        }
        while (kept.Count > 0 && kept[0].Role != "user") kept.RemoveAt(0);
        return kept;
    }

    public async Task<string> RunAsync(ChatRequest request, Func<object, Task> emit, CancellationToken ct)
    {
        var cart = request.Cart ?? [];
        var contents = new JsonArray();
        foreach (var m in TrimHistory(request.Messages!, settings.HistoryMessages, settings.HistoryChars))
            contents.Add(new JsonObject
            {
                ["role"] = m.Role == "user" ? "user" : "model",
                ["parts"] = new JsonArray(new JsonObject { ["text"] = m.Text })
            });
        if (contents[^1] is JsonObject last && last["role"]?.GetValue<string>() == "user")
            last["parts"]!.AsArray().Insert(0, new JsonObject { ["text"] = SystemPrompt.Context(cart, request.Page) });

        var ctx = new ToolContext(index, cart, emit);
        var filter = new DashFilter();
        var guard = new JsonGuard();
        var toolCalls = 0;
        var wroteText = false;
        var model = settings.Model;

        for (var round = 0; round <= settings.ToolCallsPerTurn; round++)
        {
            var allowTools = toolCalls < settings.ToolCallsPerTurn;
            var body = new JsonObject
            {
                ["systemInstruction"] = new JsonObject { ["parts"] = new JsonArray(new JsonObject { ["text"] = SystemPrompt.Text }) },
                ["contents"] = contents.DeepClone(),
                ["tools"] = new JsonArray(new JsonObject { ["functionDeclarations"] = AssistantTools.Declarations() }),
                ["toolConfig"] = new JsonObject { ["functionCallingConfig"] = new JsonObject { ["mode"] = allowTools ? "AUTO" : "NONE" } },
                ["generationConfig"] = new JsonObject { ["maxOutputTokens"] = 1024 }
            };
            if (settings.ThinkingLevel.Length > 0)
                body["generationConfig"]!["thinkingConfig"] = new JsonObject { ["thinkingLevel"] = settings.ThinkingLevel };

            var modelParts = new List<JsonObject>();
            var blocked = false;
            var roundText = false;

            async Task Write(string text)
            {
                if (text.Length == 0) return;
                // Text from a later round starts a new paragraph.
                await emit(ChatEvents.Text(wroteText && !roundText ? $"\n\n{text}" : text));
                wroteText = roundText = true;
            }

            await foreach (var chunk in gemini.StreamAsync(body, ct))
            {
                model = chunk.Model;
                blocked |= chunk.Blocked;
                foreach (var part in chunk.Parts)
                {
                    modelParts.Add(part);
                    if (part["text"] is JsonValue text && part["thought"]?.GetValue<bool>() != true)
                        await Write(guard.Push(filter.Push(text.GetValue<string>())));
                }
            }
            await Write(guard.Push(filter.Flush()));
            var held = guard.TakeHeld();
            if (held.Length > 0)
            {
                // A product list written as text becomes the cards it meant to be.
                if (JsonGuard.AsJson(held) is { } json)
                {
                    var args = json["args"] as JsonObject ?? json;
                    if (args["product_ids"] is JsonArray)
                        await AssistantTools.RunAsync("show_products", args, ctx);
                }
                else
                {
                    await Write(held);
                }
            }

            var calls = modelParts.Where(p => p["functionCall"] is JsonObject).ToList();
            if (calls.Count == 0)
            {
                if (blocked || !wroteText) throw new GeminiException("Não consegui responder a essa mensagem. Pode tentar de outro jeito?", true);
                return model;
            }

            // Parts go back exactly as received so thought signatures stay valid.
            contents.Add(new JsonObject { ["role"] = "model", ["parts"] = new JsonArray(modelParts.Select(p => (JsonNode)p.DeepClone()).ToArray()) });
            var responses = new JsonArray();
            foreach (var part in calls)
            {
                var call = part["functionCall"]!.AsObject();
                var name = call["name"]?.GetValue<string>() ?? string.Empty;
                toolCalls++;
                await emit(ChatEvents.Status(name == "get_store_info" ? "Consultando a loja" : "Consultando o cardápio"));
                var result = toolCalls > settings.ToolCallsPerTurn
                    ? new JsonObject { ["error"] = "Limite de consultas desta resposta atingido. Responda com o que já tem." }
                    : await AssistantTools.RunAsync(name, call["args"], ctx);
                var response = new JsonObject { ["name"] = name, ["response"] = result };
                if (call["id"] is JsonValue id) response["id"] = id.GetValue<string>();
                responses.Add(new JsonObject { ["functionResponse"] = response });
            }
            contents.Add(new JsonObject { ["role"] = "user", ["parts"] = responses });
        }
        throw new GeminiException("A resposta ficou longa demais. Tente uma pergunta mais direta.", true);
    }
}
