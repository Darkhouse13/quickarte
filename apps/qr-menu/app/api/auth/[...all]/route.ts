import { auth } from "@/lib/auth/server";
import { toNextJsHandler } from "better-auth/next-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const { POST, GET } = toNextJsHandler(auth);
