import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { ApiError, validationError } from "@/lib/http/errors";
import {
  isNonEmptyString,
  isOptionalString,
  isValidAppVersion,
  isValidPlatform,
  isValidPushEnvironment,
  type Platform,
} from "@/server/validation";
import { revokeSessionsForDevice } from "@/server/auth/sessions";

/**
 * Device registry (§11 of the brief). `installation_id` is the client's own
 * stable identifier (never Apple's IDFV/IDFA) — registering the same one
 * twice for the same user updates the existing row instead of creating a
 * duplicate, so re-installing the app or re-registering on token refresh is
 * idempotent by construction.
 */

export interface DeviceRow {
  id: string;
  user_id: string;
  installation_id: string;
  platform: string;
  device_name: string | null;
  system_version: string | null;
  app_version: string | null;
  push_token: string | null;
  push_environment: string | null;
  last_seen_at: string;
  created_at: string;
  revoked_at: string | null;
}

export interface DeviceDto {
  id: string;
  platform: string;
  deviceName: string | null;
  systemVersion: string | null;
  appVersion: string | null;
  pushEnabled: boolean;
  lastSeenAt: string;
  createdAt: string;
}

function serialize(row: DeviceRow): DeviceDto {
  return {
    id: row.id,
    platform: row.platform,
    deviceName: row.device_name,
    systemVersion: row.system_version,
    appVersion: row.app_version,
    pushEnabled: !!row.push_token,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  };
}

const MAX_INSTALLATION_ID_LENGTH = 128;
const MAX_DEVICE_NAME_LENGTH = 120;
const MAX_SYSTEM_VERSION_LENGTH = 32;
const MAX_PUSH_TOKEN_LENGTH = 512;

export interface RegisterDeviceParams {
  installationId: string;
  platform: Platform;
  deviceName?: string;
  systemVersion?: string;
  appVersion?: string;
  pushToken?: string;
  pushEnvironment?: string;
}

function validateDeviceFields(params: {
  deviceName?: string;
  systemVersion?: string;
  appVersion?: string;
  pushToken?: string;
  pushEnvironment?: string;
}): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!isOptionalString(params.deviceName, MAX_DEVICE_NAME_LENGTH)) fields.deviceName = "Nazwa urządzenia jest za długa.";
  if (!isOptionalString(params.systemVersion, MAX_SYSTEM_VERSION_LENGTH)) {
    fields.systemVersion = "Nieprawidłowa wersja systemu.";
  }
  if (params.appVersion !== undefined && !isValidAppVersion(params.appVersion)) {
    fields.appVersion = "Nieprawidłowa wersja aplikacji.";
  }
  if (!isOptionalString(params.pushToken, MAX_PUSH_TOKEN_LENGTH)) fields.pushToken = "Nieprawidłowy token push.";
  if (params.pushEnvironment !== undefined && !isValidPushEnvironment(params.pushEnvironment)) {
    fields.pushEnvironment = "Nieprawidłowe środowisko push.";
  }
  return fields;
}

export function registerDevice(userId: string, params: RegisterDeviceParams): DeviceDto {
  const fields = validateDeviceFields(params);
  if (!isNonEmptyString(params.installationId, MAX_INSTALLATION_ID_LENGTH)) {
    fields.installationId = "Wymagany prawidłowy installationId.";
  }
  if (!isValidPlatform(params.platform)) fields.platform = "Nieprawidłowa platforma.";
  if (Object.keys(fields).length > 0) throw validationError(fields);

  const db = getDb();
  const now = new Date().toISOString();
  const existing = db
    .prepare("SELECT * FROM devices WHERE user_id = ? AND installation_id = ?")
    .get(userId, params.installationId) as DeviceRow | undefined;

  if (existing) {
    db.prepare(
      `UPDATE devices SET platform = ?, device_name = ?, system_version = ?, app_version = ?, push_token = ?, push_environment = ?, last_seen_at = ?, revoked_at = NULL
       WHERE id = ?`
    ).run(
      params.platform,
      params.deviceName ?? existing.device_name,
      params.systemVersion ?? existing.system_version,
      params.appVersion ?? existing.app_version,
      params.pushToken ?? existing.push_token,
      params.pushEnvironment ?? existing.push_environment,
      now,
      existing.id
    );
    return serialize(db.prepare("SELECT * FROM devices WHERE id = ?").get(existing.id) as DeviceRow);
  }

  const id = randomBytes(12).toString("hex");
  db.prepare(
    `INSERT INTO devices (id, user_id, installation_id, platform, device_name, system_version, app_version, push_token, push_environment, last_seen_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    params.installationId,
    params.platform,
    params.deviceName ?? null,
    params.systemVersion ?? null,
    params.appVersion ?? null,
    params.pushToken ?? null,
    params.pushEnvironment ?? null,
    now,
    now
  );
  return serialize(db.prepare("SELECT * FROM devices WHERE id = ?").get(id) as DeviceRow);
}

export function listDevicesForUser(userId: string): DeviceDto[] {
  const rows = getDb()
    .prepare("SELECT * FROM devices WHERE user_id = ? AND revoked_at IS NULL ORDER BY last_seen_at DESC")
    .all(userId) as DeviceRow[];
  return rows.map(serialize);
}

export function getDeviceRowForUser(userId: string, deviceId: string): DeviceRow | null {
  const row = getDb().prepare("SELECT * FROM devices WHERE id = ? AND user_id = ?").get(deviceId, userId) as
    | DeviceRow
    | undefined;
  return row ?? null;
}

export interface UpdateCurrentDeviceParams {
  deviceName?: string;
  systemVersion?: string;
  appVersion?: string;
  pushToken?: string;
  pushEnvironment?: string;
}

/** "Current" device = the one bound to the caller's active session (`sessions.device_id`), never taken from client-supplied input. */
export function updateCurrentDevice(userId: string, deviceId: string, params: UpdateCurrentDeviceParams): DeviceDto {
  const existing = getDeviceRowForUser(userId, deviceId);
  if (!existing || existing.revoked_at) throw new ApiError("DEVICE_NOT_FOUND");

  const fields = validateDeviceFields(params);
  if (Object.keys(fields).length > 0) throw validationError(fields);

  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE devices SET device_name = ?, system_version = ?, app_version = ?, push_token = ?, push_environment = ?, last_seen_at = ?
       WHERE id = ?`
    )
    .run(
      params.deviceName ?? existing.device_name,
      params.systemVersion ?? existing.system_version,
      params.appVersion ?? existing.app_version,
      params.pushToken ?? existing.push_token,
      params.pushEnvironment ?? existing.push_environment,
      now,
      existing.id
    );

  return serialize(getDeviceRowForUser(userId, deviceId)!);
}

/** Revokes the device and, per §11, every session tied to it. */
export function deleteDevice(userId: string, deviceId: string): void {
  const existing = getDeviceRowForUser(userId, deviceId);
  if (!existing || existing.revoked_at) throw new ApiError("DEVICE_NOT_FOUND");
  getDb().prepare("UPDATE devices SET revoked_at = ? WHERE id = ?").run(new Date().toISOString(), existing.id);
  revokeSessionsForDevice(existing.id);
}

export interface SetPushTokenParams {
  pushToken: string;
  pushEnvironment: string;
}

/** §19 — push token is always attached to userId + deviceId + environment + platform (platform is already fixed on the device row). */
export function setDevicePushToken(userId: string, deviceId: string, params: SetPushTokenParams): DeviceDto {
  const existing = getDeviceRowForUser(userId, deviceId);
  if (!existing || existing.revoked_at) throw new ApiError("DEVICE_NOT_FOUND");

  const fields: Record<string, string> = {};
  if (!isNonEmptyString(params.pushToken, MAX_PUSH_TOKEN_LENGTH)) fields.pushToken = "Wymagany prawidłowy token push.";
  if (!isValidPushEnvironment(params.pushEnvironment)) fields.pushEnvironment = "Nieprawidłowe środowisko push.";
  if (Object.keys(fields).length > 0) throw validationError(fields);

  getDb()
    .prepare("UPDATE devices SET push_token = ?, push_environment = ?, last_seen_at = ? WHERE id = ?")
    .run(params.pushToken, params.pushEnvironment, new Date().toISOString(), existing.id);
  return serialize(getDeviceRowForUser(userId, deviceId)!);
}

export function clearPushTokenForDevice(userId: string, deviceId: string): void {
  const existing = getDeviceRowForUser(userId, deviceId);
  if (!existing) throw new ApiError("DEVICE_NOT_FOUND");
  getDb().prepare("UPDATE devices SET push_token = NULL, push_environment = NULL WHERE id = ?").run(existing.id);
}
