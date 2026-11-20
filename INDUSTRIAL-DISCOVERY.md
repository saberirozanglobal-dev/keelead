# Industrial buyer discovery

The GitHub Actions workflow **KeeLead Industrial Buyer Discovery** is the unattended entry point. It searches for potential Iranian industrial end-users for Carbon Black, Process Oils, Rubber Additives, Silica & Fillers, and Polymer Raw Materials.

It uses community-operated public SearXNG JSON instances and inspects a limited number of first-party company websites for publicly displayed contact details. It does not invent company records, contacts, or evidence. Every CSV row contains a source URL and search evidence. These are potential end-users, not confirmed purchasing commitments; verify consumption and purchasing authority before outreach.

## Required GitHub Actions secrets

- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID

Configure both under Settings → Secrets and variables → Actions. The workflow still uploads CSV/JSON artifacts if Telegram is not configured. Deduplication uses the GitHub Actions cache and is best-effort (cache eviction/retention means it is not a transactional database).

## Run

Open Actions → KeeLead Industrial Buyer Discovery → Run workflow. A weekday schedule is also configured for 04:30 UTC. Download the keelead-results artifact for new-leads.csv and run-summary.json.

Public search instances may rate-limit or become unavailable. If every search request fails, the run exits non-zero and the report shows the failure; that must not be interpreted as zero market demand.
