import Head from 'expo-router/head';

import { APP_NAME } from '@/constants/brand';

/** Sets the browser tab title, e.g. "Dashboard · Sparsh". */
export function ScreenTitle({ title }: { title: string }) {
  return (
    <Head>
      <title>{`${title} · ${APP_NAME}`}</title>
    </Head>
  );
}
