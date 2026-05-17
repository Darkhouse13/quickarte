import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import { posMigrations } from "./migrations";
import {
  BusinessModel,
  OutboxModel,
  StaffMemberModel,
  SyncMetadataModel,
} from "./models";
import { posSchema } from "./schema";

const adapter = new SQLiteAdapter({
  dbName: "quickarte_pos_terminal",
  migrations: posMigrations,
  schema: posSchema,
});

export const database = new Database({
  adapter,
  modelClasses: [
    BusinessModel,
    StaffMemberModel,
    OutboxModel,
    SyncMetadataModel,
  ],
});
