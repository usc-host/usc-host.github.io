# API da Bella Massa para o Render (runtime Docker). Contexto de build: raiz do repositório.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY apps/api/ ./apps/api/
COPY data/ ./data/
RUN dotnet publish apps/api/src/BellaMassa.Api/BellaMassa.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_ENVIRONMENT=Production
USER $APP_UID
EXPOSE 10000
CMD ["sh", "-c", "exec dotnet BellaMassa.Api.dll --urls http://0.0.0.0:${PORT:-10000}"]
