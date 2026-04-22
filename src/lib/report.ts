// Local-only report storage
import { dbPut, dbGet, dbGetAll } from "./storage";

export type ReportCategory = "spam" | "harassment" | "child_safety" | "illegal" | "hate_speech";

export interface Report {
  id: string;
  reportedUserId: string;
  category: ReportCategory;
  timestamp: number;
}

export async function submitReport(reportedUserId: string, category: ReportCategory): Promise<void> {
  const report: Report = {
    id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    reportedUserId,
    category,
    timestamp: Date.now(),
  };
  await dbPut("settings", `report-${report.id}`, report);
  // Also auto-block the reported user
  await blockUser(reportedUserId);
}

export async function blockUser(userId: string): Promise<void> {
  const blocked = await getBlockedUsers();
  if (!blocked.includes(userId)) {
    blocked.push(userId);
    await dbPut("settings", "blocked-users", blocked);
  }
}

export async function unblockUser(userId: string): Promise<void> {
  const blocked = await getBlockedUsers();
  const filtered = blocked.filter((id) => id !== userId);
  await dbPut("settings", "blocked-users", filtered);
}

export async function getBlockedUsers(): Promise<string[]> {
  return (await dbGet<string[]>("settings", "blocked-users")) || [];
}

export async function isUserBlocked(userId: string): Promise<boolean> {
  const blocked = await getBlockedUsers();
  return blocked.includes(userId);
}
