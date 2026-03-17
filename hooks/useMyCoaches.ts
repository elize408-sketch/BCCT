import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type CoachProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  organization?: string | null;
  subtitle?: string | null;
  coach_client_id: string;
  status: string;
};

export function useMyCoaches() {
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCoaches() {
      console.log('[useMyCoaches] Fetching active coaches...');
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          console.log('[useMyCoaches] No authenticated user, skipping fetch');
          if (!cancelled) {
            setCoaches([]);
            setLoading(false);
          }
          return;
        }

        console.log('[useMyCoaches] Querying coach_clients for user:', user.id);

        const { data, error: queryError } = await supabase
          .from('coach_clients')
          .select('id, status, coach_id, profiles!coach_clients_coach_id_fkey(id, full_name, avatar_url, organization, subtitle)')
          .eq('client_id', user.id)
          .eq('status', 'active');

        if (queryError) {
          console.warn('[useMyCoaches] Join query failed, trying fallback:', queryError.message);

          // Fallback: fetch coach_clients first, then profiles separately
          const { data: links, error: linksError } = await supabase
            .from('coach_clients')
            .select('id, status, coach_id')
            .eq('client_id', user.id)
            .eq('status', 'active');

          if (linksError) {
            throw new Error(linksError.message);
          }

          if (!links || links.length === 0) {
            console.log('[useMyCoaches] No active coach links found');
            if (!cancelled) {
              setCoaches([]);
              setLoading(false);
            }
            return;
          }

          const coachIds = links.map((l: { coach_id: string }) => l.coach_id);
          console.log('[useMyCoaches] Fetching profiles for coach IDs:', coachIds);

          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, organization, subtitle')
            .in('id', coachIds);

          if (profilesError) {
            throw new Error(profilesError.message);
          }

          const result: CoachProfile[] = (links as { id: string; status: string; coach_id: string }[]).map((link) => {
            const profile = (profiles ?? []).find((p: { id: string }) => p.id === link.coach_id);
            return {
              id: link.coach_id,
              full_name: profile?.full_name ?? null,
              avatar_url: profile?.avatar_url ?? null,
              organization: profile?.organization ?? null,
              subtitle: profile?.subtitle ?? null,
              coach_client_id: link.id,
              status: link.status,
            };
          });

          console.log('[useMyCoaches] Fallback result:', result.length, 'coaches');
          if (!cancelled) {
            setCoaches(result);
            setLoading(false);
          }
          return;
        }

        const result: CoachProfile[] = (data ?? []).map((row: {
          id: string;
          status: string;
          coach_id: string;
          profiles: {
            id: string;
            full_name: string | null;
            avatar_url: string | null;
            organization?: string | null;
            subtitle?: string | null;
          } | null;
        }) => ({
          id: row.coach_id,
          full_name: row.profiles?.full_name ?? null,
          avatar_url: row.profiles?.avatar_url ?? null,
          organization: row.profiles?.organization ?? null,
          subtitle: row.profiles?.subtitle ?? null,
          coach_client_id: row.id,
          status: row.status,
        }));

        console.log('[useMyCoaches] Fetched', result.length, 'active coaches');
        if (!cancelled) {
          setCoaches(result);
          setLoading(false);
        }
      } catch (err) {
        console.error('[useMyCoaches] Error fetching coaches:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setCoaches([]);
          setLoading(false);
        }
      }
    }

    fetchCoaches();
    return () => { cancelled = true; };
  }, []);

  return { coaches, loading, error };
}
