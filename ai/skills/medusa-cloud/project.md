# Medusa Cloud: Nimbus Nordic

- Backend, Admin and storefront are hosted on Medusa Cloud. Project and environment names are
  UNVERIFIED; find them with `mcloud projects list` and `mcloud environments list`.
- The CMS (`apps/cms`) is not on Medusa Cloud: it deploys to Azure App Service `app-payload`
  (`azure-pipelines-cms.yml`, manual trigger).
- Never pass `--reveal` to `mcloud variables` unless the user asks for a secret value.
