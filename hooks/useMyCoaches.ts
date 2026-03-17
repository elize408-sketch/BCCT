import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type CoachProfile = {
  coach_client_id: string;
  coach_id: string;
  status: string;
  started_at: string | null;
  org_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  organization?: string | null;
};

export function useMyCoaches() {
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { user, session } = useAuth();
  const userId = user?.id ?? session?.user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      console.log('[useMyCoaches] No user ID available, skipping query');
      setLoading(false);
      setCoaches([]);
      return;
    }

    let cancelled = false;

    const fetchCoaches = async () => {
      console.log('[useMyCoaches] Fetching coaches for user:', userId);
      setLoading(true);
      setError(null);

      try {
        // Step 1: Get active coach_clients rows for this client
        const { data: links, error: linksError } = await supabase
          .from('coach_clients')
          .select('id, coach_id, client_id, org_id, status, started_at')
          .eq('client_id', userId)
          .eq('status', 'active');

        console.log('[useMyCoaches] coach_clients result:', links, linksError);

        if (linksError) throw new Error(linksError.message);

        if (!links || links.length === 0) {
          console.log('[useMyCoaches] No active coach links found');
          if (!cancelled) {
            setCoaches([]);
            setLoading(false);
          }
          return;
        }

        // Step 2: Fetch profiles for each coach_id
        const coachIds = links.map((l: { coach_id: string }) => l.coach_id);
        console.log('[useMyCoaches] Fetching profiles for coach IDs:', coachIds);

        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, organization')
          .in('id', coachIds);

        console.log('[useMyCoaches] profiles result:', profiles, profilesError);

        if (profilesError) throw new Error(profilesError.message);

        // Step 3: Merge
        const merged: CoachProfile[] = (links as {
          id: string;
          coach_id: string;
          client_id: string;
          org_id: string | null;
          status: string;
          started_at: string | null;
        }[]).map((link) => {
          const profile = (profiles ?? []).find((p: { id: string }) => p.id === link.coach_id);
          return {
            coach_client_id: link.id,
            coach_id: link.coach_id,
            status: link.status,
            started_at: link.started_at ?? null,
            org_id: link.org_id ?? null,
            full_name: profile?.full_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
            organization: profile?.organization ?? null,
          };
        });

        console.log('[useMyCoaches] Final merged coaches:', merged);

        if (!cancelled) {
          setCoaches(merged);
          setLoading(false);
        }
      } catch (err) {
        console.error('[useMyCoaches] Error:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setCoaches([]);
          setLoading(false);
        }
      }
    };

    fetchCoaches();
    return () => { cancelled = true; };
  }, [userId]);

  return { coaches, loading, error };
}
