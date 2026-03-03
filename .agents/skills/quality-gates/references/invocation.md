User: "Commit my changes"

Agent:

1. Run `bun run typecheck:all` → Pass
2. Run `bun test` → Pass (92% coverage)
3. Run `bun run lint` → Pass
4. Run `bun run format:check` → Fail

Found formatting issues. Running `bun run format` to fix...
Re-running `bun run format:check` → Pass

All gates passed. Dispatching code-review sub-agent...
Review complete. Proceeding with commit.
