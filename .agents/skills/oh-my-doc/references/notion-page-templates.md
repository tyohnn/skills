# Notion page body templates

Notion-flavored Markdown with placeholders. Substitute from state mappings
after pages exist. Do not use Notion HTML export as input.

Runtime builds final bodies with `renderSidebarPageContent` for every managed
page.

## Shared sidebar (active Spec example)

```markdown
<columns>
	<column ratio="20">
		<callout icon="📌" color="gray_bg">
			- <mention-page url="{{pages.home}}"/>
			- <mention-page url="{{pages.vision}}"/>
			- <mention-page url="{{pages.starting}}"/>
			<details>
			<summary><mention-page url="{{pages.workflow}}"/></summary>
				- <mention-page url="{{pages.workflow-planning}}"/>
				- <mention-page url="{{pages.development}}"/>
			</details>
			<details>
			<summary><mention-page url="{{pages.domain}}"/></summary>
				- <mention-page url="{{pages.glossary}}"/>
				- <mention-page url="{{pages.models}}"/>
				- <mention-page url="{{pages.policies}}"/>
			</details>
			<details>
			<summary><mention-page url="{{pages.planning}}"/></summary>
				- <mention-page url="{{pages.prds}}"/>
				- <mention-page url="{{pages.stories}}"/>
			</details>
			<details>
			<summary><mention-page url="{{pages.spec}}"/> {color="yellow_bg"}</summary>
				- <mention-page url="{{pages.data-model}}"/>
				- <mention-page url="{{pages.system-model}}"/>
			</details>
			- <mention-page url="{{pages.plans}}"/>
			- <mention-page url="{{pages.adrs}}"/>
		</callout>
	</column>
	<column ratio="80">
		# Spec
		Observable contracts for data model and system model.
		<page url="{{pages.data-model}}">Data model</page>
		<page url="{{pages.system-model}}">System model</page>
	</column>
</columns>
```

All body copy and child `<page>` / `<database>` / sources blocks must live in the
right column so the sidebar pushes content rightward. Do not place them after
`</columns>`.

Parents with children always use `<details>` so those children can be collapsed.
When a nested child is current (for example Data model), that child bullet also
gets `{color="yellow_bg"}` while the Spec summary stays yellow.
## Catalog page (inline DB preserved)

```markdown
<columns>
	...sidebar...
	<column ratio="80">
		# PRDs
		...
		<database url="{{dbs.prds}}" inline="true">PRDs</database>
	</column>
</columns>
```
## Root sources toggle

Canonical strategy (`details-toggle-on-home`): the supplied Notion root **is**
Home (`pages.home`). Write a `<details>` block titled **데이터 원본** on Home and
parent managed top-level pages under Home so they appear inside that toggle.
Do **not** create a child page titled 데이터 원본.
