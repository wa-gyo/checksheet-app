import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/', // すべての検索ロボットに対し、全ページのクロールを拒否
    },
  };
}
