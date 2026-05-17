import { Model } from "@nozbe/watermelondb";

export class BusinessModel extends Model {
  static override table = "businesses";
}

export class StaffMemberModel extends Model {
  static override table = "staff_members";
}

export class OutboxModel extends Model {
  static override table = "outbox";
}

export class SyncMetadataModel extends Model {
  static override table = "sync_metadata";
}
