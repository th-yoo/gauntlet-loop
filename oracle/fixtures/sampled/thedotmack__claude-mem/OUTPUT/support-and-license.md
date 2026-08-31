# Claude-Mem — Support, License, Contributing

Extracted from the corresponding sections of the README.

## Bug Reports

Create comprehensive bug reports with the automated generator:

```bash
cd ~/.claude/plugins/marketplaces/thedotmack
npm run bug-report
```

## Contributing

Contributions are welcome:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Update documentation
5. Submit a Pull Request

Claude-Mem ships from three branches: `main` (stable), `core-dev`, and
`community-edge`. Only `main` is published to npm; the others are run from
source. See https://docs.claude-mem.ai/branches for the strategy and local
run instructions, and https://docs.claude-mem.ai/development for the
contribution workflow.

## License

Claude-Mem is licensed under the Apache License 2.0.

The README states Apache-2.0 was chosen because durable agentic memory
should be easy to embed in developer tools, local agents, MCP servers,
enterprise systems, robotics stacks, and production agent harnesses.

See the `LICENSE` file for full details, and `docs/license.md` and
`docs/ip-boundary.md` for licensing scope and the open/commercial boundary.

Note on Ragtime: the `ragtime/` directory is licensed under the Apache
License 2.0 separately (see `ragtime/LICENSE`).

## Support

- Documentation: `docs/`
- Issues: https://github.com/thedotmack/claude-mem/issues
- Repository: https://github.com/thedotmack/claude-mem
- Official X account: https://x.com/Claude_Memory (@Claude_Memory)
- Official Discord: https://discord.com/invite/J4wttp9vDu
- Author: Alex Newman (@thedotmack, https://github.com/thedotmack)

## Related token note (as stated in the README)

The README states there is a token called CMEM, created by a third party
but officially embraced by the creator of Claude-Mem (Alex Newman,
@thedotmack), described as a community catalyst for growth. The README
lists a BASE contract address: `0x76b1967eec0ccaeb001bbbb2b40dc4badba31ba3`.
This is reproduced here only because it appears in the source README; it is
not independently verified against any other source, per the instruction to
use only this artifact.
