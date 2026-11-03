using System.Collections.Concurrent;

namespace BellaMassa.Api.Http;

/* Fixed window counters kept in memory. Enough for a single Render instance;
   a restart simply resets the windows. */
public sealed class FixedWindowLimiter(int limit, TimeSpan window)
{
    private sealed class Counter
    {
        public DateTimeOffset Start;
        public int Count;
    }

    private readonly ConcurrentDictionary<string, Counter> _windows = new();

    public (bool Ok, int RetryAfterSeconds) Take(string key, DateTimeOffset? now = null)
    {
        var at = now ?? DateTimeOffset.UtcNow;
        var counter = _windows.GetOrAdd(key, _ => new Counter { Start = at });
        lock (counter)
        {
            if (at - counter.Start >= window)
            {
                counter.Start = at;
                counter.Count = 0;
            }
            if (counter.Count >= limit)
                return (false, (int)Math.Ceiling((counter.Start + window - at).TotalSeconds));
            counter.Count++;
        }
        if (_windows.Count > 5000) Sweep(at);
        return (true, 0);
    }

    private void Sweep(DateTimeOffset at)
    {
        foreach (var (key, counter) in _windows)
            if (at - counter.Start >= window) _windows.TryRemove(key, out _);
    }
}

public sealed class RateLimits(AssistantSettings settings)
{
    public FixedWindowLimiter ChatMinute { get; } = new(settings.ChatPerMinute, TimeSpan.FromMinutes(1));
    public FixedWindowLimiter ChatDay { get; } = new(settings.ChatPerDay, TimeSpan.FromDays(1));
    public FixedWindowLimiter Quotes { get; } = new(settings.QuotesPerMinute, TimeSpan.FromMinutes(1));

    public static string ClientKey(HttpContext context) => context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}
