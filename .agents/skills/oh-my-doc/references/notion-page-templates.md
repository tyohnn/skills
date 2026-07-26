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
			<mention-page url="{{pages.home}}"/>
			<mention-page url="{{pages.vision}}"/>
			<mention-page url="{{pages.starting}}"/>
			<mention-page url="{{pages.workflow}}"/>
			<mention-page url="{{pages.domain}}"/>
			<mention-page url="{{pages.planning}}"/>
			<mention-page url="{{pages.spec}}"/> {color="yellow_bg"}
				<mention-page url="{{pages.data-model}}"/>
				<mention-page url="{{pages.system-model}}"/>
				<mention-page url="{{pages.cli}}"/>
			<mention-page url="{{pages.prds}}"/>
			<mention-page url="{{pages.plans}}"/>
			<mention-page url="{{pages.adrs}}"/>
		</callout>
	</column>
	<column ratio="80">
		# Spec
		Observable contracts for data model, system model, and CLI.
	</column>
</columns>
<page url="{{pages.data-model}}">Data model</page>
<page url="{{pages.system-model}}">System model</page>
<page url="{{pages.cli}}">CLI</page>
```

## Catalog page (inline DB preserved)

```markdown
<columns>
	...sidebar...
</columns>
<database url="{{dbs.prds}}" inline="true">PRDs</database>
```

## Home sources toggle

Canonical strategy (`home-details-toggle`): the user-supplied URL **is** Home
(`pages.home`). On Home, render a `<details>` toggle titled **데이터 원본** and
nest top-level managed pages inside it. Do not create a separate sources page.

```markdown
<columns>
	...sidebar...
</columns>
<details>
<summary>데이터 원본</summary>
<page url="{{pages.vision}}">Vision</page>
<page url="{{pages.starting}}">Start here</page>
<!-- …other top-level pages… -->
</details>
```
