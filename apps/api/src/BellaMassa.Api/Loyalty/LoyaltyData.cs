using Microsoft.EntityFrameworkCore;

namespace BellaMassa.Api.Loyalty;

public sealed class Customer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    /* Stored lowercase and trimmed; it is the login. */
    public required string Email { get; set; }
    /* Digits only, with area code. */
    public required string Phone { get; set; }
    public required string PasswordHash { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? EmailVerifiedAt { get; set; }
}

public sealed class VerificationCode
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public required string CodeHash { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; }
    public int Attempts { get; set; }
    public bool Used { get; set; }
}

public sealed class Session
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public required string TokenHash { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; }
}

/* Every change in the balance is a row: points earned on an order (positive)
   or spent on a reward (negative). The balance is their sum. */
public sealed class PointsEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public int Points { get; set; }
    public required string Kind { get; set; }
    public required string Description { get; set; }
    public string? OrderCode { get; set; }
    public string? VoucherCode { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class LoyaltyDb(DbContextOptions<LoyaltyDb> options) : DbContext(options)
{
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<VerificationCode> Codes => Set<VerificationCode>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<PointsEntry> Points => Set<PointsEntry>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<Customer>(e =>
        {
            e.ToTable("customers");
            e.HasIndex(c => c.Email).IsUnique();
            e.Property(c => c.Name).HasMaxLength(80);
            e.Property(c => c.Email).HasMaxLength(160);
            e.Property(c => c.Phone).HasMaxLength(20);
        });
        model.Entity<VerificationCode>(e =>
        {
            e.ToTable("verification_codes");
            e.HasIndex(c => c.CustomerId);
        });
        model.Entity<Session>(e =>
        {
            e.ToTable("sessions");
            e.HasIndex(s => s.TokenHash).IsUnique();
        });
        model.Entity<PointsEntry>(e =>
        {
            e.ToTable("points");
            e.HasIndex(p => p.CustomerId);
            e.HasIndex(p => new { p.CustomerId, p.OrderCode }).IsUnique();
            e.Property(p => p.Description).HasMaxLength(160);
        });
    }
}

public sealed record Reward(string Id, string Name, string Description, int Points);

public static class Rewards
{
    /* 1 point per real spent. Values chosen for the presentation. */
    public static readonly Reward[] All =
    [
        new("refri-2l", "Refrigerante 2 L", "Guaraná Antarctica ou Conquista", 300),
        new("broto", "Pizza broto", "Qualquer sabor da casa", 600),
        new("grande", "Pizza grande", "Qualquer sabor da casa", 1000)
    ];
}
