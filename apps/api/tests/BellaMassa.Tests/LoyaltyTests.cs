using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BellaMassa.Tests;

public class LoyaltyTests
{
    /* Outside production, without an e-mail key, the API returns the code so
       the whole flow can be exercised. */
    private static HttpClient Client() =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(b => b.UseEnvironment("Testing")).CreateClient();

    private static string NewEmail() => $"cliente{Guid.NewGuid():N}@exemplo.com";

    private static async Task<JsonObject> Json(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonObject>())!;

    private static async Task<(HttpClient Client, string Email)> SignedIn()
    {
        var client = Client();
        var email = NewEmail();
        var reg = await Json(await client.PostAsJsonAsync("/api/auth/register", new { name = "Ana", email, phone = "(14) 99999-0000", password = "segredo123" }));
        var ok = await Json(await client.PostAsJsonAsync("/api/auth/verify", new { email, code = (string?)reg["devCode"] }));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", (string?)ok["token"]);
        return (client, email);
    }

    [Fact]
    public async Task Cadastro_confirma_com_codigo_de_seis_digitos()
    {
        var client = Client();
        var email = NewEmail();
        var reg = await client.PostAsJsonAsync("/api/auth/register", new { name = "Ana", email, phone = "14999990000", password = "segredo123" });
        Assert.Equal(HttpStatusCode.OK, reg.StatusCode);
        var body = await Json(reg);
        var code = (string?)body["devCode"];
        Assert.Matches("^[0-9]{6}$", code);
        Assert.StartsWith("c•", (string?)body["maskedEmail"]);

        var wrong = await client.PostAsJsonAsync("/api/auth/verify", new { email, code = code == "000000" ? "111111" : "000000" });
        Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);
        Assert.Equal(4, (int)(await Json(wrong))["attemptsLeft"]!);

        var ok = await client.PostAsJsonAsync("/api/auth/verify", new { email, code });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var session = await Json(ok);
        Assert.False(string.IsNullOrEmpty((string?)session["token"]));
        Assert.Equal(0, (int)session["profile"]!["points"]!);
    }

    [Fact]
    public async Task Cadastro_invalido_aponta_cada_campo()
    {
        var response = await Client().PostAsJsonAsync("/api/auth/register", new { name = "A", email = "sem-arroba", phone = "123", password = "curta" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var fields = (await Json(response))["fields"]!.AsObject();
        Assert.Equal(["name", "email", "phone", "password"], fields.Select(f => f.Key));
    }

    [Fact]
    public async Task Reenvio_respeita_o_intervalo()
    {
        var client = Client();
        var email = NewEmail();
        await client.PostAsJsonAsync("/api/auth/register", new { name = "Ana", email, phone = "14999990000", password = "segredo123" });
        var again = await client.PostAsJsonAsync("/api/auth/resend", new { email });
        Assert.Equal(HttpStatusCode.TooManyRequests, again.StatusCode);
        Assert.True((int)(await Json(again))["resendInSeconds"]! > 0);
    }

    [Fact]
    public async Task Email_confirmado_nao_pode_ser_cadastrado_de_novo_e_login_funciona()
    {
        var (_, email) = await SignedIn();
        var client = Client();
        var duplicate = await client.PostAsJsonAsync("/api/auth/register", new { name = "Outra", email, phone = "14999990000", password = "outrasenha" });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        var badLogin = await client.PostAsJsonAsync("/api/auth/login", new { email, password = "errada123" });
        Assert.Equal(HttpStatusCode.Unauthorized, badLogin.StatusCode);
        var login = await client.PostAsJsonAsync("/api/auth/login", new { email, password = "segredo123" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.NotNull((await Json(login))["token"]);
    }

    [Fact]
    public async Task Pontos_um_por_real_recalculados_no_servidor_e_sem_duplicar()
    {
        var (client, _) = await SignedIn();
        var order = new
        {
            orderCode = "BMTESTE1",
            lines = new object[] { new { productId = "cupim-supremo", variantId = "cupim-supremo-grande", quantity = 2, totalCents = 1 } }
        };
        var first = await Json(await client.PostAsJsonAsync("/api/loyalty/earn", order));
        Assert.Equal(179, (int)first["earned"]!);
        var again = await Json(await client.PostAsJsonAsync("/api/loyalty/earn", order));
        Assert.Equal(179, (int)again["profile"]!["points"]!);
    }

    [Fact]
    public async Task Resgate_exige_saldo_e_gera_voucher()
    {
        var (client, _) = await SignedIn();
        var poor = await client.PostAsJsonAsync("/api/loyalty/redeem", new { rewardId = "refri-2l" });
        Assert.Equal(HttpStatusCode.BadRequest, poor.StatusCode);

        await client.PostAsJsonAsync("/api/loyalty/earn", new
        {
            orderCode = "BMTESTE2",
            lines = new object[] { new { productId = "cupim-supremo", variantId = "cupim-supremo-grande", quantity = 4 } }
        });
        var redeem = await Json(await client.PostAsJsonAsync("/api/loyalty/redeem", new { rewardId = "refri-2l" }));
        Assert.Matches("^BM-[A-Z2-9]{4}-[A-Z2-9]{4}$", (string?)redeem["voucher"]);
        Assert.Equal(359 - 300, (int)redeem["profile"]!["points"]!);
    }

    [Fact]
    public async Task Rotas_de_conta_exigem_sessao()
    {
        var response = await Client().GetAsync("/api/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public void Endereco_do_render_vira_conexao_com_ssl_e_sem_kerberos()
    {
        var builder = new Npgsql.NpgsqlConnectionStringBuilder(
            BellaMassa.Api.Loyalty.PostgresUrl.ToConnectionString("postgres://bella:s%40nha@db.exemplo.com:5432/bella"));
        Assert.Equal("db.exemplo.com", builder.Host);
        Assert.Equal("s@nha", builder.Password);
        Assert.Equal(Npgsql.SslMode.Require, builder.SslMode);
        Assert.Equal(Npgsql.GssEncryptionMode.Disable, builder.GssEncryptionMode);
    }
}
