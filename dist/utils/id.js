import { randomUUID } from "node:crypto";
export function makeId() { return randomUUID().replace(/-/g, "").slice(0, 16); }
