using System.Text.Json;
using BellaMassa.Api.Assistant;
using BellaMassa.Api.Http;
using BellaMassa.Domain;

namespace BellaMassa.Api.Endpoints;

public sealed record QuoteRequest(List<LineConfig>? Lines);

public static class PublicEndpoints
{
    public static IEndpointRouteBuilder MapPublicEndpoints(this IEndpointRouteBuilder api)
    {
        api.MapGet("/health", (CatalogIndex index, AssistantSettings settings) =>
            Results.Ok(new { ok = true, catalogVersion = index.Catalog.Version, assistant = settings.Mode }));

        api.MapGet("/menu", (CatalogIndex index) => Results.Ok(index.Catalog));

        api.MapGet("/products/{id}", (string id, CatalogIndex index) =>
            (index.Product(id) ?? index.ProductBySlug(id)) is { } product
                ? Results.Ok(new { catalogVersion = index.Catalog.Version, product })
                : ApiErrors.Result(404, "Produto não encontrado."));

        // Conflicting or pending store data never goes out as a value.
        api.MapGet("/store", (CatalogIndex index) =>
        {
            var store = index.Catalog.Store;
            return Results.Ok(store with
            {
                Info = store.Info.Select(i => i.Status is "observed" or "approved" ? i : i with { Value = null, Observations = null }).ToList()
            });
        });

        api.MapPost("/quotes", (QuoteRequest body, HttpContext http, CatalogIndex index, RateLimits limits) =>
        {
            if (Limited(limits.Quotes, http) is { } limited) return limited;
            if (body.Lines is not { Count: >= 1 and <= 30 }) return ApiErrors.Result(400, "Envie de 1 a 30 itens para cotar.");
            var issues = body.Lines.SelectMany((line, i) => QuoteEngine.ValidateShape(line).Select(message => new { path = $"lines.{i}", message })).Take(10).ToList();
            if (issues.Count > 0) return Results.Json(new { error = "Pedido de cotação inválido.", issues }, statusCode: 400);
            return Results.Ok(QuoteEngine.QuoteCart(index, body.Lines));
        });

        api.MapPost("/chat", HandleChat);
        return api;
    }

    private static IResult? Limited(FixedWindowLimiter limiter, HttpContext http)
    {
        var (ok, retryAfter) = limiter.Take(RateLimits.ClientKey(http));
        if (ok) return null;
        http.Response.Headers.RetryAfter = retryAfter.ToString();
        return ApiErrors.Result(429, "Muitas solicitações em sequência. Tente de novo em instantes.");
    }

    private static async Task HandleChat(HttpContext http, ChatRequest body, AssistantSettings settings, RateLimits limits,
        CatalogIndex index, ChatOrchestrator orchestrator, ILogger<ChatRequest> logger)
    {
        if ((Limited(limits.ChatMinute, http) ?? Limited(limits.ChatDay, http)) is { } limited)
        {
            await limited.ExecuteAsync(http);
            return;
        }
        if (body.Validate(settings.MessageChars) is { } invalid)
        {
            await ApiErrors.Result(400, invalid).ExecuteAsync(http);
            return;
        }
        if (settings.Mode == "off")
        {
            await ApiErrors.Result(503, "O assistente está indisponível no momento.").ExecuteAsync(http);
            return;
        }

        http.Response.ContentType = "text/event-stream; charset=utf-8";
        http.Response.Headers.CacheControl = "no-cache, no-transform";
        http.Response.Headers["X-Accel-Buffering"] = "no";
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(http.RequestAborted);
        timeout.CancelAfter(settings.TurnTimeout);
        var gate = new SemaphoreSlim(1, 1);

        async Task Emit(object payload)
        {
            await gate.WaitAsync();
            try
            {
                await http.Response.WriteAsync($"data: {JsonSerializer.Serialize(payload, CatalogIndex.Json)}\n\n");
                await http.Response.Body.FlushAsync();
            }
            catch (OperationCanceledException)
            {
                /* client went away */
            }
            finally
            {
                gate.Release();
            }
        }

        try
        {
            if (QuickReplies.For(body.Messages!) is { } quick)
            {
                await Emit(ChatEvents.Text(quick));
                await Emit(ChatEvents.Done(settings.Mode));
            }
            else if (settings.Mode == "local")
            {
                await LocalAssistant.RunAsync(index, body, Emit);
                await Emit(ChatEvents.Done("local"));
            }
            else
            {
                var model = await orchestrator.RunAsync(body, Emit, timeout.Token);
                await Emit(ChatEvents.Done("gemini", model));
            }
        }
        catch (GeminiException error)
        {
            await Emit(ChatEvents.Error(error.Message, error.Retryable));
        }
        catch (OperationCanceledException) when (!http.RequestAborted.IsCancellationRequested)
        {
            await Emit(ChatEvents.Error("O assistente demorou demais para responder. Tente de novo.", true));
        }
        catch (Exception error) when (!http.RequestAborted.IsCancellationRequested)
        {
            logger.LogError(error, "Falha no chat");
            await Emit(ChatEvents.Error("Algo deu errado ao responder. Tente de novo.", true));
        }
    }
}
