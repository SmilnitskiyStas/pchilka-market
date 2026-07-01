export default function UtilityMetersLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            body > header,
            body > footer {
              display: none !important;
            }
          `
        }}
      />
      {children}
    </>
  );
}
