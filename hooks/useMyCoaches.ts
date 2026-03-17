import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type CoachProfile = {
  coach_client_key: string; // composite key: coach_id + client_id
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
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    const userId = user?.id;

    if (!userId) {
      setCoaches([]);
      setLoading(false);
      return;
    }

    const fetchCoaches = async () => {
      try {
        setLoading(true);

        // Query only existing columns — no id column on coach_clients
        const { data: links, error: linksError } = await supabase
          .from('coach_clients')
          .select('coach_id, client_id, org_id, status, started_at')
          .eq('client_id', userId)
          .eq('status', 'active');

        if (linksError) {
          console.error('[useMyCoaches] links error:', linksError.message);
          throw linksError;
        }

        if (!links || links.length === 0) {
          if (!cancelled) { setCoaches([]); setLoading(false); }
          return;
        }

        const coachIds = links.map((l: any) => l.coach_id);

        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', coachIds);

        if (profilesError) {
          console.error('[useMyCoaches] profiles error:', profilesError.message);
          throw profilesError;
        }

        const merged: CoachProfile[] = links.map((link: any) => {
          const profile = (profiles ?? []).find((p: any) => p.id === link.coach_id);
          return {
            coach_client_key: `${link.coach_id}_${link.client_id}`,
            coach_id: link.coach_id,
            status: link.status,
            started_at: link.started_at ?? null,
            org_id: link.org_id ?? null,
            full_name: profile?.full_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
          };
        });

        if (!cancelled) { setCoaches(merged); setLoading(false); }
      } catch (err: any) {
        console.error('[useMyCoaches] fetch error:', err.message);
        if (!cancelled) { setError(err); setLoading(false); }
      }
    };

    fetchCoaches();
    return () => { cancelled = true; };
  }, [user?.id]);

  return { coaches, loading, error };
}
