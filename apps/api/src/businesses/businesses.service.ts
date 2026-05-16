import { Injectable } from "@nestjs/common";
import { businesses, type Business } from "@quickarte/db-schema";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class BusinessesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findCurrent(businessId: string): Promise<Business | undefined> {
    return this.databaseService.withTenant(businessId, (tx) =>
      tx.query.businesses.findFirst({
        where: eq(businesses.id, businessId),
      }),
    );
  }
}
