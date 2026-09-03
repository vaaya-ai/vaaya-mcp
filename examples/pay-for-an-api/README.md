# Pay for an API with a spend ceiling

One script, two calls to the same paid search. The first sets
`max_cost_cents` above the price and succeeds with a receipt. The second sets it
below the price and is refused before the provider is contacted, at no charge.

```bash
VAAYA_API_KEY=vaaya_sk_... node run.mjs
```

Get a key at https://vaaya.ai/api-keys. Every account starts with a welcome
credit, so the successful call costs about a cent from that.
