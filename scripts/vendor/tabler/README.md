# Tabler Core 1.6.1 vendored CSS

This folder contains genuine compiled Tabler CSS, not a reimplementation.

- Package: `@tabler/core@1.6.1`.
- Upstream release: 2026-09-28, https://github.com/tabler/tabler/releases/tag/%40tabler/core%401.6.1
- Official package metadata: https://github.com/tabler/tabler/blob/%40tabler%2Fcore%401.6.1/core/package.json
- Local filename: `tabler.min.css` (635,351 bytes).
- Local SHA-256: `e049eec3a5830530d80ff78676412c7e68f64b02bc9859cb0ca1710d24a60c58`.
- Latest stable audited on 2026-11-24: `@tabler/core@1.7.5`; this local asset is deliberately labelled 1.6.1.
- Upstream source: https://github.com/tabler/tabler/tree/%40tabler%2Fcore%401.6.1
- Upstream license: https://github.com/tabler/tabler/blob/%40tabler%2Fcore%401.6.1/LICENSE
- Retrieval source: https://github.com/PS-PhinIT/365CMS.DE/blob/12701b8dd64f84f55fb8dd1474ad169b2f621cd0/CMS/assets/tabler/css/tabler.min.css
- Retrieval repository commit: `12701b8dd64f84f55fb8dd1474ad169b2f621cd0`.
- Retrieved CSS Git blob SHA-1: `47d64596d2785dba5b1dbe254b9dd39597274bff`.
- Mirror documentation: https://github.com/PS-PhinIT/365CMS.DE/blob/12701b8dd64f84f55fb8dd1474ad169b2f621cd0/DOC/assets/tabler/README.md
- The mirror documentation states that the CSS is copied from the npm package and that only the final sourceMappingURL comment was removed. Independent byte comparison with the npm tarball was not possible because the npm registry was denied in this environment.
- Retrieval method: GitHub connector, UTF-8, preserving the original license banner and file contents.
- CSS inspected: no external `@import`, no external `url(...)`; the 23 url() values are inline data SVGs. This CSS can be served locally without CDN/font/network dependency.
- The local Git blob hash equals the immutable retrieval source's blob hash. No content was rewritten during retrieval.
- Product override audit: no `365CMS`, `PHINIT`, `admin-tabler`, `CMS/assets`, or other mirror product markers were found. The stylesheet's final compatibility rules match upstream `core/scss/_deprecated.scss` at the 1.6.1 tag. The mirror keeps its own styles separately in `CMS/assets/css/admin-tabler.css`; that file is not included here. This corroborates the mirror's documented upstream-copy provenance, but does not replace a byte comparison with the inaccessible npm tarball.
- Mirror asset update commit: https://github.com/PS-PhinIT/365CMS.DE/commit/970cac1a766952ea4699a61dc293c822697d1245 (2026-10-04), explicitly identifies Tabler 1.6.1 and removal of sourceMappingURL only.
- No Tabler JavaScript, ApexCharts, Bootstrap JS, fonts, icons, plugins, or demo files were copied.
- Existing business logic and chart rendering should be kept. This is a CSS-only integration candidate.
- Keep this LICENSE file and the original CSS copyright banner on distribution.

## Integration

Place the CSS before the project's own adapter stylesheet. Use real Tabler classes such as `.page`, `.navbar.navbar-vertical.navbar-expand-lg`, `.page-wrapper`, `.page-header`, `.page-body`, `.card`, `.card-header`, `.card-body`, `.table.table-sm.table-vcenter`, `.table-responsive`, `.form-control`, `.form-select`, and `.btn`.

Keep all existing data-binding IDs, CSV/JSON fetch paths, chart functions, event handlers, and daily automation. Use existing native JavaScript for interactions unless a specific Tabler JS component is intentionally added.

Use CSS custom properties prefixed with `--tblr-`. Do not load a second Bootstrap stylesheet.

For a vertical shell, set `data-bs-navbar-position="vertical"` on `<html>`. Put `aside.navbar.navbar-vertical.navbar-expand-lg` before its sibling `.page-wrapper` within `.page`; the generated sidebar margin relies on this sibling relationship. Default `--tblr-sidebar-width` is `16rem`; override it in the project adapter if needed. The desktop breakpoint for `navbar-expand-lg` is 992 px.

Use `--tblr-font-sans-serif` and `--tblr-body-font-family` to supply a Chinese system font stack. Financial tables should retain horizontal scrolling, explicit number alignment, and their own sorting/filtering logic; `.table-sm` changes density but does not implement data-grid behavior.

## Provenance limitation

The full v1.7.5 official GitHub source was checked, but neither committed `dist/` files nor compiled release assets are provided. The environment cannot obtain the official npm tarball, and no compatible Dart Sass compiler is installed. Therefore no claim is made that this is the latest release, or that it was rebuilt locally. It is the pinned v1.6.1 upstream build supplied by the documented open-source mirror above.
