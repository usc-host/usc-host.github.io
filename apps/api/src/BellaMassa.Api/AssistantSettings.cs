using System.Text.RegularExpressions;

namespace BellaMassa.Api;

/* Settings come from flat environment variables (GEMINI_API_KEY, ...), the
   same names used on Render and in .env.example. */
public sealed partial record AssistantSettings
{
    public required string Mode { get; init; }
    public required string ApiKey { get; init; }
    public required string Model { get; init; }
    public required string FallbackModel { get; init; }
    public required string ThinkingLevel { get; init; }
    public required int Retries { get; init; }
    public required TimeSpan CallTimeout { get; init; }
    public required int MessageChars { get; init; }
    public required int HistoryMessages { get; init; }
    public required int HistoryChars { get; init; }
    public required int ToolCallsPerTurn { get; init; }
    public required TimeSpan TurnTimeout { get; init; }
    public required int ChatPerMinute { get; init; }
    public required int ChatPerDay { get; init; }
    public required int QuotesPerMinute { get; init; }
    public required string[] AllowedOrigins { get; init; }

    [GeneratedRegex("^gemini-[a-z0-9.-]{2,60}$")]
    private static partial Regex ModelPattern();

    /* Without a key the assistant runs in local mode only outside production,
       so a deployed site never answers with scripted replies by accident. */
    public static AssistantSettings Load(IConfiguration config, IHostEnvironment env)
    {
        string Text(string key) => (config[key] ?? string.Empty).Trim();
        int Int(string key, int fallback, int min, int max) =>
            int.TryParse(config[key], out var n) ? Math.Clamp(n, min, max) : fallback;

        var apiKey = Text("GEMINI_API_KEY");
        var requested = Text("ASSISTANT_MODE");
        var mode = requested is "local" or "off" ? requested : apiKey.Length > 0 ? "gemini" : env.IsProduction() ? "off" : "local";
        var model = Text("GEMINI_MODEL");
        var fallback = Text("GEMINI_FALLBACK_MODEL");
        var thinking = Text("GEMINI_THINKING_LEVEL");
        var origins = Text("ALLOWED_ORIGINS");

        return new AssistantSettings
        {
            Mode = mode,
            ApiKey = apiKey,
            Model = ModelPattern().IsMatch(model) ? model : "gemini-3.8-flash",
            FallbackModel = ModelPattern().IsMatch(fallback) ? fallback : string.Empty,
            ThinkingLevel = thinking is "minimal" or "low" or "medium" or "high" ? thinking : string.Empty,
            Retries = Int("GEMINI_RETRIES", 2, 1, 4),
            CallTimeout = TimeSpan.FromMilliseconds(Int("GEMINI_TIMEOUT_MS", 25000, 5000, 60000)),
            MessageChars = Int("CHAT_MAX_MESSAGE_CHARS", 600, 50, 4000),
            HistoryMessages = Int("CHAT_MAX_HISTORY", 12, 2, 40),
            HistoryChars = Int("CHAT_MAX_HISTORY_CHARS", 5000, 500, 40000),
            ToolCallsPerTurn = Int("CHAT_MAX_TOOL_CALLS", 6, 1, 12),
            TurnTimeout = TimeSpan.FromMilliseconds(Int("CHAT_TURN_TIMEOUT_MS", 60000, 10000, 120000)),
            ChatPerMinute = Int("CHAT_RATE_PER_MINUTE", 10, 1, 120),
            ChatPerDay = Int("CHAT_RATE_PER_DAY", 150, 1, 5000),
            QuotesPerMinute = Int("QUOTES_RATE_PER_MINUTE", 60, 1, 600),
            AllowedOrigins = (origins.Length > 0 ? origins : "http://localhost:5173,http://127.0.0.1:5173,https://usc-host.github.io")
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        };
    }
}
