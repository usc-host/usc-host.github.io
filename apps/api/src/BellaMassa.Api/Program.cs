using System.Text.Json;
using BellaMassa.Api;
using BellaMassa.Api.Assistant;
using BellaMassa.Api.Endpoints;
using BellaMassa.Api.Http;
using BellaMassa.Domain;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false;
    options.Limits.MaxRequestBodySize = 64 * 1024;
});

// Resolved lazily so test hosts can override configuration before first use.
builder.Services.AddSingleton(sp => AssistantSettings.Load(sp.GetRequiredService<IConfiguration>(), sp.GetRequiredService<IHostEnvironment>()));
builder.Services.AddSingleton(sp =>
{
    var path = sp.GetRequiredService<IConfiguration>()["CATALOG_PATH"];
    return CatalogIndex.Load(string.IsNullOrWhiteSpace(path) ? Path.Combine(AppContext.BaseDirectory, "data", "catalog.json") : path);
});
builder.Services.AddSingleton<RateLimits>();
builder.Services.AddHttpClient(GeminiClient.HttpClientName, client => client.Timeout = Timeout.InfiniteTimeSpan);
builder.Services.AddSingleton<GeminiClient>();
builder.Services.AddSingleton<ChatOrchestrator>();
builder.Services.AddCors();
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);

// Render terminates TLS in front of the container and forwards the client address.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

var web = builder.Build();
var settings = web.Services.GetRequiredService<AssistantSettings>();

web.UseForwardedHeaders();
web.UseMiddleware<ErrorHandlingMiddleware>();
web.UseCors(policy => policy
    .SetIsOriginAllowed(origin => settings.AllowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase))
    .WithMethods("GET", "POST")
    .WithHeaders("content-type"));

web.MapGet("/", () => Results.Ok(new { name = "Bella Massa API" }));
web.MapGroup("/api").MapPublicEndpoints();
web.MapFallback("/api/{**path}", () => ApiErrors.Result(404, "Endereço não encontrado."));

web.Logger.LogInformation("Assistente em modo {Mode}{Model}", settings.Mode, settings.Mode == "gemini" ? $" ({settings.Model})" : string.Empty);
web.Run();

public partial class Program;
