using System.Net;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace BellaMassa.Api.Assistant;

public sealed class GeminiException(string message, bool retryable) : Exception(message)
{
    public bool Retryable { get; } = retryable;
}

public sealed record StreamChunk(string Model, List<JsonObject> Parts, bool Blocked);

/* Gemini over plain REST, following the UNI integration: x-goog-api-key
   header, per call timeout, retries only for temporary failures and an
   optional fallback model. The key never leaves the server or reaches an
   error text. */
public sealed class GeminiClient(IHttpClientFactory factory, AssistantSettings settings)
{
    public const string HttpClientName = "gemini";

    public static bool Temporary(int status) => status is 408 or 500 or 502 or 503 or 504;

    public static string ApiError(int http, string status = "", string message = "")
    {
        var name = status.ToUpperInvariant();
        if (http == 429 || name == "RESOURCE_EXHAUSTED") return "O assistente recebeu muitas perguntas agora. Tente de novo em instantes.";
        if (http == 400 && !message.Contains("key", StringComparison.OrdinalIgnoreCase) && !message.Contains("credential", StringComparison.OrdinalIgnoreCase))
            return "Não consegui processar essa conversa. Tente reformular a pergunta.";
        if (Temporary(http)) return "O assistente está sobrecarregado. Tente de novo em instantes.";
        // Authentication, permission and missing model look the same to the customer.
        return "O assistente está indisponível no momento.";
    }

    public static TimeSpan RetryDelay(int attempt, double retryAfterSeconds = 0)
    {
        var baseMs = Math.Min(8000, 1200 * Math.Pow(2, Math.Max(1, attempt) - 1));
        var headerMs = Math.Min(15000, Math.Max(0, retryAfterSeconds) * 1000);
        return TimeSpan.FromMilliseconds(Math.Max(baseMs, headerMs) * (0.85 + Random.Shared.NextDouble() * 0.3));
    }

    /* Streams one model turn. Retries happen only before the first chunk
       arrives, so the customer never sees a duplicated answer. */
    public async IAsyncEnumerable<StreamChunk> StreamAsync(JsonObject request, [EnumeratorCancellation] CancellationToken ct)
    {
        var (response, model) = await OpenAsync(request.ToJsonString(), ct);
        using (response)
        {
            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            await foreach (var payload in ReadEvents(stream, ct))
            {
                var candidate = payload["candidates"]?[0];
                var parts = candidate?["content"]?["parts"]?.AsArray()
                    .Select(p => p?.DeepClone() as JsonObject)
                    .OfType<JsonObject>()
                    .ToList() ?? [];
                yield return new StreamChunk(model, parts, payload["promptFeedback"]?["blockReason"] is not null);
            }
        }
    }

    private async Task<(HttpResponseMessage, string)> OpenAsync(string body, CancellationToken ct)
    {
        var models = new[] { settings.Model, settings.FallbackModel }.Where(m => m.Length > 0).Distinct().ToList();
        var client = factory.CreateClient(HttpClientName);
        var temporaryMessage = string.Empty;
        for (var m = 0; m < models.Count; m++)
        {
            var model = models[m];
            for (var attempt = 1; attempt <= settings.Retries; attempt++)
            {
                using var request = new HttpRequestMessage(HttpMethod.Post,
                    $"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse")
                {
                    Content = new StringContent(body, Encoding.UTF8, "application/json")
                };
                request.Headers.Add("x-goog-api-key", settings.ApiKey);
                HttpResponseMessage response;
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeout.CancelAfter(settings.CallTimeout);
                try
                {
                    response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
                }
                catch (Exception error) when (!ct.IsCancellationRequested && error is HttpRequestException or OperationCanceledException)
                {
                    // A network failure or timeout is temporary as well.
                    temporaryMessage = error is OperationCanceledException ? "O assistente demorou demais para responder." : "Falha de conexão com o assistente.";
                    // A model that hangs once usually hangs again: with a fallback
                    // configured, it gets the remaining time instead.
                    if (error is OperationCanceledException && m < models.Count - 1) break;
                    if (attempt < settings.Retries) await Task.Delay(RetryDelay(attempt), ct);
                    continue;
                }
                if (response.IsSuccessStatusCode) return (response, model);

                var (status, message) = await ErrorDetail(response, ct);
                var code = (int)response.StatusCode;
                var retryAfter = response.Headers.RetryAfter?.Delta?.TotalSeconds ?? 0;
                response.Dispose();
                if (code == (int)HttpStatusCode.TooManyRequests || status == "RESOURCE_EXHAUSTED")
                    throw new GeminiException(ApiError(429, status), true);
                // Authentication, missing model and malformed requests never get a retry.
                if (!Temporary(code)) throw new GeminiException(ApiError(code, status, message), false);
                temporaryMessage = ApiError(code, status, message);
                if (attempt < settings.Retries) await Task.Delay(RetryDelay(attempt, retryAfter), ct);
            }
        }
        throw new GeminiException(temporaryMessage.Length > 0 ? temporaryMessage : "O assistente está indisponível no momento.", true);
    }

    private static async Task<(string Status, string Message)> ErrorDetail(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            var body = JsonNode.Parse(await response.Content.ReadAsStringAsync(ct));
            return (body?["error"]?["status"]?.GetValue<string>() ?? string.Empty, body?["error"]?["message"]?.GetValue<string>() ?? string.Empty);
        }
        catch (Exception error) when (error is JsonException or InvalidOperationException)
        {
            return (string.Empty, string.Empty);
        }
    }

    /* Reads a server sent events body and yields each JSON payload. */
    private static async IAsyncEnumerable<JsonNode> ReadEvents(Stream stream, [EnumeratorCancellation] CancellationToken ct)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8);
        var data = new StringBuilder();
        while (await reader.ReadLineAsync(ct) is { } line)
        {
            if (line.Length == 0)
            {
                if (data.Length > 0 && JsonNode.Parse(data.ToString()) is { } node) yield return node;
                data.Clear();
            }
            else if (line.StartsWith("data:", StringComparison.Ordinal))
            {
                data.Append(line.AsSpan(5).Trim());
            }
        }
        if (data.Length > 0 && JsonNode.Parse(data.ToString()) is { } last) yield return last;
    }
}
