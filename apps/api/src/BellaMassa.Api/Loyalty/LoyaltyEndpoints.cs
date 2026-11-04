using System.Text.RegularExpressions;
using BellaMassa.Api.Http;
using BellaMassa.Domain;
using Microsoft.EntityFrameworkCore;

namespace BellaMassa.Api.Loyalty;

public sealed record RegisterRequest(string? Name, string? Email, string? Phone, string? Password);
public sealed record VerifyRequest(string? Email, string? Code);
public sealed record EmailRequest(string? Email);
public sealed record LoginRequest(string? Email, string? Password);
public sealed record EarnRequest(string? OrderCode, List<LineConfig>? Lines);
public sealed record RedeemRequest(string? RewardId);

public static partial class LoyaltyEndpoints
{
    public static readonly TimeSpan CodeTtl = TimeSpan.FromMinutes(10);
    public static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(45);
    public static readonly TimeSpan SessionTtl = TimeSpan.FromDays(30);
    public const int MaxAttempts = 5;

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")]
    private static partial Regex EmailPattern();

    [GeneratedRegex("^BM[A-Z0-9]{4,10}$")]
    private static partial Regex OrderPattern();

    private static string NormalizeEmail(string? email) => (email ?? string.Empty).Trim().ToLowerInvariant();
    private static string Digits(string? phone) => new((phone ?? string.Empty).Where(char.IsDigit).ToArray());

    private static string Mask(string email)
    {
        var at = email.IndexOf('@');
        return at <= 1 ? email : $"{email[0]}{new string('•', Math.Min(6, at - 1))}{email[at..]}";
    }

    public static IEndpointRouteBuilder MapLoyaltyEndpoints(this IEndpointRouteBuilder api)
    {
        var auth = api.MapGroup("/auth");
        auth.MapPost("/register", Register);
        auth.MapPost("/verify", Verify);
        auth.MapPost("/resend", Resend);
        auth.MapPost("/login", Login);
        auth.MapPost("/logout", Logout);
        api.MapGet("/me", Me);
        api.MapPost("/loyalty/earn", Earn);
        api.MapPost("/loyalty/redeem", Redeem);
        api.MapGet("/loyalty/rewards", () => Results.Ok(new { rewards = Rewards.All }));
        return api;
    }

    /* The program needs a database; without one every route answers 503. */
    private static LoyaltyDb? Db(HttpContext http) => http.RequestServices.GetService<LoyaltyDb>();
    private static IResult Off() => ApiErrors.Result(503, "O programa de fidelidade está indisponível no momento.");

    private static IResult? Limited(HttpContext http, RateLimits limits)
    {
        var (ok, retryAfter) = limits.Auth.Take(RateLimits.ClientKey(http));
        if (ok) return null;
        http.Response.Headers.RetryAfter = retryAfter.ToString();
        return ApiErrors.Result(429, "Muitas tentativas em sequência. Aguarde um pouco e tente de novo.");
    }

    /* Creates a fresh code (older ones stop working) and e-mails it. Outside
       production, without an e-mail key, the code comes back in the response. */
    private static async Task<IResult> SendCode(LoyaltyDb db, Customer customer, EmailSender email, IHostEnvironment env, CancellationToken ct)
    {
        var last = await db.Codes.Where(c => c.CustomerId == customer.Id).OrderByDescending(c => c.CreatedAt).FirstOrDefaultAsync(ct);
        if (last is not null && !last.Used && DateTimeOffset.UtcNow - last.CreatedAt < ResendCooldown)
        {
            var wait = (int)Math.Ceiling((ResendCooldown - (DateTimeOffset.UtcNow - last.CreatedAt)).TotalSeconds);
            return Results.Json(new { error = $"Aguarde {wait} segundos para pedir outro código.", resendInSeconds = wait }, statusCode: 429);
        }
        if (!email.Configured && env.IsProduction()) return ApiErrors.Result(503, "O envio de e-mail está indisponível no momento.");

        await db.Codes.Where(c => c.CustomerId == customer.Id && !c.Used).ExecuteUpdateAsyncSafe(db, ct);
        var code = Secrets.NewCode();
        db.Codes.Add(new VerificationCode { CustomerId = customer.Id, CodeHash = Secrets.HashCode(customer.Id, code), ExpiresAt = DateTimeOffset.UtcNow + CodeTtl });
        await db.SaveChangesAsync(ct);
        try
        {
            await email.SendCodeAsync(customer.Email, customer.Name, code, ct);
        }
        catch (EmailException error)
        {
            return ApiErrors.Result(502, error.Message);
        }
        return Results.Ok(new
        {
            needsVerification = true,
            email = customer.Email,
            maskedEmail = Mask(customer.Email),
            expiresInSeconds = (int)CodeTtl.TotalSeconds,
            resendInSeconds = (int)ResendCooldown.TotalSeconds,
            devCode = email.Configured ? null : code
        });
    }

    private static async Task<IResult> Register(RegisterRequest body, HttpContext http, RateLimits limits, EmailSender email, IHostEnvironment env, CancellationToken ct)
    {
        if (Db(http) is not { } db) return Off();
        if (Limited(http, limits) is { } limited) return limited;
        var name = (body.Name ?? string.Empty).Trim();
        var mail = NormalizeEmail(body.Email);
        var phone = Digits(body.Phone);
        var errors = new Dictionary<string, string>();
        if (name.Length is < 2 or > 80) errors["name"] = "Informe seu nome.";
        if (mail.Length > 160 || !EmailPattern().IsMatch(mail)) errors["email"] = "Informe um e-mail válido.";
        if (phone.Length is < 10 or > 11) errors["phone"] = "Informe o celular com DDD.";
        if (body.Password is not { Length: >= 8 and <= 128 }) errors["password"] = "A senha precisa ter pelo menos 8 caracteres.";
        if (errors.Count > 0) return Results.Json(new { error = "Confira os dados do cadastro.", fields = errors }, statusCode: 400);

        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Email == mail, ct);
        if (customer?.EmailVerifiedAt is not null)
            return Results.Json(new { error = "Já existe uma conta com esse e-mail. Entre com sua senha.", fields = new { email = "E-mail já cadastrado." } }, statusCode: 409);
        if (customer is null)
        {
            customer = new Customer { Name = name, Email = mail, Phone = phone, PasswordHash = Secrets.HashPassword(body.Password!) };
            db.Customers.Add(customer);
        }
        else
        {
            // An unconfirmed sign up can be redone with new data.
            customer.Name = name;
            customer.Phone = phone;
            customer.PasswordHash = Secrets.HashPassword(body.Password!);
        }
        await db.SaveChangesAsync(ct);
        return await SendCode(db, customer, email, env, ct);
    }

    private static async Task<IResult> Resend(EmailRequest body, HttpContext http, RateLimits limits, EmailSender email, IHostEnvironment env, CancellationToken ct)
    {
        if (Db(http) is not { } db) return Off();
        if (Limited(http, limits) is { } limited) return limited;
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Email == NormalizeEmail(body.Email), ct);
        if (customer is null || customer.EmailVerifiedAt is not null) return ApiErrors.Result(400, "Não há confirmação pendente para esse e-mail.");
        return await SendCode(db, customer, email, env, ct);
    }

    private static async Task<IResult> Verify(VerifyRequest body, HttpContext http, RateLimits limits, CancellationToken ct)
    {
        if (Db(http) is not { } db) return Off();
        if (Limited(http, limits) is { } limited) return limited;
        var code = new string((body.Code ?? string.Empty).Where(char.IsDigit).ToArray());
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Email == NormalizeEmail(body.Email), ct);
        if (customer is null || code.Length != 6) return ApiErrors.Result(400, "Código incorreto.");
        var pending = await db.Codes.Where(c => c.CustomerId == customer.Id && !c.Used).OrderByDescending(c => c.CreatedAt).FirstOrDefaultAsync(ct);
        if (pending is null) return ApiErrors.Result(400, "Peça um novo código.");
        if (pending.ExpiresAt < DateTimeOffset.UtcNow) return ApiErrors.Result(410, "Esse código expirou. Peça outro.");
        if (pending.Attempts >= MaxAttempts) return ApiErrors.Result(429, "Muitas tentativas. Peça um novo código.");
        if (!Secrets.SameHash(pending.CodeHash, Secrets.HashCode(customer.Id, code)))
        {
            pending.Attempts++;
            await db.SaveChangesAsync(ct);
            var left = MaxAttempts - pending.Attempts;
            return Results.Json(new { error = left > 0 ? $"Código incorreto. Restam {left} tentativas." : "Muitas tentativas. Peça um novo código.", attemptsLeft = left }, statusCode: 400);
        }
        pending.Used = true;
        customer.EmailVerifiedAt ??= DateTimeOffset.UtcNow;
        var token = await OpenSession(db, customer, ct);
        return Results.Ok(new { token, profile = await Profile(db, customer, ct) });
    }

    private static async Task<IResult> Login(LoginRequest body, HttpContext http, RateLimits limits, EmailSender email, IHostEnvironment env, CancellationToken ct)
    {
        if (Db(http) is not { } db) return Off();
        if (Limited(http, limits) is { } limited) return limited;
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Email == NormalizeEmail(body.Email), ct);
        if (customer is null || body.Password is null || !Secrets.VerifyPassword(body.Password, customer.PasswordHash))
            return ApiErrors.Result(401, "E-mail ou senha incorretos.");
        if (customer.EmailVerifiedAt is null) return await SendCode(db, customer, email, env, ct);
        var token = await OpenSession(db, customer, ct);
        return Results.Ok(new { token, profile = await Profile(db, customer, ct) });
    }

    private static async Task<IResult> Logout(HttpContext http, CancellationToken ct)
    {
        if (Db(http) is not { } db) return Off();
        if (await CurrentSession(db, http, ct) is { } session)
        {
            db.Sessions.Remove(session);
            await db.SaveChangesAsync(ct);
        }
        return Results.NoContent();
    }

    private static async Task<IResult> Me(HttpContext http, CancellationToken ct)
    {
        if (Db(http) is not { } db) return Off();
        if (await CurrentCustomer(db, http, ct) is not { } customer) return ApiErrors.Result(401, "Entre na sua conta.");
        return Results.Ok(await Profile(db, customer, ct));
    }

    /* Points come from the order total recalculated here, one point per real.
       The same order code never earns twice. */
    private static async Task<IResult> Earn(EarnRequest body, HttpContext http, CatalogIndex index, CancellationToken ct)
    {
        if (Db(http) is not { } db) return Off();
        if (await CurrentCustomer(db, http, ct) is not { } customer) return ApiErrors.Result(401, "Entre na sua conta.");
        var orderCode = (body.OrderCode ?? string.Empty).Trim().ToUpperInvariant();
        if (!OrderPattern().IsMatch(orderCode) || body.Lines is not { Count: >= 1 and <= 30 } || body.Lines.Any(l => QuoteEngine.ValidateShape(l).Count > 0))
            return ApiErrors.Result(400, "Pedido inválido.");
        var existing = await db.Points.FirstOrDefaultAsync(p => p.CustomerId == customer.Id && p.OrderCode == orderCode, ct);
        if (existing is null)
        {
            var quote = QuoteEngine.QuoteCart(index, body.Lines);
            if (!quote.Complete) return ApiErrors.Result(400, "Um item do pedido mudou. Confira o carrinho.");
            existing = new PointsEntry { CustomerId = customer.Id, Points = quote.TotalCents / 100, Kind = "earn", Description = $"Pedido {orderCode}", OrderCode = orderCode };
            db.Points.Add(existing);
            await db.SaveChangesAsync(ct);
        }
        return Results.Ok(new { earned = existing.Points, profile = await Profile(db, customer, ct) });
    }

    private static async Task<IResult> Redeem(RedeemRequest body, HttpContext http, CancellationToken ct)
    {
        if (Db(http) is not { } db) return Off();
        if (await CurrentCustomer(db, http, ct) is not { } customer) return ApiErrors.Result(401, "Entre na sua conta.");
        var reward = Rewards.All.FirstOrDefault(r => r.Id == body.RewardId);
        if (reward is null) return ApiErrors.Result(400, "Recompensa inválida.");
        var balance = await db.Points.Where(p => p.CustomerId == customer.Id).SumAsync(p => p.Points, ct);
        if (balance < reward.Points) return ApiErrors.Result(400, $"Faltam {reward.Points - balance} pontos para essa recompensa.");
        var voucher = Secrets.NewVoucher();
        db.Points.Add(new PointsEntry { CustomerId = customer.Id, Points = -reward.Points, Kind = "redeem", Description = reward.Name, VoucherCode = voucher });
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { voucher, reward, profile = await Profile(db, customer, ct) });
    }

    private static async Task<string> OpenSession(LoyaltyDb db, Customer customer, CancellationToken ct)
    {
        var token = Secrets.NewToken();
        db.Sessions.Add(new Session { CustomerId = customer.Id, TokenHash = Secrets.Sha(token), ExpiresAt = DateTimeOffset.UtcNow + SessionTtl });
        await db.SaveChangesAsync(ct);
        return token;
    }

    private static async Task<Session?> CurrentSession(LoyaltyDb db, HttpContext http, CancellationToken ct)
    {
        var header = http.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.Ordinal)) return null;
        var hash = Secrets.Sha(header[7..].Trim());
        var session = await db.Sessions.FirstOrDefaultAsync(s => s.TokenHash == hash, ct);
        return session is not null && session.ExpiresAt > DateTimeOffset.UtcNow ? session : null;
    }

    private static async Task<Customer?> CurrentCustomer(LoyaltyDb db, HttpContext http, CancellationToken ct) =>
        await CurrentSession(db, http, ct) is { } session ? await db.Customers.FindAsync([session.CustomerId], ct) : null;

    private static async Task<object> Profile(LoyaltyDb db, Customer customer, CancellationToken ct)
    {
        var entries = await db.Points.Where(p => p.CustomerId == customer.Id).OrderByDescending(p => p.CreatedAt).ToListAsync(ct);
        return new
        {
            name = customer.Name,
            email = customer.Email,
            phone = customer.Phone,
            points = entries.Sum(p => p.Points),
            history = entries.Take(30).Select(p => new { p.Points, p.Kind, p.Description, p.OrderCode, p.VoucherCode, p.CreatedAt }),
            rewards = Rewards.All
        };
    }

    /* Marks pending codes as used. Loads and saves instead of ExecuteUpdate so
       it also works with the in-memory provider used in development. */
    private static async Task ExecuteUpdateAsyncSafe(this IQueryable<VerificationCode> query, LoyaltyDb db, CancellationToken ct)
    {
        foreach (var code in await query.ToListAsync(ct)) code.Used = true;
        await db.SaveChangesAsync(ct);
    }
}
