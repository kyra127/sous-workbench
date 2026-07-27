# SOUS Workbench v30.8

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

Requirements: Node.js 20+. An OpenAI API key is only required for live AI text and image generation; the rest of the product remains usable without one.

```powershell
Copy-Item .env.example .env.local
# Add OPENAI_API_KEY to .env.local
npm install
npm start
```

Open <http://127.0.0.1:8124/>.

For access from a phone on the same Wi-Fi network, keep the server running and open `http://<computer-LAN-IP>:8124/`. Windows Firewall must allow Node.js on the private network.

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
npm run build
npm run check
npm run test:acceptance
```

This version is a browser application served by Node.js and has no transpilation or generated production bundle. `npm run build` performs production syntax/runtime-asset validation; `npm start` is the production start command.

The versioned runtime-layer filenames are required dependencies of the current v30.8 UI and are loaded in a fixed order by `workbench-server.mjs`; they are not separately runnable legacy applications.

## Clean delivery contents

- Current v30.8 source, server, starter templates, logo, and acceptance checks
- No `.git`, `node_modules`, `.env.local`, API keys, logs, caches, screenshots, QA captures, installers, or archived UI directories
- `.env.example` contains variable names and safe defaults only

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


