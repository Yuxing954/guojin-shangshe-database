# Tabler 1.7.5 vendored assets and official template references

## Ready-to-copy assets

- `tabler.min.css`: 683,730 bytes, Tabler v1.7.5, default official palette and layout styles.
- `tabler.min.js`: 151,907 bytes, Tabler v1.7.5, includes Bootstrap JavaScript and Popper. Do not load a second Bootstrap bundle.
- `LICENSE`: unmodified Tabler MIT license from the official release.

CSS has no non-data asset URLs. The final sourceMappingURL comments refer to optional developer source maps, which are not included here.

## Official source

- Repository: https://github.com/tabler/tabler
- Release: https://github.com/tabler/tabler/releases/tag/%40tabler/core%401.7.5
- Exact official release commit: `4257ebcd1cd5494f71b84c485fd15749fc6d5f92`
- npm package: `@tabler/core@1.7.5`
- Official npm tarball URL: https://registry.npmjs.org/@tabler/core/-/core-1.7.5.tgz

The `official-source/` directory contains selected original Astro templates, design variables and package metadata from the previously downloaded official source. Every copied file was verified against the exact Git blob SHA returned for this release by the GitHub connector; see `official-reference-manifest.json`.

## How compiled files were obtained

Direct npm, CDN and official preview downloads are denied by this environment's network policy. Installing the compiler dependencies through the Sites helper is also denied. These files were therefore retrieved through the GitHub connector from an existing, explicitly documented unchanged vendored copy of the official npm package:

https://github.com/simtabi/dbpantry/tree/main/src/internal/dashboard/resources/assets

That repository's README names Tabler 1.7.5, states both files were copied unchanged from the official npm tarball, and records these exact SHA256 values. Both local files match those hashes and their Git blob SHA1 identifiers:

| File | SHA256 | Git blob SHA1 |
| --- | --- | --- |
| tabler.min.css | d1708c69e6b07a5a3138b8549bf64e00cd9d18c130b9b2ba2d9e294956f7c564 | 2962c77a34f77a16d0d3311b2497d432f7754f3d |
| tabler.min.js | f63744ad8e12180089844d0e550c5b3abd66eda0e52dead2eb31eef017148e93 | a0d05b4d33d58ce3210329c210681ae226767c96 |

An independent second vendored copy was retrieved from `lutece-platform/lutece-core`, paths `webapp/themes/admin/tabler/css/vendor/tabler.min.css` and `webapp/themes/admin/tabler/js/vendor/tabler.min.js`. Both files are byte-for-byte equivalent after removing the optional sourceMappingURL comments. This verifies agreement between two independent mirrors; it is not a fresh direct npm-registry hash verification.

JavaScript syntax was validated using `node --check tabler.min.js`. Required navbar, container, page, card, table, form, dropdown and pagination classes were confirmed in the CSS. No modifications to the compiled CSS or JavaScript were made.

## Primary template references

- `official-source/shared/layouts/DefaultLayout.astro`: page, page-wrapper, page-header, page-body and container-xl structure.
- `official-source/shared/components/navbar/Navbar.astro`: original default two-row horizontal navbar.
- `official-source/shared/components/layout/PageHeader.astro`: title, pretitle and right-aligned actions.
- `official-source/shared/components/HomepageContent.astro`: original dashboard card grid.
- `official-source/shared/components/cards/Invoices.astro`: searchable table and pagination.
- `official-source/shared/components/cards/MostVisitedPages.astro`: compact card table.
- `official-source/shared/components/cards/charts/Revenue.astro`: compact metric card.

Use these native classes without loading previous application-wide CSS overrides. Replace demo labels and data with the retained database taxonomy and records.
