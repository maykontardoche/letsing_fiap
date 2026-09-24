# Code Standards Reference

Padrões agnósticos. As regras de stack do LetsSign (naming, proibidos, gates de isolamento,
auditoria, rotas, UI) estão em `.claude/stack-profile.md` e **prevalecem** quando divergem
destes.

## Naming Conventions
- **camelCase**: methods, functions, variables
- **PascalCase**: classes, interfaces, React components
- **kebab-case**: files, directories (no SPA, componentes e páginas em `PascalCase.tsx`)
- **UPPER_SNAKE_CASE**: constants

## Code Rules
- Docs, UI e comentários em pt-BR; identificadores de domínio em português (ver o profile)
- No abbreviations, no names over 30 characters
- No magic numbers — use named constants
- Functions start with a verb, perform single clear action
- Maximum 3 parameters per function (use objects for more)
- Functions do mutation OR query, never both
- Maximum 2 nesting levels for conditionals, prefer early returns
- Never use boolean flag parameters to toggle behavior
- Maximum 50 lines per method
- Maximum 300 lines per class
- Formatting is Prettier's; blank lines only to separate logical blocks
- Comments only to explain *why* — code should be self-explanatory about *what*
- One variable per line, declare close to usage
