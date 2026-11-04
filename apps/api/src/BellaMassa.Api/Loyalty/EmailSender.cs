using System.Net;
using System.Net.Http.Json;

namespace BellaMassa.Api.Loyalty;

public sealed class EmailException(string message) : Exception(message);

/* Sends the confirmation code through Resend's REST API. Without a key the
   code is only logged, which the endpoints allow outside production. */
public sealed class EmailSender(IHttpClientFactory factory, IConfiguration config, ILogger<EmailSender> logger)
{
    public const string HttpClientName = "resend";

    private string ApiKey => (config["RESEND_API_KEY"] ?? string.Empty).Trim();
    private string From => string.IsNullOrWhiteSpace(config["EMAIL_FROM"]) ? "Bella Massa <onboarding@resend.dev>" : config["EMAIL_FROM"]!;

    public bool Configured => ApiKey.Length > 0;

    public async Task SendCodeAsync(string to, string name, string code, CancellationToken ct)
    {
        if (!Configured)
        {
            logger.LogInformation("Código de confirmação para {Email}: {Code}", to, code);
            return;
        }
        var client = factory.CreateClient(HttpClientName);
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails")
        {
            Content = JsonContent.Create(new
            {
                from = From,
                to = new[] { to },
                subject = $"Seu código Bella Massa: {code}",
                html = Template(name, code),
                text = $"Olá, {name}! Seu código de confirmação da Bella Massa é {code}. Ele vale por 10 minutos."
            })
        };
        request.Headers.Authorization = new("Bearer", ApiKey);
        using var response = await client.SendAsync(request, ct);
        if (response.IsSuccessStatusCode) return;
        var body = await response.Content.ReadAsStringAsync(ct);
        logger.LogWarning("Resend recusou o envio ({Status}): {Body}", (int)response.StatusCode, body);
        throw new EmailException(response.StatusCode == HttpStatusCode.TooManyRequests
            ? "Muitos envios agora. Tente de novo em instantes."
            : "Não foi possível enviar o e-mail com o código. Confira o endereço e tente de novo.");
    }

    private static string Template(string name, string code)
    {
        var digits = string.Concat(code.Select(d =>
            $"<td style=\"width:44px;height:56px;border-radius:12px;background:#fff9f0;border:1px solid #e9dfd1;font:700 28px/56px Arial,sans-serif;color:#191714;text-align:center\">{d}</td><td style=\"width:8px\"></td>"));
        return $"""
            <!doctype html>
            <html lang="pt-BR">
            <body style="margin:0;background:#fff9f0;padding:32px 16px;font-family:Arial,sans-serif;color:#191714">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr><td align="center">
                  <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:24px;border:1px solid #e9dfd1;padding:32px" cellspacing="0" cellpadding="0">
                    <tr><td style="font:700 13px Arial,sans-serif;letter-spacing:2px;color:#a3241f;text-transform:uppercase">Bella Massa</td></tr>
                    <tr><td style="padding-top:12px;font:700 26px Georgia,serif;color:#191714">Olá, {WebUtility.HtmlEncode(name)}!</td></tr>
                    <tr><td style="padding-top:10px;font:15px/1.6 Arial,sans-serif;color:#62594f">Use o código abaixo para confirmar seu e-mail e começar a juntar pontos no programa de fidelidade.</td></tr>
                    <tr><td align="center" style="padding:28px 0">
                      <table role="presentation" cellspacing="0" cellpadding="0"><tr>{digits}</tr></table>
                    </td></tr>
                    <tr><td style="font:13px/1.6 Arial,sans-serif;color:#62594f">O código vale por 10 minutos. Se não foi você, é só ignorar este e-mail.</td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """;
    }
}
