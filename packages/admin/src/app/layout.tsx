import { Providers } from "@/components/providers";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <head>
        <title>大熊动医华南医学检验实验室管理后台</title>
        <meta name="description" content="大熊动医华南医学检验实验室管理后台" />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
