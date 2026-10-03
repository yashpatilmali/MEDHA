import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

import { api, handleUnauthorized } from '@/api/client';
import { API_URL } from '@/api/config';
import { TREND_MINUTES } from '@/constants/monitor';
import { DEMO_MODE, demoSnapshot } from '@/constants/demo';
import type { HistoryPoint, Snapshot } from '@/types/monitoring';

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

/**
 * Live readings for the logged-in patient over Socket.IO. The backend sends the latest reading on
 * connect and every new one after that; the chart starts from recent history.
 */
export function useLiveMonitoring(token: string) {
  const [connection, setConnection] = useState<Connection>(DEMO_MODE ? 'connected' : 'connecting');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(() =>
    DEMO_MODE ? demoSnapshot() : null
  );
  const [trend, setTrend] = useState<TrendPoint[]>(() => {
    if (!DEMO_MODE) return [];
    const initial = demoSnapshot();
    return [{ time: Date.parse(initial.receivedAt), pressure: initial.reading.pressure }];
  });

  useEffect(() => {
    let active = true;

    if (DEMO_MODE) {
      const interval = setInterval(() => {
        if (!active) return;
        const next = demoSnapshot();
        setSnapshot(next);
        setTrend((points) => appendPoint(points, next));
      }, 2500);
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
    socket.on('reading', (next: Snapshot) => {
      setSnapshot(next);
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

  return { connection, snapshot, trend };
}
