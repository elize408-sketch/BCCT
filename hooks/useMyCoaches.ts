import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type CoachProfile = {
  coach_client_id: string;
  coach_id: string;
  status: string;
  started_at: string | null;
  org_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export function useMyCoaches() {
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        // Get current session directly from supabase
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        console.log('[useMyCoaches] userId from session:', userId);

        if (!userId) {
          console.log('[useMyCoaches] No userId, aborting');
          if (!cancelled) setLoading(false);
          return;
        }

        const { data: links, error: linksError } = await supabase
          .from('coach_clients')
          .select('id, coach_id, client_id, org_id, status, started_at')
          .eq('client_id', userId)
          .eq('status', 'active');

        console.log('[useMyCoaches] links:', JSON.stringify(links), 'error:', linksError);

        if (linksError) throw linksError;
        if (!links || links.length === 0) {
          if (!cancelled) { setCoaches([]); setLoading(false); }
          return;
        }

        const coachIds = links.map((l: any) => l.coach_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', coachIds);

        console.log('[useMyCoaches] profiles:', JSON.stringify(profiles), 'error:', profilesError);

        if (profilesError) throw profilesError;

        const merged: CoachProfile[] = links.map((link: any) => {
          const profile = (profiles ?? []).find((p: any) => p.id === link.coach_id);
          return {
            coach_client_id: link.id,
            coach_id: link.coach_id,
            status: link.status,
            started_at: link.started_at ?? null,
            org_id: link.org_id ?? null,
            full_name: profile?.full_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
          };
        });

        console.log('[useMyCoaches] merged:', JSON.stringify(merged));
        if (!cancelled) setCoaches(merged);
      } catch (err: any) {
        console.error('[useMyCoaches] error:', err);
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  return { coaches, loading, error };
}
