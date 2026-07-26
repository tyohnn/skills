# Notion manual checklist

Operations the API / MCP adapter cannot perform. Complete after provisioning.

## Page Full width

Notion page **Full width** is a host UI toggle (`⋯` → Full width). It is not
available through MCP.

After `adopt --ssot notion` succeeds:

1. Open the handbook root page in Notion.
2. Open `⋯` → enable **Full width**.
3. Repeat for managed content pages if the workspace does not inherit the
   setting (verify Home, Vision, Start here, Workflow, Domain, Planning, Spec,
   Plans, ADRs, and nested catalog pages).

Do not treat Full width as a failure of the content port when missing.
