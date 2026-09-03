# Claude Code and Claude Desktop

Claude Code, hosted server:

```bash
claude mcp add --transport http vaaya https://vaaya.ai/mcp
```

Claude Desktop, or a local stdio server:

```bash
npx @vaaya/mcp install
```

Plugin route inside a Claude Code session:

```text
/plugin marketplace add vaaya-ai/vaaya-mcp
/plugin install vaaya@vaaya
```

Walkthrough with a first paid call and a refusal:
https://vaaya.ai/blog/claude-mcp-payments
