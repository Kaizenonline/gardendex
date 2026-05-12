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
      </Head>
      <Component {...pageProps}/>
    </>
  );
}
