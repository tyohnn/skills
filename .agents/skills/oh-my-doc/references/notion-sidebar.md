# Notion sidebar chrome

Every managed content page uses the same two-column chrome. Provision must write
this chrome for **all** `pages.*` keys — not only Home/Spec.

1. Left column (`ratio="20"`): callout containing the shared nav mentions.
2. Right column (`ratio="80"`): **all** page body copy plus preserved child
   `<page>` / `<database>` / sources `<details>` blocks.

Nothing except the columns wrapper may sit after `</columns>`. Putting child
blocks below the columns leaves them full-bleed; they must move into the right
column so the sidebar shifts content rightward.

## Active highlight

Leaf top-level items are **bulleted mentions**. Emit highlight in the form Notion
round-trips (suffix, not prefix):

```markdown
- <mention-page url="{{pages.vision}}"/> {color="yellow_bg"}
```

## Details toggle groups

Parents that have nested children wrap those children in a `<details>` toggle.
The parent mention lives in `<summary>` so users can collapse/hide the children.

```markdown
<details>
<summary><mention-page url="{{pages.spec}}"/> {color="yellow_bg"}</summary>
	- <mention-page url="{{pages.data-model}}"/>
	- <mention-page url="{{pages.system-model}}"/>
</details>
```

When the section or one of its children is current, the summary keeps
`yellow_bg`. The active nested leaf also gets `yellow_bg`.

| Parent | Nested children inside details |
|---|---|
| Workflow | Workflow Planning, Development |
| Domain | Glossary, Models, Policies |
| Planning | PRDs, Stories |
| Spec | Data model, System model |

Every such parent always emits its details group (not only when active), so the
toggle remains available for hiding children on every page.

## Top-level nav

Home · Vision · Start here · Workflow · Domain · Planning · Spec · Plans · ADRs

PRDs stay under Planning only — not repeated at the root.

## Child preservation

`replace_content` must re-emit existing child `<page>` and `<database inline>`
blocks after the columns. Omitting them deletes children or fails validation.

## Machine validation

Runtime helpers:

- `renderSidebarPageContent` — emit chrome
- `validateSidebarChrome` — assert columns, callout, yellow active group,
  details toggles for every parent with children
- `validateManifestSidebarChrome` — run over all `write_page_body` ops

`planProvision` and `omd check` (notion) fail when chrome validation fails.

Runtime path: `runtime/content-sources/sidebar.mjs`.
