import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

import { api, handleUnauthorized } from '@/api/client';
import { API_URL } from '@/api/config';
import { TREND_MINUTES } from '@/constants/monitor';
import {
  DEMO_MODE,
  DEMO_SESSION_OFF,
  demoSnapshot,
  demoStatus,
  type DemoSession,
} from '@/constants/demo';
import type { PatchPosition } from '@/constants/positions';
import type { HistoryPoint, PatchStatus, Snapshot } from '@/types/monitoring';

export type Connection = 'connecting' | 'connected' | 'disconnected';

export type TrendPoint = { time: number; pressure: number };

const TREND_WINDOW_MS = TREND_MINUTES * 60 * 1000;

/** Adds a live reading to the chart, dropping points that have scrolled out of the window. */
function appendPoint(points: TrendPoint[], snapshot: Snapshot) {
  const time = Date.parse(snapshot.receivedAt);
  return [
    ...points.filter((point) => point.time < time && point.time >= time - TREND_WINDOW_MS),
    { time, pressure: snapshot.reading.pressure },
  ];
}

/** Puts saved history in front of the live points that arrived while it was loading. */
function mergeHistory(history: HistoryPoint[], live: TrendPoint[]) {
  const firstLive = live[0]?.time ?? Infinity;
  const earlier = history
    .map((point) => ({ time: Date.parse(point.at), pressure: point.pressure }))
    .filter((point) => point.time < firstLive);
  return [...earlier, ...live];
}

/** A new status replaces the snapshot's; a risk only stands while the baseline it used does. */
function withStatus(snapshot: Snapshot | null, status: PatchStatus): Snapshot | null {
  if (!snapshot) return null;
  return {
    ...snapshot,
    ...status,
    risk: status.calibration.status === 'complete' ? snapshot.risk : null,
  };
}

/**
 * Live readings and patch status for the logged-in patient over Socket.IO. The backend sends the
 * status and latest reading on connect and every change after that; the chart starts from recent
 * history. In demo mode a pretend patch responds to the same buttons.
 */
export function useLiveMonitoring(token: string) {
  const [connection, setConnection] = useState<Connection>(DEMO_MODE ? 'connected' : 'connecting');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<PatchStatus | null>(() =>
    DEMO_MODE ? demoStatus(Date.now(), DEMO_SESSION_OFF) : null
  );
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  // Demo mode only: what has been pressed.
  const demoSession = useRef<DemoSession>(DEMO_SESSION_OFF);

  useEffect(() => {
    let active = true;

    if (DEMO_MODE) {
      const interval = setInterval(() => {
        if (!active) return;
        const now = Date.now();
        setStatus(demoStatus(now, demoSession.current));
        const next = demoSnapshot(now, demoSession.current);
        if (next) {
          setSnapshot(next);
          setTrend((points) => appendPoint(points, next));
        }
      }, 1000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }

    const socket = io(API_URL, { auth: { token }, transports: ['websocket'] });

    socket.on('connect', () => setConnection('connected'));
    socket.on('disconnect', () => setConnection('disconnected'));
    socket.on('connect_error', (error) => {
      setConnection('disconnected');
      if (error.message === 'unauthorized') {
        handleUnauthorized();
      }
    });
    socket.on('status', (next: PatchStatus) => {
      if (!next?.device || !next.calibration) return;
      setStatus(next);
      setSnapshot((current) => withStatus(current, next));
    });
    socket.on('reading', (next: Snapshot) => {
      setSnapshot(next);
      // A backend older than the patch controls sends readings without the device status.
      if (next.device && next.calibration) {
        setStatus({ device: next.device, calibration: next.calibration });
      }
      setTrend((points) => appendPoint(points, next));
    });

    api
      .history(TREND_MINUTES)
      .then(({ readings }) => {
        if (active) setTrend((live) => mergeHistory(readings, live));
      })
      .catch(() => {});

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [token]);

  /** Sends a patch command; in demo mode, updates the pretend patch instead. */
  async function command(
    request: () => Promise<PatchStatus>,
    demo: (session: DemoSession, now: number) => DemoSession
  ) {
    if (DEMO_MODE) {
      const now = Date.now();
      demoSession.current = demo(demoSession.current, now);
      const next = demoStatus(now, demoSession.current);
      setStatus(next);
      setSnapshot((current) => withStatus(current, next));
      return;
    }
    const next = await request();
    setStatus(next);
    setSnapshot((current) => withStatus(current, next));
  }

  /** Switches the patch's sensors on. */
  const activate = () =>
    command(api.activate, (session, now) => ({
      ...session,
      activatedAt: session.activatedAt ?? now,
    }));

  /** Records the patient's position, which says where the patch was placed. */
  const choosePosition = (position: PatchPosition) =>
    command(
      () => api.setPosition(position),
      (session) => ({ ...session, position })
    );

  /** Switches the sensors off and ends the wear session. */
  const deactivate = () =>
    command(api.deactivate, (session, now) => ({
      ...DEMO_SESSION_OFF,
      lastWear:
        session.wearStartedAt === null
          ? session.lastWear
          : { startedAt: session.wearStartedAt, endedAt: now },
    }));

  /** Scans the initial readings: the next minute of readings becomes the baseline. */
  const scan = () =>
    command(api.startCalibration, (session, now) => ({
      ...session,
      scanStartedAt: now,
      wearStartedAt: session.wearStartedAt ?? now,
    }));

  return { connection, snapshot, status, trend, activate, choosePosition, deactivate, scan };
}
