using Npgsql;

namespace BellaMassa.Api.Loyalty;

/* Render hands out postgres://user:password@host:port/database; Npgsql wants
   key=value pairs. */
public static class PostgresUrl
{
    public static string ToConnectionString(string url)
    {
        var uri = new Uri(url);
        var userInfo = uri.UserInfo.Split(':', 2);
        return new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty,
            Database = uri.AbsolutePath.TrimStart('/'),
            SslMode = uri.Host.Contains('.') ? SslMode.Require : SslMode.Prefer
        }.ConnectionString;
    }
}
