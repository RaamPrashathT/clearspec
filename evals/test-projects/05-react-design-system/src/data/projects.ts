import type { Status } from "../components/ui/StatusBadge";

export type Project = { id: string; name: string; client: string; owner: string; status: Status; due: string };

export const projects: Project[] = [
  { id: "p-104", name: "Spring catalogue", client: "Harbor & Pine", owner: "Dana Okafor", status: "active", due: "2026-12-12" },
  { id: "p-109", name: "Website refresh", client: "Mill Street Bakery", owner: "Luis Ferreira", status: "paused", due: "2027-01-20" },
  { id: "p-111", name: "Annual report", client: "Brightwater Trust", owner: "Dana Okafor", status: "done", due: "2026-10-30" },
];
