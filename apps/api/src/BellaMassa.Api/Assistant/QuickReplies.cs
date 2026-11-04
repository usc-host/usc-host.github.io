using System.Text.RegularExpressions;
using BellaMassa.Domain;

namespace BellaMassa.Api.Assistant;

/* Greetings and thanks get a fixed answer without calling the model: they
   carry nothing to look up and would otherwise cost a full turn with the
   whole menu toolset. When the customer's previous question is still
   unanswered, as after a timeout, the model answers it instead. */
public static partial class QuickReplies
{
    [GeneratedRegex(@"^(o+i+e?|oui|ola+|opa+|e ?a[ie]|hey|hello|hi|salve|bom dia|boa tarde|boa noite)( (tudo bem|td bem|tudo bom|bom dia|boa tarde|boa noite|bella massa))?$")]
    private static partial Regex Greeting();

    [GeneratedRegex(@"^(muito )?(obrigad[oa]|brigad[oa]|obg|valeu|vlw)( (viu|mesmo))?$")]
    private static partial Regex Thanks();

    [GeneratedRegex(@"[^a-z ]+")]
    private static partial Regex NotLetters();

    public static string? For(IReadOnlyList<ChatMessage> messages)
    {
        if (messages.Count == 0 || (messages.Count > 1 && messages[^2].Role == "user")) return null;
        return For(messages[^1].Text, firstMessage: messages.Count == 1);
    }

    public static string? For(string message, bool firstMessage = true)
    {
        var text = string.Join(' ', NotLetters().Replace(TextTools.Normalize(message), " ").Split(' ', StringSplitOptions.RemoveEmptyEntries));
        if (text.Length is 0 or > 40) return null;
        if (Thanks().IsMatch(text)) return "Por nada! Se bater vontade de mais alguma coisa, é só chamar.";
        if (!Greeting().IsMatch(text)) return null;
        var mood = text.Contains("tudo") ? "Tudo ótimo por aqui, e com você? " : string.Empty;
        return firstMessage
            ? $"Oi! {mood}Sou o assistente da Bella Massa. Posso sugerir uma pizza, montar um combo ou ver a taxa de entrega do seu bairro. O que vai ser hoje?"
            : $"Oi de novo! {mood}Em que mais posso ajudar?";
    }
}
