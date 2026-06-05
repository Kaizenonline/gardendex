import Head from "next/head";
export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
        <meta name="description" content="GardenDex — AI plant collection, battles and garden tracker"/>
        <meta name="theme-color" content="#2e7d32"/>
        <link rel="manifest" href="/manifest.json"/>
        <title>GardenDex 🌿</title>

        {/* Open Graph — controls previews on iMessage, WhatsApp, Slack, etc. */}
        <meta property="og:type"        content="website"/>
        <meta property="og:site_name"   content="GardenDex"/>
        <meta property="og:title"       content="GardenDex 🌿 — AI Plant Collection & Garden Tracker"/>
        <meta property="og:description" content="Scan plants with AI, track your garden, battle your collection, and unlock achievements."/>
        <meta property="og:image"       content="/og-preview.png"/>
        <meta property="og:image:width" content="1200"/>
        <meta property="og:image:height" content="630"/>

        {/* Twitter / X card */}
        <meta name="twitter:card"        content="summary_large_image"/>
        <meta name="twitter:title"       content="GardenDex 🌿"/>
        <meta name="twitter:description" content="AI plant identification, garden tracking, and Pokémon-style plant battles."/>
        <meta name="twitter:image"       content="/og-preview.png"/>
      </Head>
      <Component {...pageProps}/>
    </>
  );
}
