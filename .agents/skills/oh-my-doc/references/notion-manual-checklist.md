# Notion manual checklist

Operations the API / MCP adapter cannot perform. Complete after provisioning.

## Page Full width

Notion page **Full width** is a host UI toggle (`⋯` → Full width). It is not
available through MCP.

After `adopt --ssot notion` succeeds:

1. Open the handbook root (Home) in Notion.
2. Open `⋯` → enable **Full width**.

Only Home needs this for the stacked-on-home layout. Do not treat Full width
as a failure of the content port when missing.

## Migrating `OMD ID` to UNIQUE_ID

Notion cannot convert `rich_text` → `UNIQUE_ID` in place. Always:

1. `DROP COLUMN "OMD ID"`
2. Then `ADD COLUMN "OMD ID" UNIQUE_ID PREFIX '…'`

Do not combine DROP+ADD in one statements batch (Notion may try an
in-place conversion). Prefixes must be workspace-unique.
