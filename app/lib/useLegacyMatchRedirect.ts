import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isLegacyMatchId } from '@/utils/matchSlug';

/** Replace legacy m-* URL with canonical slug once match payload is known. */
export function useLegacyMatchRedirect(
  urlRef: string | undefined,
  slug: string | null | undefined,
  targetPath: (slug: string) => string,
) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!urlRef || !slug || !isLegacyMatchId(urlRef) || urlRef === slug) return;
    navigate(targetPath(slug), { replace: true });
  }, [urlRef, slug, navigate, targetPath]);
}
