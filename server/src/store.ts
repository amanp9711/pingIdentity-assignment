import fs from 'fs';
import path from 'path';
import { AccessRequest } from './types';

let requests: AccessRequest[] = [];

export function loadData(): void {
  const dataPath = process.env.DATA_PATH
    ? path.resolve(process.env.DATA_PATH)
    : path.resolve(process.cwd(), '..', 'data', 'requests.json');

  const raw = fs.readFileSync(dataPath, 'utf-8');
  requests = JSON.parse(raw) as AccessRequest[];
  console.log(`Loaded ${requests.length} requests from ${dataPath}`);
}

export function getAll(): AccessRequest[] {
  return requests;
}

export function getById(id: string): AccessRequest | undefined {
  return requests.find((r) => r.requestId === id);
}

export function update(updated: AccessRequest): void {
  const idx = requests.findIndex((r) => r.requestId === updated.requestId);
  if (idx !== -1) {
    requests[idx] = updated;
  }
}