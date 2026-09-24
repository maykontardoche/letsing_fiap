# Playwright MCP Tools Reference

Opcional — só para o QA de `apps/web`. Endereços locais: SPA em http://localhost:5190,
API em http://localhost:3020/api, caixa de entrada do Mailpit em http://localhost:8035
(convites de assinatura e códigos de verificação por e-mail).

| Tool | Usage |
|------|-------|
| `browser_navigate` | Navigate to application pages |
| `browser_snapshot` | Capture accessible page state (preferred over screenshot for analysis) |
| `browser_click` | Interact with buttons, links, and clickable elements |
| `browser_type` | Fill form fields |
| `browser_fill_form` | Fill multiple fields at once |
| `browser_select_option` | Select options in dropdowns |
| `browser_press_key` | Simulate keys (Enter, Tab, etc.) |
| `browser_take_screenshot` | Capture visual evidence |
| `browser_console_messages` | Check browser console for errors |
| `browser_network_requests` | Verify API calls |
