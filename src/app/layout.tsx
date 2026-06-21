import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import Script from 'next/script';

import './globals.css';

const fontVars = {
  '--font-sans': '"Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif',
  '--font-mono': '"SF Mono", "JetBrains Mono", Menlo, Monaco, monospace',
} as React.CSSProperties;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-SDGRVMER2G" strategy="afterInteractive" />
        <Script id="gtag-ga4" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-SDGRVMER2G');
        `}</Script>
        <Script src="https://www.googletagmanager.com/gtag/js?id=AW-879571748" strategy="afterInteractive" />
        <Script id="gtag-ads" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'AW-879571748');
        `}</Script>
        {process.env.NEXT_PUBLIC_UMAMI_URL && process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <Script
            src={`${process.env.NEXT_PUBLIC_UMAMI_URL}/script.js`}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
            strategy="afterInteractive"
          />
        )}
      </head>
      <body suppressHydrationWarning className="antialiased" style={fontVars}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
