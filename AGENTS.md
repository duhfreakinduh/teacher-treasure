# AI / Contributor Guide

This app is for educators/families. AI can help discover, adapt, or explain learning resources, but should not collect student information or invent educational claims.

## Priorities
1. Do not send student names, grades, disability/IEP information, photos, or other sensitive student data to remote AI services.
2. AI-generated resources must be labeled and easy for an adult to review/edit before use.
3. Keep search, saved resources, and core games usable without AI.
4. Never expose provider/API keys in public client code.
5. Prefer age-appropriate, simple language and avoid stereotyping or personalization based on sensitive traits.
6. Add deterministic fallbacks and short timeouts for AI/network features.
7. Preserve offline/PWA behavior where present.
8. Document data sources and AI limitations in README.

## Before merging
- Test without AI/network access.
- Verify no student-sensitive data is sent or logged.
- Test generated/adapted content for clear adult review controls.
- Check mobile/tablet layout and accessibility.
- Verify games/resources still work from existing saved data.
