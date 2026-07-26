# SOUS Workbench

SOUS is a local-first AI operations workbench for solo operators and very small
businesses. It turns customer messages and chat screenshots into reviewable
order drafts, then supports human confirmation, order tracking, deterministic
prep calculations, catalog management, and AI-assisted content creation.

## Product boundary

- AI understands, summarizes, and drafts.
- Program rules calculate totals, margin, material demand, inventory gaps, and status.
- The operator confirms orders, corrects fields, sets prices, and makes final decisions.

AI output never creates a formal order or publishes content without an explicit
user action.

## Local setup

Requirements: Node.js 20+ and an OpenAI API key.

```powershell
Copy-Item .env.example .env.local
# Add OPENAI_API_KEY to .env.local
npm install
npm start
```

Open <http://127.0.0.1:8124/>.

## Configuration

| Variable | Required | Default |
|---|---:|---|
| `OPENAI_API_KEY` | Yes for AI features | — |
| `OPENAI_TEXT_MODEL` | No | `gpt-5.6-luna` |
| `OPENAI_IMAGE_MODEL` | No | `gpt-image-2` |
| `PORT` | No | `8124` |
| `ALLOWED_ORIGINS` | Recommended in production | same-origin |

Never commit `.env.local` or an API key. Customer messages and screenshots are
sent to the configured OpenAI project when AI features are used.

## Validation

```powershell
npm run check
npm run test:acceptance
```

## Deployment

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/kyra127/sous-workbench)

GitHub Pages and a direct Vercel Functions migration are not supported by this
version because SOUS requires a server-side OpenAI proxy and accepts screenshot
payloads larger than common serverless limits.

The included `render.yaml` deploys the application as a Render Web Service:

1. Push this directory to GitHub.
2. Create a Render Blueprint from the repository.
3. Add `OPENAI_API_KEY` as a secret.
4. Set `ALLOWED_ORIGINS` to the final Render or custom-domain URL.

Business data is stored in the user's browser `localStorage`. There is no cloud
account, server database, or multi-device synchronization.
