using System.Text.Json;

namespace BellaMassa.Api.Http;

public static class ApiErrors
{
    public static IResult Result(int status, string message) => Results.Json(new { error = message }, statusCode: status);
}

/* Malformed JSON or a body that does not bind becomes a short Portuguese
   error instead of a stack trace. */
public sealed class ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception error) when (!context.Response.HasStarted && error is BadHttpRequestException or JsonException)
        {
            await ApiErrors.Result(400, "Requisição inválida.").ExecuteAsync(context);
        }
        catch (Exception error) when (!context.Response.HasStarted && !context.RequestAborted.IsCancellationRequested)
        {
            logger.LogError(error, "Erro não tratado");
            await ApiErrors.Result(500, "Algo deu errado. Tente de novo.").ExecuteAsync(context);
        }
    }
}
