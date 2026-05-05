import { useEffect, useState } from 'react';
import type { Challenge } from '../judge/types';
import { supabase } from './supabase';

interface UseChallengesResult {
  data: Challenge[] | null;
  loading: boolean;
  error: Error | null;
}

export function useChallenges(): UseChallengesResult {
  const [data, setData] = useState<Challenge[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      const { data: rows, error: err } = await supabase
        .from('challenges')
        .select('*')
        .order('difficulty', { ascending: true });

      if (cancelled) return;

      if (err) {
        setError(new Error(err.message));
        setLoading(false);
        return;
      }

      const challenges: Challenge[] = (rows ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        slug: r.slug as string,
        title: r.title as string,
        description: r.description as string,
        difficulty: r.difficulty as Challenge['difficulty'],
        referenceShaderSrc: r.reference_shader_src as string,
        tolerance: r.tolerance as number,
        useBlur: r.use_blur as boolean,
        hintText: (r.hint_text as string) ?? undefined,
      }));

      setData(challenges);
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}

interface UseChallengeResult {
  data: Challenge | null;
  loading: boolean;
}

export function useChallenge(slug: string): UseChallengeResult {
  const [data, setData] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      const { data: row, error: err } = await supabase
        .from('challenges')
        .select('*')
        .eq('slug', slug)
        .single();

      if (cancelled) return;

      if (err || !row) {
        setLoading(false);
        return;
      }

      setData({
        id: row.id as string,
        slug: row.slug as string,
        title: row.title as string,
        description: row.description as string,
        difficulty: row.difficulty as Challenge['difficulty'],
        referenceShaderSrc: row.reference_shader_src as string,
        tolerance: row.tolerance as number,
        useBlur: row.use_blur as boolean,
        hintText: (row.hint_text as string) ?? undefined,
      });
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, [slug]);

  return { data, loading };
}

export async function submitSolve(challengeId: string, score: number, shaderSrc: string): Promise<void> {
  const { error } = await supabase.from('solves').insert({
    challenge_id: challengeId,
    score,
    shader_src: shaderSrc,
  });
  if (error) throw new Error(error.message);
}
