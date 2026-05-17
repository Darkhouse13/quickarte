import { appSchema, tableSchema } from "@nozbe/watermelondb";

export const posSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: "businesses",
      columns: [
        { name: "name", type: "string" },
        { name: "slug", type: "string" },
        { name: "locale", type: "string" },
        { name: "currency", type: "string" },
        { name: "timezone", type: "string" },
        { name: "last_synced_at", type: "number", isOptional: true },
      ],
    }),
    tableSchema({
      name: "staff_members",
      columns: [
        { name: "business_id", type: "string", isIndexed: true },
        { name: "display_name", type: "string" },
        { name: "role", type: "string" },
        { name: "last_synced_at", type: "number", isOptional: true },
      ],
    }),
    tableSchema({
      name: "outbox",
      columns: [
        { name: "entity_type", type: "string", isIndexed: true },
        { name: "entity_id", type: "string" },
        { name: "operation", type: "string" },
        { name: "payload_json", type: "string" },
        { name: "created_at", type: "number" },
        { name: "retries", type: "number" },
      ],
    }),
    tableSchema({
      name: "sync_metadata",
      columns: [
        { name: "key", type: "string", isIndexed: true },
        { name: "value", type: "string" },
      ],
    }),
  ],
});
