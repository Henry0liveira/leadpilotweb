# LeadPilot Web

Recovered from the deployed production web assets (not the original pre-build source). Existing CRM, WhatsApp, Kanban and Orbyta UI preserved. Google Places live search in Prospecção, restricted to authenticated workspace members. Results are not automatically persisted or exported; Google Maps attribution is displayed. Configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and GOOGLE_PLACES_API_KEY on Vercel. Set Google Cloud quota limits; the server's in-memory throttle is best-effort per instance. Run npm test and npm run build.
