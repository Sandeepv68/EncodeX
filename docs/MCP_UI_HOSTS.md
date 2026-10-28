# 🖼️ MCP App host verification

EncodeX's MCP server serves thirteen interactive views (`ui://encodex/*`). A host that
supports [MCP Apps](https://modelcontextprotocol.io) (SEP-1865) fetches them and renders them
in a sandboxed iframe; a host that does not falls back to the tool's text result.

This page is the procedure for checking that the views really render **in a third-party host**.
The automated part of that story lives elsewhere:

| Check                                                                               | Where                                             |
| ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| The server advertises the extension and every view is listed and readable           | `npm run mcp:smoke`                               |
| Every served document is self-contained, mounts the right view and is within budget | `npm run mcp:host-check`                          |
| Every view renders the right content (React component tests)                        | `src/renderer/mcp-views/__tests__/views.test.tsx` |
| The views work against a real MCP Apps host                                         | **this page**                                     |

---

## 1. What to check

For each host:

1. **The view renders.** The host shows the EncodeX card, not an empty frame and not the raw
   JSON of the tool result.
2. **The styling follows the host.** The view uses the host's theme (light/dark) and fonts.
3. **The data is there.** The view shows the payload of the tool that was called - a job row, a
   stream table, the analysis findings.
4. **The approval gate holds.** A mutating tool (`convert_media`, `cut_video`, `batch_convert`,
   …) must **not** run on its own: the host shows the confirmation card, and the operation only
   starts when the user clicks **Run**.
5. **The view can call back.** Clicking **Cancel** on the queue view really cancels the job
   (the job disappears from the app's queue).
6. **Nothing external loads.** The host's network log shows no request from the view.

### Landmarks

Each view exposes a stable landmark, so it is obvious which view rendered:

| View                        | Landmark                                            |
| --------------------------- | --------------------------------------------------- |
| `ui://encodex/queue`        | "EncodeX queue" and one row per job                 |
| `ui://encodex/job`          | the job title and a **Cancel** button               |
| `ui://encodex/media-info`   | the stream table header                             |
| `ui://encodex/convert`      | the "New conversion" form with **Start conversion** |
| `ui://encodex/confirm`      | "Confirm operation" with **Run**                    |
| `ui://encodex/inspector`    | the "Findings" list                                 |
| `ui://encodex/plan`         | "Conversion plan" or "Size estimate"                |
| `ui://encodex/lab`          | "Compression lab" and the attempts table            |
| `ui://encodex/error`        | the error code badge                                |
| `ui://encodex/batch`        | "Confirm batch" or the batch dashboard              |
| `ui://encodex/workflow`     | "Workflow plan" or "Workflow run"                   |
| `ui://encodex/profiles`     | the profile table                                   |
| `ui://encodex/capabilities` | the encoder lists                                   |

---

## 2. Client configuration

The same server serves every host. The differences are how the host is told to start it.

### stdio (recommended)

```json
{
  "mcpServers": {
    "encodex": {
      "command": "node",
      "args": ["/absolute/path/to/EncodeX/dist/mcp/index.js"]
    }
  }
}
```

### Loopback HTTP

Start the app and enable **Settings → MCP server**; the endpoint is
`http://127.0.0.1:8765/mcp`. Copy the generated client configuration from
`site/.vitepress/theme/components/McpConfig.vue`, which carries a ready-made snippet per host.

---

## 3. The procedure, per host

1. Build the app and the views:

   ```bash
   npm run build          # includes build:mcp-ui (the standalone view bundle)
   npm run mcp:host-check # the automated part
   ```

2. Configure the host with the client configuration above and restart it.
3. Ask the host to run a read-only tool, e.g. _"list the available conversion profiles"_ or
   _"analyse this video"_. The profiles/capabilities/inspector views are the easiest to spot.
4. Walk the six checks in §1.
5. Record the outcome in the table in §5.

---

## 4. Hosts to test

| Host                              | How it renders views                            | Automation                                                                              |
| --------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| VS Code (Copilot / MCP extension) | Renders `ui://` resources in an MCP panel       | `npm run test:e2e:mcp:real` drives a real VS Code install (`e2e/mcp/vscode-ui.spec.ts`) |
| Claude Desktop                    | Renders the view in the chat                    | Manual                                                                                  |
| Claude Code                       | Renders the view in the terminal-adjacent panel | Manual                                                                                  |
| Cursor                            | Renders the view in the chat                    | Manual                                                                                  |
| ChatGPT                           | Renders the view in the conversation            | Manual                                                                                  |
| Goose                             | Renders the view in the session                 | Manual                                                                                  |
| MCPJam                            | Renders the view in the inspector               | Manual                                                                                  |

---

## 5. Results

Record one row per host and version. Leave a row empty until it has actually been checked.

| Host           | Version | OS  | Date | Result | Notes                                 |
| -------------- | ------- | --- | ---- | ------ | ------------------------------------- |
| VS Code        |         |     |      |        | driven by `e2e/mcp/vscode-ui.spec.ts` |
| Claude Desktop |         |     |      |        |                                       |
| Claude Code    |         |     |      |        |                                       |
| Cursor         |         |     |      |        |                                       |
| ChatGPT        |         |     |      |        |                                       |
| Goose          |         |     |      |        |                                       |
| MCPJam         |         |     |      |        |                                       |

A row is **pass** when all six checks in §1 hold. Anything else is a bug in the view pipeline
(`src/renderer/mcp-views/`) or in the server's resource metadata (`src/mcp/ui/`), not in the host.

---

## 6. When a host does not render the view

The views are self-contained on purpose: no external script, stylesheet, font or frame, and the
server declares empty CSP allowlists (`src/mcp/ui/resources.ts`). A host that renders nothing
usually means one of:

| Symptom                                  | Likely cause                                                                | Where to look                                         |
| ---------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| The host shows the tool's text result    | The host does not support the extension, or the MIME type is not advertised | `initialize` capabilities; `npm run mcp:smoke`        |
| The host shows an empty frame            | The document failed to execute (a CSP or module problem in the host)        | the host's console; `npm run mcp:host-check`          |
| The host renders the wrong view          | The bootstrap names a view the host did not ask for                         | `src/mcp/ui/bundle.ts`                                |
| The view renders but its data is missing | The host never delivered the tool result                                    | `src/renderer/mcp-views/standalone/AppExtAppsHost.ts` |

---

## Related

- [`MCP_UI.md`](MCP_UI.md) - how the views are built and what they show
- [`MCP.md`](MCP.md) - the server, its tools and its security model
- `plans/MCP_APPS_REACT_IN_APP_PLAN.md` - the implementation plan this procedure comes from
