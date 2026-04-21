"use client";

import { useEffect, useRef } from "react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { joinCode } from "@/lib/questions";
import type { SessionPayload } from "@/lib/types";

type UseSessionSyncOptions = {
  enabled?: boolean;
  fetchPath: string;
  onData: (payload: SessionPayload) => void;
  onError: (message: string) => void;
};

function getRealtimeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function useSessionSync({
  enabled = true,
  fetchPath,
  onData,
  onError
}: UseSessionSyncOptions) {
  const pollingRef = useRef(false);
  const realtimeClientRef = useRef<SupabaseClient | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onDataRef = useRef(onData);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;
    let timeoutId: number | null = null;
    const realtimeClient = getRealtimeClient();
    realtimeClientRef.current = realtimeClient;

    const load = async () => {
      if (!active || pollingRef.current) {
        return;
      }

      pollingRef.current = true;

      try {
        const response = await fetch(fetchPath, { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "No se pudo sincronizar la sesion.");
        }

        if (active) {
          onDataRef.current(data);
        }
      } catch (error) {
        if (active) {
          onErrorRef.current(
            error instanceof Error ? error.message : "No se pudo sincronizar la sesion."
          );
        }
      } finally {
        pollingRef.current = false;
      }
    };

    const scheduleLoad = (delayMs: number) => {
      if (!active) {
        return;
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        void load();
        scheduleLoad(realtimeClient ? 2500 : 700);
      }, delayMs);
    };

    const syncNow = () => {
      void load();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncNow();
      }
    };

    window.addEventListener("focus", syncNow);
    window.addEventListener("pageshow", syncNow);
    window.addEventListener("online", syncNow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    void load();
    scheduleLoad(realtimeClient ? 2500 : 700);

    if (realtimeClient) {
      const channel = realtimeClient
        .channel(`quiz-session-${joinCode}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "quiz_sessions",
            filter: `code=eq.${joinCode}`
          },
          syncNow
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "quiz_participants",
            filter: `session_code=eq.${joinCode}`
          },
          syncNow
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "quiz_responses",
            filter: `session_code=eq.${joinCode}`
          },
          syncNow
        )
        .subscribe();

      channelRef.current = channel;
    }

    return () => {
      active = false;

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      window.removeEventListener("focus", syncNow);
      window.removeEventListener("pageshow", syncNow);
      window.removeEventListener("online", syncNow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (channelRef.current && realtimeClientRef.current) {
        void realtimeClientRef.current.removeChannel(channelRef.current);
      }

      channelRef.current = null;
      realtimeClientRef.current = null;
    };
  }, [enabled, fetchPath]);
}
