import { useParams } from 'react-router-dom';

export function GameScreen({ mode }: { mode: 'solo' | 'multiplayer' }) {
  const { slug = '' } = useParams<{ slug: string }>();
  return <div data-testid="game-screen" data-mode={mode} data-slug={slug} />;
}
